import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { withAuthz } from "../authz/withAuthz.js";
import { assertOwner } from "../authz/ownership.js";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = withAuthz(async (event, principal) => {
  const donationId = event.pathParameters?.donationId;
  const body = event.body ? JSON.parse(event.body) : {};
  const action = body.action;

  if (!donationId || (action !== "CONFIRM" && action !== "REJECT")) {
    return { statusCode: 400, body: JSON.stringify({ code: "BAD_REQUEST", message: "Acción inválida. Use action: CONFIRM o REJECT." }) };
  }

  try {
    const getCommand = new GetCommand({
      TableName: process.env.DONATIONS_TABLE,
      Key: { donationId: donationId }
    });
    const { Item: donation } = await docClient.send(getCommand);

    if (!donation) {
      return { statusCode: 404, body: JSON.stringify({ code: "NOT_FOUND", message: "Donación no encontrada" }) };
    }

    // Valida automáticamente que principal.sub coincida con donation.donorSub
    assertOwner(principal, donation);

    const now = new Date().toISOString();
    const newStatus = action === "CONFIRM" ? "CONFIRMADA_SIMULADA" : "RECHAZADA_SIMULADA";

    if (action === "CONFIRM") {
      const txCommand = new TransactWriteCommand({
        TransactItems: [
          {
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
                ":sub": principal.sub
              }
            }
          },
          {
            Update: {
              TableName: process.env.PROJECTS_TABLE,
              Key: { projectId: donation.projectId },
              UpdateExpression: "ADD confirmedAmountCents :amount",
              ConditionExpression: "attribute_exists(projectId)",
              ExpressionAttributeValues: { ":amount": donation.amountCents }
            }
          }
        ]
      });
      await docClient.send(txCommand);
    } else {
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
          ":sub": principal.sub
        }
      });
      await docClient.send(updateCommand);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Simulación académica: no se ha realizado ningún cobro", status: newStatus })
    };
  } catch (error: any) {
    if (error.name === "TransactionCanceledException" || error.name === "ConditionalCheckFailedException") {
      return { statusCode: 409, body: JSON.stringify({ code: "CONFLICT", message: "La donación ya fue procesada o hubo un conflicto de actualización" }) };
    }
    return { statusCode: 500, body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error al simular confirmación" }) };
  }
});