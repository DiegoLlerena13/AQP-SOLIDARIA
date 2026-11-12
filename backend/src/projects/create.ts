
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { withAuthz, type Principal } from "../authz/index.js";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = withAuthz(async (event: any, principal: Principal) => {
  // La política centralizada exige:
  // - Token de acceso válido
  // - Rol GESTOR
  // - Scope api/projects.write

  // 1. Validar el cuerpo de la solicitud
  let body: unknown;

  try {
    body = event.body
      ? typeof event.body === "string"
        ? JSON.parse(event.body)
        : event.body
      : {};
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "BAD_REQUEST",
        message: "El cuerpo de la solicitud no contiene JSON válido",
      }),
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "BAD_REQUEST",
        message: "El cuerpo debe ser un objeto JSON válido",
      }),
    };
  }

  const { name, description, goalAmountCents } = body as Record<
    string,
    unknown
  >;

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof description !== "string" ||
    !description.trim() ||
    typeof goalAmountCents !== "number" ||
    !Number.isSafeInteger(goalAmountCents) ||
    goalAmountCents <= 0
  ) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "BAD_REQUEST",
        message: "Datos de proyecto inválidos o incompletos",
      }),
    };
  }

  // 2. Crear proyecto en estado BORRADOR
  const projectId = randomUUID();
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

  // 3. Persistir con escritura condicional en DynamoDB
  try {
    await docClient.send(
      new PutCommand({
        TableName: process.env.PROJECTS_TABLE,
        Item: newProject,
        ConditionExpression: "attribute_not_exists(projectId)",
      })
    );

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Proyecto creado exitosamente en estado BORRADOR",
        projectId,
      }),
    };
  } catch (error) {
    console.error("Error guardando proyecto:", error);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "INTERNAL_SERVER_ERROR",
        message: "Error interno al crear el proyecto",
      }),
    };
  }
});
