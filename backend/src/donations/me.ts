import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: any) => {
  // 1. Autorización estricta (Zero Trust)
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const groups = claims?.["cognito:groups"];
  const roles = Array.isArray(groups) ? groups : typeof groups === "string" ? groups.split(/[,\s]+/).filter(Boolean) : [];
  const donorSub = claims?.sub;

  if (!donorSub) {
    return {
      statusCode: 401,
      body: JSON.stringify({ code: "UNAUTHORIZED", message: "Autenticación requerida" })
    };
  }

  // 2. Validación de Rol (Solo los donantes pueden tener historial de donaciones)
  if (!roles.includes("DONANTE")) {
    return {
      statusCode: 403,
      body: JSON.stringify({ code: "FORBIDDEN", message: "No tienes permiso para ver este historial" })
    };
  }

  // 3. Consulta a DynamoDB usando el Índice Secundario Global (GSI)
  try {
    const command = new QueryCommand({
      TableName: process.env.DONATIONS_TABLE,
      IndexName: "donorSub-createdAt", // Asegúrate de que este GSI exista en tu template.yaml
      KeyConditionExpression: "donorSub = :sub",
      ExpressionAttributeValues: {
        ":sub": donorSub
      }
    });

    const { Items } = await docClient.send(command);

    // 4. Mapeo de respuesta (ocultando datos sensibles si los hubiera)
    const history = (Items || []).map(item => ({
      donationId: item.donationId,
      projectId: item.projectId,
      amountCents: item.amountCents,
      currency: item.currency,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(history)
    };

  } catch (error: any) {
    console.error("Error al consultar el historial:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error al recuperar el historial" })
    };
  }
};