const { AppError } = require("./errors");

function ensureObject(value, fieldName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(400, "validation_error", `${fieldName} must be an object`);
  }
}

function ensureString(value, fieldName, options = {}) {
  const {
    minLength = 1,
    maxLength = 1000,
    optional = false,
    allowEmpty = false,
    trim = true,
  } = options;

  if (value == null) {
    if (optional) {
      return null;
    }
    throw new AppError(400, "validation_error", `${fieldName} is required`);
  }

  if (typeof value !== "string") {
    throw new AppError(400, "validation_error", `${fieldName} must be a string`);
  }

  const normalizedValue = trim ? value.trim() : value;

  if (!allowEmpty && normalizedValue.length === 0) {
    throw new AppError(400, "validation_error", `${fieldName} must not be empty`);
  }

  if (normalizedValue.length < minLength) {
    throw new AppError(400, "validation_error", `${fieldName} must be at least ${minLength} characters`);
  }

  if (normalizedValue.length > maxLength) {
    throw new AppError(400, "validation_error", `${fieldName} must be at most ${maxLength} characters`);
  }

  return normalizedValue;
}

function ensureEmail(value, fieldName) {
  const normalizedValue = ensureString(value, fieldName, {
    minLength: 5,
    maxLength: 255,
  }).toLowerCase();

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalizedValue)) {
    throw new AppError(400, "validation_error", `${fieldName} must be a valid email`);
  }

  return normalizedValue;
}

function ensureEnum(value, fieldName, allowedValues, options = {}) {
  const { optional = false } = options;

  if (value == null) {
    if (optional) {
      return null;
    }
    throw new AppError(400, "validation_error", `${fieldName} is required`);
  }

  if (!allowedValues.includes(value)) {
    throw new AppError(
      400,
      "validation_error",
      `${fieldName} must be one of: ${allowedValues.join(", ")}`,
    );
  }

  return value;
}

function ensureBoolean(value, fieldName, options = {}) {
  const { optional = false, defaultValue = null } = options;

  if (value == null) {
    if (optional) {
      return defaultValue;
    }
    throw new AppError(400, "validation_error", `${fieldName} is required`);
  }

  if (typeof value !== "boolean") {
    throw new AppError(400, "validation_error", `${fieldName} must be a boolean`);
  }

  return value;
}

function ensureInteger(value, fieldName, options = {}) {
  const {
    optional = false,
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
    defaultValue = null,
  } = options;

  if (value == null) {
    if (optional) {
      return defaultValue;
    }
    throw new AppError(400, "validation_error", `${fieldName} is required`);
  }

  if (!Number.isInteger(value)) {
    throw new AppError(400, "validation_error", `${fieldName} must be an integer`);
  }

  if (value < min || value > max) {
    throw new AppError(400, "validation_error", `${fieldName} must be between ${min} and ${max}`);
  }

  return value;
}

function ensureArray(value, fieldName, options = {}) {
  const { optional = false, minLength = 0, maxLength = Number.MAX_SAFE_INTEGER } = options;

  if (value == null) {
    if (optional) {
      return [];
    }
    throw new AppError(400, "validation_error", `${fieldName} is required`);
  }

  if (!Array.isArray(value)) {
    throw new AppError(400, "validation_error", `${fieldName} must be an array`);
  }

  if (value.length < minLength || value.length > maxLength) {
    throw new AppError(
      400,
      "validation_error",
      `${fieldName} must contain between ${minLength} and ${maxLength} items`,
    );
  }

  return value;
}

function ensureUniqueStrings(values, fieldName) {
  const normalizedValues = new Set(values);
  if (normalizedValues.size !== values.length) {
    throw new AppError(400, "validation_error", `${fieldName} must not contain duplicates`);
  }
}

function parsePagination(query) {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 10;

  if (!Number.isInteger(page) || page < 1) {
    throw new AppError(400, "validation_error", "page must be a positive integer");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new AppError(400, "validation_error", "limit must be an integer between 1 and 50");
  }

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

module.exports = {
  ensureArray,
  ensureBoolean,
  ensureEmail,
  ensureEnum,
  ensureInteger,
  ensureObject,
  ensureString,
  ensureUniqueStrings,
  parsePagination,
};

