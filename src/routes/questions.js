const express = require("express");
const { asyncHandler } = require("../lib/errors");
const { requireAuth } = require("../middlewares/auth");
const surveyService = require("../services/survey-service");

const router = express.Router();

router.use(requireAuth);

router.post(
  "/:questionId/options",
  asyncHandler(async (req, res) => {
    const survey = await surveyService.createOption(req.user.id, req.params.questionId, req.body);
    res.status(201).json({ data: survey });
  }),
);

router.patch(
  "/:questionId/options/:optionId",
  asyncHandler(async (req, res) => {
    const survey = await surveyService.updateOption(
      req.user.id,
      req.params.questionId,
      req.params.optionId,
      req.body,
    );
    res.status(200).json({ data: survey });
  }),
);

router.delete(
  "/:questionId/options/:optionId",
  asyncHandler(async (req, res) => {
    const survey = await surveyService.deleteOption(
      req.user.id,
      req.params.questionId,
      req.params.optionId,
    );
    res.status(200).json({ data: survey });
  }),
);

module.exports = router;

