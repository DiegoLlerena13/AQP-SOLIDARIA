"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const crypto_1 = require("crypto");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const handler = async (event) => {
    // 1. Autorización (Zero Trust) - Exclusivo para rol GESTOR
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    const groups = claims?.["cognito:groups"];
    const roles = Array.isArray(groups) ? groups : typeof groups === "string" ? groups.split(/[,\s]+/).filter(Boolean) : [];
    const userSub = claims?.sub;
    if (!userSub) {
        return { statusCode: 401, body: JSON.stringify({ code: "UNAUTHORIZED", message: "Autenticación requerida" }) };
    }
    if (!roles.includes("GESTOR")) {
        return { statusCode: 403, body: JSON.stringify({ code: "FORBIDDEN", message: "Solo los gestores pueden crear proyectos" }) };
    }
    // 2. Extraer y validar el cuerpo de la petición
    const body = event.body ? JSON.parse(event.body) : {};
    const { name, description, goalAmountCents } = body;
    if (!name || !description || typeof goalAmountCents !== "number" || goalAmountCents <= 0) {
        return { statusCode: 400, body: JSON.stringify({ code: "BAD_REQUEST", message: "Datos de proyecto inválidos o incompletos" }) };
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
        console.error("Error creando proyecto:", error);
        return { statusCode: 500, body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error al crear el proyecto" }) };
    }
};
exports.handler = handler;
