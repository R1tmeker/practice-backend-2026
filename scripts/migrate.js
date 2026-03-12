require("dotenv").config({ quiet: true });

const { migrateDatabase } = require("../src/lib/migrations");

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgres://survey_user:survey_password@localhost:5432/survey_api";

migrateDatabase(databaseUrl).catch((error) => {
  console.error("Migration failed");
  console.error(error);
  process.exit(1);
});
