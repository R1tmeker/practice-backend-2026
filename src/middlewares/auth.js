const db = require("../db");
const { verifyToken } = require("../lib/jwt");
const { AppError } = require("../lib/errors");

async function requireAuth(req, _res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new AppError(401, "auth_required", "Bearer token is required");
    }

    const token = authorization.slice("Bearer ".length);
    const payload = verifyToken(token);
    const result = await db.query(
      `
        SELECT id, email, display_name, created_at, updated_at
        FROM users
        WHERE id = $1
      `,
      [payload.sub],
    );

    if (result.rowCount === 0) {
      throw new AppError(401, "invalid_token", "User referenced by token does not exist");
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireAuth,
};

