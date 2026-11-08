
exports.handler = async () => {
  return {
    statusCode: 501,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      code: "NOT_IMPLEMENTED",
      message: "Listado pendiente de integrar con DynamoDB"
    })
  };
};
