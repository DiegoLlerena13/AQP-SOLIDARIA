import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: any) => {
  // 1. Autorización - Exclusivo para rol GESTOR
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const groups = claims?.["cognito:groups"];
  const roles = Array.isArray(groups) ? groups : typeof groups === "string" ? groups.split(/[,\s]+/).filter(Boolean) : [];
  
  if (!claims?.sub) {
    return { statusCode: 401, body: JSON.stringify({ code: "UNAUTHORIZED", message: "Autenticación requerida" }) };
  }

  if (!roles.includes("GESTOR")) {
    return { statusCode: 403, body: JSON.stringify({ code: "FORBIDDEN", message: "Solo los gestores pueden publicar proyectos" }) };
  }

  // 2. Extraer ID del proyecto de la URL (ej. /projects/{projectId}/publish)
  const projectId = event.pathParameters?.projectId;

  if (!projectId) {
    return { statusCode: 400, body: JSON.stringify({ code: "BAD_REQUEST", message: "Se requiere el ID del proyecto en la ruta" }) };
  }

  // 3. Transición de estado segura (Condición: Solo si está en BORRADOR)
  try {
    const command = new UpdateCommand({
      TableName: process.env.PROJECTS_TABLE,
      Key: { projectId: projectId },
      UpdateExpression: "SET #status = :newStatus, updatedAt = :now",
      ConditionExpression: "attribute_exists(projectId) AND #status = :oldStatus",
      ExpressionAttributeNames: {
        "#status": "status"
      },
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
    console.error("Error publicando proyecto:", error);
    
    // Si la condición de actualización falla (ej. ya estaba publicado)
    if (error.name === "ConditionalCheckFailedException") {
      return { 
        statusCode: 409, 
        body: JSON.stringify({ code: "CONFLICT", message: "El proyecto no existe o no se encuentra en estado BORRADOR" }) 
      };
    }
    
    return { statusCode: 500, body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error interno al publicar" }) };
  }
};