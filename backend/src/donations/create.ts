import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID, createHash } from "crypto";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: any) => {
  // 1. Autorización y extracción de usuario
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const groups = claims?.["cognito:groups"];
  const roles = Array.isArray(groups) ? groups : typeof groups === "string" ? groups.split(/[,\s]+/).filter(Boolean) : [];
  const donorSub = claims?.sub;

  if (!donorSub) {
    return { statusCode: 401, body: JSON.stringify({ code: "UNAUTHORIZED", message: "Autenticación requerida" }) };
  }

  if (!roles.includes("DONANTE")) {
    return { statusCode: 403, body: JSON.stringify({ code: "FORBIDDEN", message: "Permiso insuficiente" }) };
  }

  // 2. Extracción y validación de entrada
  const idempotencyKey = event.headers?.["idempotency-key"] || event.headers?.["Idempotency-Key"];
  const body = event.body ? JSON.parse(event.body) : {};
  const { projectId, amountCents } = body;

  if (!idempotencyKey) {
    return { statusCode: 400, body: JSON.stringify({ code: "BAD_REQUEST", message: "Falta cabecera Idempotency-Key" }) };
  }

  // Validación de montos (S/ 1.00 a S/ 1,000.00 en centavos)
  if (!projectId || typeof amountCents !== "number" || amountCents < 100 || amountCents > 100000 || !Number.isInteger(amountCents)) {
    return { statusCode: 400, body: JSON.stringify({ code: "BAD_REQUEST", message: "Datos de donación inválidos" }) };
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
            TableName: process.env.IDEMPOTENCY_TABLE || process.env.DONATIONS_TABLE, // Ajustar según tus variables de entorno
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
    console.error("Error en transacción:", error);

    if (error.name === "TransactionCanceledException") {
      // Razones típicas: El proyecto no es válido o la clave de idempotencia ya se usó
      return {
        statusCode: 409,
        body: JSON.stringify({
          code: "CONFLICT",
          message: "El proyecto no está disponible o la solicitud está duplicada"
        })
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error interno del servidor" })
    };
  }
};