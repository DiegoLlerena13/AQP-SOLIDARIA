"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const withAuthz_js_1 = require("../authz/withAuthz.js");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
exports.handler = (0, withAuthz_js_1.withAuthz)(async (event, principal) => {
    try {
        const command = new lib_dynamodb_1.QueryCommand({
            TableName: process.env.DONATIONS_TABLE,
            IndexName: "donorSub-createdAt",
            KeyConditionExpression: "donorSub = :sub",
            ExpressionAttributeValues: { ":sub": principal.sub }
        });
        const { Items } = await docClient.send(command);
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
        return { statusCode: 500, body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error al recuperar el historial" }) };
    }
});
