const db = require("../db");
const { createToken } = require("../lib/jwt");
const { AppError } = require("../lib/errors");
const { logBusinessEvent } = require("../lib/logging");
const { hashPassword, verifyPassword } = require("../lib/password");
const { ensureEmail, ensureObject, ensureString } = require("../lib/validation");

function mapUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildAuthResponse(user) {
  const token = createToken({
    sub: user.id,
    email: user.email,
    displayName: user.displayName,
  });

  return {
    token,
    user,
  };
}

async function register(payload) {
  ensureObject(payload, "body");

  const email = ensureEmail(payload.email, "email");
  const password = ensureString(payload.password, "password", {
    minLength: 8,
    maxLength: 128,
  });
  const displayName = ensureString(payload.displayName, "displayName", {
    minLength: 2,
    maxLength: 100,
  });

  const passwordHash = hashPassword(password);

  let result;
  try {
    result = await db.query(
      `
        INSERT INTO users (email, password_hash, display_name)
        VALUES ($1, $2, $3)
        RETURNING id, email, display_name, created_at, updated_at
      `,
      [email, passwordHash, displayName],
    );
  } catch (error) {
    if (error.code === "23505") {
      throw new AppError(409, "email_taken", "User with this email already exists");
    }

    throw error;
  }

  const user = mapUser(result.rows[0]);
  logBusinessEvent("auth.registered", {
    userId: user.id,
    email: user.email,
  });

  return buildAuthResponse(user);
}

async function login(payload) {
  ensureObject(payload, "body");

  const email = ensureEmail(payload.email, "email");
  const password = ensureString(payload.password, "password", {
    minLength: 8,
    maxLength: 128,
  });

  const result = await db.query(
    `
      SELECT id, email, password_hash, display_name, created_at, updated_at
      FROM users
      WHERE email = $1
    `,
    [email],
  );

  if (result.rowCount === 0) {
    throw new AppError(401, "invalid_credentials", "Email or password is incorrect");
  }

  const row = result.rows[0];
  if (!verifyPassword(password, row.password_hash)) {
    throw new AppError(401, "invalid_credentials", "Email or password is incorrect");
  }

  const user = mapUser(row);
  logBusinessEvent("auth.logged_in", {
    userId: user.id,
    email: user.email,
  });

  return buildAuthResponse(user);
}

module.exports = {
  login,
  register,
};

