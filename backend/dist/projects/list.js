"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const handler = async () => {
    try {
        const command = new lib_dynamodb_1.QueryCommand({
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
    }
    catch (error) {
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
exports.handler = handler;
