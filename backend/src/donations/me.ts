import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { withAuthz, type Principal } from "../authz/index.js";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = withAuthz(async (event: any, principal: Principal) => {
  // 1. Identidad verificada por withAuthz (Zero Trust CA-04.3, CA-07.1)
  const donorSub = principal.sub;

  // 2. Consulta a DynamoDB usando el Índice Secundario Global (GSI)
  try {
    const command = new QueryCommand({
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

  } catch (error: any) {
    console.error("Error al consultar el historial:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error al recuperar el historial" })
    };
  }
});
