import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async () => {
  try {
    const command = new QueryCommand({
      TableName: process.env.PROJECTS_TABLE,
      IndexName: "status-createdAt", // GSI requerido para el catálogo[cite: 2]
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#status": "status" // 'status' es una palabra reservada, requiere alias
      },
      ExpressionAttributeValues: {
        ":status": "PUBLICADO" // Solo proyectos publicados[cite: 1]
      }
    });

    const response = await docClient.send(command);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(response.Items || [])
    };
  } catch (error) {
    console.error("Error consultando DynamoDB:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code: "INTERNAL_SERVER_ERROR",
        message: "Error al recuperar los proyectos"
      })
    };
  }
};