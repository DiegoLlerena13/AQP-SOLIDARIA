import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { withAuthz, assertOwner, type Principal } from "../authz/index.js";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = withAuthz(async (event: any, principal: Principal) => {
  // 1. Identidad garantizada por withAuthz (Zero Trust)
  const donorSub = principal.sub;

  // 2. Extracción de parámetros
  const donationId = event.pathParameters?.donationId;
  const body = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : {};
  const action = body.action; // Se espera "CONFIRM" o "REJECT"

  if (!donationId || (action !== "CONFIRM" && action !== "REJECT")) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "BAD_REQUEST", message: "Acción inválida. Use action: CONFIRM o REJECT." })
    };
  }

  try {
    // 3. Obtener los detalles de la donación original
    const getCommand = new GetCommand({
      TableName: process.env.DONATIONS_TABLE,
      Key: { donationId: donationId }
    });
    const { Item: donation } = await docClient.send(getCommand);

    // Validación de pertenencia y mitigación BOLA (CA-07.2, T09):
    // Si la donación no existe o pertenece a otro donante, assertOwner lanza 404 NOT_FOUND.
    assertOwner(principal, donation);

    // 4. Procesamiento condicionado a que siga PENDIENTE (Evita concurrencia y doble cobro)
    const now = new Date().toISOString();
    const newStatus = action === "CONFIRM" ? "CONFIRMADA_SIMULADA" : "RECHAZADA_SIMULADA";

    if (action === "CONFIRM") {
      const txCommand = new TransactWriteCommand({
        TransactItems: [
          {
            // A) Actualizar el estado de la donación
            Update: {
              TableName: process.env.DONATIONS_TABLE,
              Key: { donationId: donationId },
              UpdateExpression: "SET #status = :newStatus, updatedAt = :now",
              ConditionExpression: "#status = :pendingStatus AND donorSub = :sub",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: {
                ":newStatus": newStatus,
                ":now": now,
                ":pendingStatus": "PENDIENTE_SIMULACION",
                ":sub": donorSub
              }
            }
          },
          {
            // B) Sumar los centavos confirmados al proyecto
            Update: {
              TableName: process.env.PROJECTS_TABLE,
              Key: { projectId: donation!.projectId },
              UpdateExpression: "ADD confirmedAmountCents :amount",
              ConditionExpression: "attribute_exists(projectId)",
              ExpressionAttributeValues: {
                ":amount": donation!.amountCents
              }
            }
          }
        ]
      });
      await docClient.send(txCommand);
    } else {
      // Rechazo: Solo se actualiza la donación, no el proyecto
      const updateCommand = new UpdateCommand({
        TableName: process.env.DONATIONS_TABLE,
        Key: { donationId: donationId },
        UpdateExpression: "SET #status = :newStatus, updatedAt = :now",
        ConditionExpression: "#status = :pendingStatus AND donorSub = :sub",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":newStatus": newStatus,
          ":now": now,
          ":pendingStatus": "PENDIENTE_SIMULACION",
          ":sub": donorSub
        }
      });
      await docClient.send(updateCommand);
    }

    // Mensaje de respuesta exigido por la rúbrica CA-06.4
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Simulación académica: no se ha realizado ningún cobro",
        status: newStatus
      })
    };

  } catch (error: any) {
    // Si assertOwner lanzó AuthzError (ej. 404 por BOLA), re-lanzar para que withAuthz lo formatee
    if (error?.status === 404 || error?.name === "AuthzError") {
      throw error;
    }

    console.error("Error en simulación:", error);
    
    // ConditionalCheckFailedException ocurre en UpdateCommand, TransactionCanceledException en TransactWriteCommand
    if (error.name === "TransactionCanceledException" || error.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 409,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "CONFLICT", message: "La donación ya fue procesada o hubo un conflicto de actualización" })
      };
    }

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error al simular confirmación" })
    };
  }
});
