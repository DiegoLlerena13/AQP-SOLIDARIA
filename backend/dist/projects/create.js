"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const crypto_1 = require("crypto");
const withAuthz_js_1 = require("../authz/withAuthz.js");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
exports.handler = (0, withAuthz_js_1.withAuthz)(async (event, principal) => {
    let body;
    try {
        body = event.body ? JSON.parse(event.body) : {};
    }
    catch {
        return {
            statusCode: 400,
            body: JSON.stringify({
                code: "BAD_REQUEST",
                message: "El cuerpo de la solicitud no contiene JSON válido",
            }),
        };
    }
    const { name, description, goalAmountCents } = body ?? {};
    if (typeof name !== "string" ||
        !name.trim() ||
        typeof description !== "string" ||
        !description.trim() ||
        typeof goalAmountCents !== "number" ||
        !Number.isSafeInteger(goalAmountCents) ||
        goalAmountCents <= 0) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                code: "BAD_REQUEST",
                message: "Datos de proyecto inválidos o incompletos",
            }),
        };
    }
    const projectId = (0, crypto_1.randomUUID)();
    const now = new Date().toISOString();
    const newProject = {
        projectId,
        name: name.trim(),
        description: description.trim(),
        goalAmountCents,
        confirmedAmountCents: 0,
        status: "BORRADOR",
        createdBy: principal.sub,
        createdAt: now,
        updatedAt: now,
    };
    try {
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: process.env.PROJECTS_TABLE,
            Item: newProject,
            ConditionExpression: "attribute_not_exists(projectId)",
        }));
        return {
            statusCode: 201,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Proyecto creado exitosamente en estado BORRADOR",
                projectId,
            }),
        };
    }
    catch (error) {
        console.error("Error creando proyecto:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                code: "INTERNAL_SERVER_ERROR",
                message: "Error al crear el proyecto",
            }),
        };
    }
});
