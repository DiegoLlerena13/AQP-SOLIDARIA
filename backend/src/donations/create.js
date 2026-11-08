
exports.handler = async (event) => {
  const claims =
    event.requestContext?.authorizer?.jwt?.claims;

  const groups = claims?.["cognito:groups"];
  const roles = Array.isArray(groups)
    ? groups
    : typeof groups === "string"
      ? groups.split(/[,\s]+/).filter(Boolean)
      : [];

  if (!claims?.sub) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        code: "UNAUTHORIZED",
        message: "Autenticación requerida"
      })
    };
  }

  if (!roles.includes("DONANTE")) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        code: "FORBIDDEN",
        message: "Permiso insuficiente"
      })
    };
  }

  return {
    statusCode: 501,
    body: JSON.stringify({
      code: "NOT_IMPLEMENTED",
      message: "Integración de donaciones pendiente"
    })
  };
};
