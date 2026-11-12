import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID, createHash } from "crypto";
import { withAuthz, type Principal } from "../authz/index.js";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = withAuthz(async (event: any, principal: Principal) => {
  // 1. Autorización y extracción de usuario verificada por withAuthz (CA-04.3, CA-05.3)
  const donorSub = principal.sub;

  // 2. Extracción y validación de entrada
  const idempotencyKey = event.headers?.["idempotency-key"] || event.headers?.["Idempotency-Key"];
  const body = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : {};
  const { projectId, amountCents } = body;

  if (!idempotencyKey) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "BAD_REQUEST", message: "Falta cabecera Idempotency-Key" })
    };
  }

  // Validación de montos (S/ 1.00 a S/ 1,000.00 en centavos)
  if (!projectId || typeof amountCents !== "number" || amountCents < 100 || amountCents > 100000 || !Number.isInteger(amountCents)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "BAD_REQUEST", message: "Datos de donación inválidos" })
    };
  }

  const donationId = randomUUID();
  const idempotencyPk = `${donorSub}#createDonation#${idempotencyKey}`;
  const payloadHash = createHash("sha256").update(JSON.stringify({ projectId, amountCents })).digest("hex");
  const now = new Date().toISOString();
  
  // Tiempo de vida (TTL) del registro de idempotencia: 24 horas en segundos
  const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

  // 3. Transacción atómica (Zero Trust / Idempotencia)
  try {
    const command = new TransactWriteCommand({
      TransactItems: [
        {
          // A) Validar que el proyecto existe y está PUBLICADO
          ConditionCheck: {
            TableName: process.env.PROJECTS_TABLE,
            Key: { projectId: projectId },
            ConditionExpression: "attribute_exists(projectId) AND #status = :publishedStatus",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":publishedStatus": "PUBLICADO" }
          }
        },
        {
          // B) Registrar la llave de idempotencia (falla si ya existe)
          Put: {
            TableName: process.env.IDEMPOTENCY_TABLE || process.env.DONATIONS_TABLE,
            Item: {
              pk: idempotencyPk,
              payloadHash: payloadHash,
              donationId: donationId,
              responseStatus: 201,
              expiresAt: expiresAt
            },
            ConditionExpression: "attribute_not_exists(pk)"
          }
        },
        {
          // C) Crear la donación como PENDIENTE
          Put: {
            TableName: process.env.DONATIONS_TABLE,
            Item: {
              donationId: donationId,
              projectId: projectId,
              donorSub: donorSub,
              amountCents: amountCents,
              currency: "PEN",
              status: "PENDIENTE_SIMULACION",
              createdAt: now,
              updatedAt: now
            }
          }
        }
      ]
    });

    await docClient.send(command);

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Intención de donación registrada",
        donationId: donationId
      })
    };

  } catch (error: any) {
    console.error("Error en TransactWrite:", error);

    // Manejo de Idempotencia y validaciones de estado en DynamoDB
    if (error.name === "TransactionCanceledException") {
      const cancellationReasons = error.CancellationReasons || [];
      
      // Si falló el ConditionCheck del proyecto (índice 0)
      if (cancellationReasons[0]?.Code === "ConditionalCheckFailed") {
        return {
          statusCode: 409,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "CONFLICT", message: "El proyecto no existe o no se encuentra PUBLICADO" })
        };
      }

      // Si falló el Put de idempotencia porque la llave ya existía (índice 1)
      if (cancellationReasons[1]?.Code === "ConditionalCheckFailed") {
        return {
          statusCode: 409,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "CONFLICT", message: "La clave de idempotencia ya fue procesada" })
        };
      }
    }

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error interno procesando donación" })
    };
  }
});
