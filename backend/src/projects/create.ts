import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { withAuthz, type Principal } from "../authz/index.js";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = withAuthz(async (event: any, principal: Principal) => {
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
  const projectId = randomUUID();
  const now = new Date().toISOString();

  const newProject = {
    projectId,
    name,
    description,
    goalAmountCents,
    confirmedAmountCents: 0, // Nace sin fondos
    status: "BORRADOR",      // Nace como borrador (no visible para donantes)
    createdBy: userSub,
    createdAt: now,
    updatedAt: now
  };

  // 4. Guardar en base de datos
  try {
    const command = new PutCommand({
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
  } catch (error: any) {
    console.error("Error guardando proyecto:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error interno al crear el proyecto" })
    };
  }
});
