"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = async () => {
    return {
        statusCode: 200,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            status: "ok",
            application: "AQP-SOLIDARIA",
            environment: "academic"
        })
    };
};
