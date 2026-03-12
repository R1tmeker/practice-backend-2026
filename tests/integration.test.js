process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgres://survey_user:survey_password@localhost:5432/survey_api_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

const app = require("../src/app");
const db = require("../src/db");
const { migrateDatabase } = require("../src/lib/migrations");

let server;
let baseUrl;

async function request(path, options = {}) {
  const headers = {
    "content-type": "application/json",
    ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  return {
    status: response.status,
    body: json,
  };
}

async function truncateData() {
  await db.query(
    `
      TRUNCATE answer_options, answers, responses, question_options, questions, surveys, users
      RESTART IDENTITY CASCADE
    `,
  );
}

async function registerUser(user) {
  const response = await request("/api/v1/auth/register", {
    method: "POST",
    body: user,
  });

  assert.equal(response.status, 201);
  return response.body;
}

async function createPublishedSurvey(authorToken) {
  const surveyResponse = await request("/api/v1/surveys", {
    method: "POST",
    token: authorToken,
    body: {
      title: "Quarterly Feedback",
      description: "Team feedback survey",
    },
  });
  assert.equal(surveyResponse.status, 201);
  const surveyId = surveyResponse.body.data.id;

  const singleChoiceQuestion = await request(`/api/v1/surveys/${surveyId}/questions`, {
    method: "POST",
    token: authorToken,
    body: {
      prompt: "How clear are the priorities?",
      type: "single_choice",
      isRequired: true,
    },
  });
  assert.equal(singleChoiceQuestion.status, 201);
  const question1Id = singleChoiceQuestion.body.data.questions[0].id;

  const option1 = await request(`/api/v1/questions/${question1Id}/options`, {
    method: "POST",
    token: authorToken,
    body: {
      label: "Very clear",
    },
  });
  assert.equal(option1.status, 201);

  const option2 = await request(`/api/v1/questions/${question1Id}/options`, {
    method: "POST",
    token: authorToken,
    body: {
      label: "Needs improvement",
    },
  });
  assert.equal(option2.status, 201);

  const textQuestion = await request(`/api/v1/surveys/${surveyId}/questions`, {
    method: "POST",
    token: authorToken,
    body: {
      prompt: "What should we improve next?",
      type: "text",
      isRequired: false,
    },
  });
  assert.equal(textQuestion.status, 201);

  const publishResponse = await request(`/api/v1/surveys/${surveyId}/publish`, {
    method: "POST",
    token: authorToken,
  });
  assert.equal(publishResponse.status, 200);

  return {
    surveyId,
    question1Id,
    question2Id: publishResponse.body.data.questions.find((question) => question.type === "text").id,
    optionIds: publishResponse.body.data.questions.find((question) => question.id === question1Id).options.map(
      (option) => option.id,
    ),
  };
}

test.before(async () => {
  await migrateDatabase(process.env.DATABASE_URL);
  server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.beforeEach(async () => {
  await truncateData();
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

test("registers user, returns token and current profile", async () => {
  const auth = await registerUser({
    email: "author@example.com",
    password: "Password123",
    displayName: "Author",
  });

  assert.ok(auth.token);
  assert.equal(auth.user.email, "author@example.com");

  const meResponse = await request("/api/v1/auth/me", {
    token: auth.token,
  });

  assert.equal(meResponse.status, 200);
  assert.equal(meResponse.body.user.displayName, "Author");
});

test("creates a survey and publishes it after adding questions and options", async () => {
  const author = await registerUser({
    email: "author@example.com",
    password: "Password123",
    displayName: "Author",
  });

  const survey = await createPublishedSurvey(author.token);
  const detailResponse = await request(`/api/v1/surveys/${survey.surveyId}`, {
    token: author.token,
  });

  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.body.data.status, "published");
  assert.equal(detailResponse.body.data.questions.length, 2);
});

test("rejects adding options to a text question", async () => {
  const author = await registerUser({
    email: "author@example.com",
    password: "Password123",
    displayName: "Author",
  });

  const surveyResponse = await request("/api/v1/surveys", {
    method: "POST",
    token: author.token,
    body: {
      title: "Text survey",
      description: "Only text question",
    },
  });
  const surveyId = surveyResponse.body.data.id;

  const questionResponse = await request(`/api/v1/surveys/${surveyId}/questions`, {
    method: "POST",
    token: author.token,
    body: {
      prompt: "Tell us more",
      type: "text",
      isRequired: true,
    },
  });
  const questionId = questionResponse.body.data.questions[0].id;

  const optionResponse = await request(`/api/v1/questions/${questionId}/options`, {
    method: "POST",
    token: author.token,
    body: {
      label: "Should fail",
    },
  });

  assert.equal(optionResponse.status, 409);
  assert.equal(optionResponse.body.error.code, "invalid_question_type");
});

test("rejects structural edits after survey is published", async () => {
  const author = await registerUser({
    email: "author@example.com",
    password: "Password123",
    displayName: "Author",
  });

  const survey = await createPublishedSurvey(author.token);
  const patchResponse = await request(
    `/api/v1/surveys/${survey.surveyId}/questions/${survey.question1Id}`,
    {
      method: "PATCH",
      token: author.token,
      body: {
        prompt: "Updated prompt",
      },
    },
  );

  assert.equal(patchResponse.status, 409);
  assert.equal(patchResponse.body.error.code, "invalid_status");
});

test("prevents duplicate survey submissions", async () => {
  const author = await registerUser({
    email: "author@example.com",
    password: "Password123",
    displayName: "Author",
  });
  const respondent = await registerUser({
    email: "respondent@example.com",
    password: "Password123",
    displayName: "Respondent",
  });

  const survey = await createPublishedSurvey(author.token);
  const firstResponse = await request(`/api/v1/public/surveys/${survey.surveyId}/responses`, {
    method: "POST",
    token: respondent.token,
    body: {
      answers: [
        {
          questionId: survey.question1Id,
          optionIds: [survey.optionIds[0]],
        },
      ],
    },
  });

  assert.equal(firstResponse.status, 201);

  const duplicateResponse = await request(`/api/v1/public/surveys/${survey.surveyId}/responses`, {
    method: "POST",
    token: respondent.token,
    body: {
      answers: [
        {
          questionId: survey.question1Id,
          optionIds: [survey.optionIds[1]],
        },
      ],
    },
  });

  assert.equal(duplicateResponse.status, 409);
  assert.equal(duplicateResponse.body.error.code, "already_responded");
});

test("builds analytics with counts, percentages and text answers", async () => {
  const author = await registerUser({
    email: "author@example.com",
    password: "Password123",
    displayName: "Author",
  });
  const respondent = await registerUser({
    email: "respondent@example.com",
    password: "Password123",
    displayName: "Respondent",
  });

  const survey = await createPublishedSurvey(author.token);
  const response = await request(`/api/v1/public/surveys/${survey.surveyId}/responses`, {
    method: "POST",
    token: respondent.token,
    body: {
      answers: [
        {
          questionId: survey.question1Id,
          optionIds: [survey.optionIds[0]],
        },
        {
          questionId: survey.question2Id,
          textValue: "More planning transparency",
        },
      ],
    },
  });
  assert.equal(response.status, 201);

  const analytics = await request(`/api/v1/surveys/${survey.surveyId}/analytics`, {
    token: author.token,
  });

  assert.equal(analytics.status, 200);
  assert.equal(analytics.body.data.respondentCount, 1);

  const choiceQuestion = analytics.body.data.questions.find(
    (question) => question.questionId === survey.question1Id,
  );
  assert.equal(choiceQuestion.options[0].selectedCount, 1);
  assert.equal(choiceQuestion.options[0].selectedPercent, 100);

  const textQuestion = analytics.body.data.questions.find(
    (question) => question.questionId === survey.question2Id,
  );
  assert.equal(textQuestion.textAnswers[0].value, "More planning transparency");
});

