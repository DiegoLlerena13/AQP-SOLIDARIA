"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const index_js_1 = require("../authz/index.js");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
exports.handler = (0, index_js_1.withAuthz)(async (event, principal) => {
    // 1. Identidad verificada por withAuthz (Zero Trust CA-04.3, CA-07.1)
    const donorSub = principal.sub;
    // 2. Consulta a DynamoDB usando el Índice Secundario Global (GSI)
    try {
        const command = new lib_dynamodb_1.QueryCommand({
            TableName: process.env.DONATIONS_TABLE,
            IndexName: "donorSub-createdAt",
            KeyConditionExpression: "donorSub = :sub",
            ExpressionAttributeValues: {
                ":sub": donorSub
            }
        });
        const { Items } = await docClient.send(command);
        // 3. Mapeo de respuesta (ocultando datos sensibles si los hubiera)
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
    }
    catch (error) {
        console.error("Error al consultar el historial:", error);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error al recuperar el historial" })
        };
    }
});
