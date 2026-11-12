import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { withAuthz } from "../authz/withAuthz.js";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = withAuthz(async (event, principal) => {
  const projectId = event.pathParameters?.projectId;

  if (!projectId) {
    return { statusCode: 400, body: JSON.stringify({ code: "BAD_REQUEST", message: "Se requiere el ID del proyecto en la ruta" }) };
  }

  try {
    const command = new UpdateCommand({
      TableName: process.env.PROJECTS_TABLE,
      Key: { projectId: projectId },
      UpdateExpression: "SET #status = :newStatus, updatedAt = :now",
      ConditionExpression: "attribute_exists(projectId) AND #status = :oldStatus",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":newStatus": "PUBLICADO",
        ":oldStatus": "BORRADOR",
        ":now": new Date().toISOString()
      }
    });

    await docClient.send(command);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Proyecto publicado y listo para recibir donaciones" })
    };
  } catch (error: any) {
    if (error.name === "ConditionalCheckFailedException") {
      return { statusCode: 409, body: JSON.stringify({ code: "CONFLICT", message: "El proyecto no existe o no se encuentra en estado BORRADOR" }) };
    }
    return { statusCode: 500, body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error interno al publicar" }) };
  }
});