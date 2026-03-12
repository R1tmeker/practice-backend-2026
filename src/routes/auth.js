const express = require("express");
const { asyncHandler } = require("../lib/errors");
const { requireAuth } = require("../middlewares/auth");
const authService = require("../services/auth-service");

const router = express.Router();

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.status(200).json({
      user: {
        id: req.user.id,
        email: req.user.email,
        displayName: req.user.display_name,
        createdAt: req.user.created_at,
        updatedAt: req.user.updated_at,
      },
    });
  }),
);

module.exports = router;

