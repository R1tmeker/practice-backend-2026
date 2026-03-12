const crypto = require("node:crypto");
const config = require("../config");
const { AppError } = require("./errors");

function base64urlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64urlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signSegment(segment) {
  return crypto.createHmac("sha256", config.jwtSecret).update(segment).digest("base64url");
}

function createToken(payload) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + config.tokenTtlSeconds,
  };

  const unsignedToken = `${base64urlEncode(JSON.stringify(header))}.${base64urlEncode(JSON.stringify(fullPayload))}`;
  const signature = signSegment(unsignedToken);
  return `${unsignedToken}.${signature}`;
}

function verifyToken(token) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new AppError(401, "invalid_token", "Token format is invalid");
  }

  const [headerSegment, payloadSegment, signature] = parts;
  const expectedSignature = signSegment(`${headerSegment}.${payloadSegment}`);

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new AppError(401, "invalid_token", "Token signature is invalid");
  }

  const header = JSON.parse(base64urlDecode(headerSegment));
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new AppError(401, "invalid_token", "Token header is invalid");
  }

  const payload = JSON.parse(base64urlDecode(payloadSegment));
  const now = Math.floor(Date.now() / 1000);

  if (!payload.exp || payload.exp < now) {
    throw new AppError(401, "token_expired", "Token has expired");
  }

  return payload;
}

module.exports = {
  createToken,
  verifyToken,
};

