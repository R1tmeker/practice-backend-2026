require("dotenv").config({ quiet: true });

const port = Number(process.env.PORT || 3000);
const tokenTtlSeconds = Number(process.env.TOKEN_TTL_SECONDS || 86400);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be a positive integer");
}

if (!Number.isInteger(tokenTtlSeconds) || tokenTtlSeconds <= 0) {
  throw new Error("TOKEN_TTL_SECONDS must be a positive integer");
}

module.exports = {
  port,
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://survey_user:survey_password@localhost:5432/survey_api",
  testDatabaseUrl:
    process.env.TEST_DATABASE_URL ||
    "postgres://survey_user:survey_password@localhost:5432/survey_api_test",
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
  tokenTtlSeconds,
};

