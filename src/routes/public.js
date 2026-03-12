const express = require("express");
const { asyncHandler } = require("../lib/errors");
const { requireAuth } = require("../middlewares/auth");
const surveyService = require("../services/survey-service");

const router = express.Router();

router.get(
  "/surveys/:surveyId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const survey = await surveyService.getPublicSurvey(req.params.surveyId);
    res.status(200).json({ data: survey });
  }),
);

router.post(
  "/surveys/:surveyId/responses",
  requireAuth,
  asyncHandler(async (req, res) => {
    const response = await surveyService.submitSurveyResponse(
      req.user.id,
      req.params.surveyId,
      req.body,
    );
    res.status(201).json({ data: response });
  }),
);

module.exports = router;

