class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function mapPostgresError(error) {
  if (error.code === "23505") {
    return new AppError(409, "conflict", "Resource already exists");
  }

  if (error.code === "23503") {
    return new AppError(400, "invalid_reference", "Referenced resource does not exist");
  }

  if (error.code === "22P02") {
    return new AppError(400, "invalid_id", "Identifier format is invalid");
  }

  return null;
}

function errorMiddleware(error, _req, res, _next) {
  const normalizedError = error instanceof AppError ? error : mapPostgresError(error);

  if (normalizedError) {
    return res.status(normalizedError.statusCode).json({
      error: {
        code: normalizedError.code,
        message: normalizedError.message,
        details: normalizedError.details || null,
      },
    });
  }

  console.error(error);

  return res.status(500).json({
    error: {
      code: "internal_error",
      message: "Internal server error",
      details: null,
    },
  });
}

module.exports = {
  AppError,
  asyncHandler,
  errorMiddleware,
};

