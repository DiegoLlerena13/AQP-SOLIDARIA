"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const index_js_1 = require("../authz/index.js");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
exports.handler = (0, index_js_1.withAuthz)(async (event, _principal) => {
    // 1. Autorización garantizada por withAuthz - Exclusivo para rol GESTOR (CA-04.1)
    // 2. Extraer ID del proyecto de la URL (ej. /projects/{projectId}/publish)
    const projectId = event.pathParameters?.projectId;
    if (!projectId) {
        return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: "BAD_REQUEST", message: "Se requiere el ID del proyecto en la ruta" })
        };
    }
    // 3. Transición de estado segura (Condición: Solo si está en BORRADOR)
    try {
        const command = new lib_dynamodb_1.UpdateCommand({
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
    }
    catch (error) {
        console.error("Error publicando proyecto:", error);
        // Si la condición de actualización falla (ej. ya estaba publicado)
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: "CONFLICT", message: "El proyecto no existe o no se encuentra en estado BORRADOR" })
            };
        }
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error interno al publicar el proyecto" })
        };
    }
});
