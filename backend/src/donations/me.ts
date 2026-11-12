import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { withAuthz } from "../authz/withAuthz.js";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = withAuthz(async (event, principal) => {
  try {
    const command = new QueryCommand({
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
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Error al recuperar el historial" }) };
  }
});