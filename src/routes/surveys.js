const express = require("express");
const { asyncHandler } = require("../lib/errors");
const { requireAuth } = require("../middlewares/auth");
const surveyService = require("../services/survey-service");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const surveys = await surveyService.listSurveys(req.user.id, req.query);
    res.status(200).json(surveys);
  }),
);

router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const surveys = await surveyService.listSurveys(req.user.id, {
      ...req.query,
      scope: "mine",
    });
    res.status(200).json(surveys);
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const survey = await surveyService.createSurvey(req.user.id, req.body);
    res.status(201).json({ data: survey });
  }),
);

router.get(
  "/:surveyId",
  asyncHandler(async (req, res) => {
    const survey = await surveyService.getSurvey(req.user.id, req.params.surveyId);
    res.status(200).json({ data: survey });
  }),
);

router.patch(
  "/:surveyId",
  asyncHandler(async (req, res) => {
    const survey = await surveyService.updateSurvey(req.user.id, req.params.surveyId, req.body);
    res.status(200).json({ data: survey });
  }),
);

router.delete(
  "/:surveyId",
  asyncHandler(async (req, res) => {
    const result = await surveyService.deleteSurvey(req.user.id, req.params.surveyId);
    res.status(200).json({ data: result });
  }),
);

router.post(
  "/:surveyId/questions",
  asyncHandler(async (req, res) => {
    const survey = await surveyService.createQuestion(req.user.id, req.params.surveyId, req.body);
    res.status(201).json({ data: survey });
  }),
);

router.patch(
  "/:surveyId/questions/:questionId",
  asyncHandler(async (req, res) => {
    const survey = await surveyService.updateQuestion(
      req.user.id,
      req.params.surveyId,
      req.params.questionId,
      req.body,
    );
    res.status(200).json({ data: survey });
  }),
);

router.delete(
  "/:surveyId/questions/:questionId",
  asyncHandler(async (req, res) => {
    const survey = await surveyService.deleteQuestion(
      req.user.id,
      req.params.surveyId,
      req.params.questionId,
    );
    res.status(200).json({ data: survey });
  }),
);

router.post(
  "/:surveyId/publish",
  asyncHandler(async (req, res) => {
    const survey = await surveyService.publishSurvey(req.user.id, req.params.surveyId);
    res.status(200).json({ data: survey });
  }),
);

router.post(
  "/:surveyId/close",
  asyncHandler(async (req, res) => {
    const survey = await surveyService.closeSurvey(req.user.id, req.params.surveyId);
    res.status(200).json({ data: survey });
  }),
);

router.get(
  "/:surveyId/analytics",
  asyncHandler(async (req, res) => {
    const analytics = await surveyService.getAnalytics(req.user.id, req.params.surveyId);
    res.status(200).json({ data: analytics });
  }),
);

router.get(
  "/:surveyId/analytics/export",
  asyncHandler(async (req, res) => {
    const analytics = await surveyService.exportAnalytics(req.user.id, req.params.surveyId);
    res.status(200).json({ data: analytics });
  }),
);

module.exports = router;

