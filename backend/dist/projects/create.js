"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const crypto_1 = require("crypto");
const index_js_1 = require("../authz/index.js");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
exports.handler = (0, index_js_1.withAuthz)(async (event, principal) => {
    // 1. Autorización verificada por withAuthz - Exclusivo para rol GESTOR (CA-04.1, CA-08.1)
    const userSub = principal.sub;
    // 2. Extraer y validar el cuerpo de la petición
    const body = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : {};
    const { name, description, goalAmountCents } = body;
    if (!name || !description || typeof goalAmountCents !== "number" || goalAmountCents <= 0) {
        return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: "BAD_REQUEST", message: "Datos de proyecto inválidos o incompletos" })
        };
    }
    // 3. Preparar el registro inicial del proyecto
    const projectId = (0, crypto_1.randomUUID)();
    const now = new Date().toISOString();
    const newProject = {
        projectId,
        name,
        description,
        goalAmountCents,
        confirmedAmountCents: 0, // Nace sin fondos
        status: "BORRADOR", // Nace como borrador (no visible para donantes)
        createdBy: userSub,
        createdAt: now,
        updatedAt: now
    };
    // 4. Guardar en base de datos
    try {
        const command = new lib_dynamodb_1.PutCommand({
            TableName: process.env.PROJECTS_TABLE,
            Item: newProject
        });
        await docClient.send(command);
        return {
            statusCode: 201,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Proyecto creado exitosamente en estado BORRADOR",
                projectId: projectId
            })
        };
    }
    catch (error) {
        console.error("Error guardando proyecto:", error);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error interno al crear el proyecto" })
        };
    }
});
