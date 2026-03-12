const path = require("node:path");
const express = require("express");
const authRoutes = require("./routes/auth");
const publicRoutes = require("./routes/public");
const questionRoutes = require("./routes/questions");
const surveyRoutes = require("./routes/surveys");
const { errorMiddleware } = require("./lib/errors");

const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/openapi.yaml", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "..", "docs", "openapi.yaml"));
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/public", publicRoutes);
app.use("/api/v1/questions", questionRoutes);
app.use("/api/v1/surveys", surveyRoutes);

app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: "not_found",
      message: "Route not found",
      details: null,
    },
  });
});

app.use(errorMiddleware);

module.exports = app;
