
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { withAuthz } from "../authz/withAuthz.js";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = withAuthz(async (event, principal) => {
  let body: any;

  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({
        code: "BAD_REQUEST",
        message: "El cuerpo de la solicitud no contiene JSON válido",
      }),
    };
  }

  const { name, description, goalAmountCents } = body ?? {};

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
      body: JSON.stringify({
        code: "BAD_REQUEST",
        message: "Datos de proyecto inválidos o incompletos",
      }),
    };
  }

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
