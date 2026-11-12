import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID, createHash } from "crypto";
import { withAuthz } from "../authz/withAuthz.js";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = withAuthz(async (event, principal) => {
  const idempotencyKey = event.headers?.["idempotency-key"] || event.headers?.["Idempotency-Key"];
  const body = event.body ? JSON.parse(event.body) : {};
  const { projectId, amountCents } = body;

  if (!idempotencyKey) {
    return { statusCode: 400, body: JSON.stringify({ code: "BAD_REQUEST", message: "Falta cabecera Idempotency-Key" }) };
  }

  if (!projectId || typeof amountCents !== "number" || amountCents < 100 || amountCents > 100000 || !Number.isInteger(amountCents)) {
    return { statusCode: 400, body: JSON.stringify({ code: "BAD_REQUEST", message: "Datos de donación inválidos" }) };
  }

  const donationId = randomUUID();
  const idempotencyPk = `${principal.sub}#createDonation#${idempotencyKey}`;
  const payloadHash = createHash("sha256").update(JSON.stringify({ projectId, amountCents })).digest("hex");
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

  try {
    const command = new TransactWriteCommand({
      TransactItems: [
        {
          ConditionCheck: {
            TableName: process.env.PROJECTS_TABLE,
            Key: { projectId: projectId },
            ConditionExpression: "attribute_exists(projectId) AND #status = :publishedStatus",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":publishedStatus": "PUBLICADO" }
          }
        },
        {
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
          Put: {
            TableName: process.env.DONATIONS_TABLE,
            Item: {
              donationId: donationId,
              projectId: projectId,
              donorSub: principal.sub,
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
      body: JSON.stringify({ message: "Intención de donación registrada", donationId: donationId })
    };
  } catch (error: any) {
    if (error.name === "TransactionCanceledException") {
      return { statusCode: 409, body: JSON.stringify({ code: "CONFLICT", message: "El proyecto no está disponible o la solicitud está duplicada" }) };
    }
    return { statusCode: 500, body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error interno del servidor" }) };
  }
});