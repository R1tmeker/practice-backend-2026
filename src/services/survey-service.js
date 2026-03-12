const db = require("../db");
const { AppError } = require("../lib/errors");
const { logBusinessEvent } = require("../lib/logging");
const {
  ensureArray,
  ensureBoolean,
  ensureEnum,
  ensureInteger,
  ensureObject,
  ensureString,
  parsePagination,
} = require("../lib/validation");

const QUESTION_TYPES = ["single_choice", "multiple_choice", "text"];
const SURVEY_STATUSES = ["draft", "published", "closed"];

const POSITION_TABLES = {
  questions: {
    tableName: "questions",
    scopeColumn: "survey_id",
  },
  question_options: {
    tableName: "question_options",
    scopeColumn: "question_id",
  },
};

function mapSurveyRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    publishedAt: row.published_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.author_id,
      displayName: row.author_display_name,
      email: row.author_email,
    },
    metrics: {
      responsesCount: Number(row.responses_count || 0),
      questionsCount: Number(row.questions_count || 0),
    },
  };
}

function mapQuestionRows(rows) {
  const questions = [];
  const questionsById = new Map();

  for (const row of rows) {
    let question = questionsById.get(row.id);

    if (!question) {
      question = {
        id: row.id,
        surveyId: row.survey_id,
        type: row.type,
        prompt: row.prompt,
        position: row.position,
        isRequired: row.is_required,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        options: [],
      };
      questionsById.set(row.id, question);
      questions.push(question);
    }

    if (row.option_id) {
      question.options.push({
        id: row.option_id,
        label: row.option_label,
        position: row.option_position,
        createdAt: row.option_created_at,
      });
    }
  }

  return questions;
}

async function fetchSurveyRow(client, surveyId) {
  const result = await client.query(
    `
      SELECT
        s.id,
        s.author_id,
        s.title,
        s.description,
        s.status,
        s.published_at,
        s.closed_at,
        s.created_at,
        s.updated_at,
        u.display_name AS author_display_name,
        u.email AS author_email,
        COALESCE(rc.responses_count, 0)::int AS responses_count,
        COALESCE(qc.questions_count, 0)::int AS questions_count
      FROM surveys s
      JOIN users u ON u.id = s.author_id
      LEFT JOIN (
        SELECT survey_id, COUNT(*)::int AS responses_count
        FROM responses
        GROUP BY survey_id
      ) rc ON rc.survey_id = s.id
      LEFT JOIN (
        SELECT survey_id, COUNT(*)::int AS questions_count
        FROM questions
        GROUP BY survey_id
      ) qc ON qc.survey_id = s.id
      WHERE s.id = $1
    `,
    [surveyId],
  );

  return result.rows[0] || null;
}

async function fetchSurveyQuestions(client, surveyId) {
  const result = await client.query(
    `
      SELECT
        q.id,
        q.survey_id,
        q.type,
        q.prompt,
        q.position,
        q.is_required,
        q.created_at,
        q.updated_at,
        qo.id AS option_id,
        qo.label AS option_label,
        qo.position AS option_position,
        qo.created_at AS option_created_at
      FROM questions q
      LEFT JOIN question_options qo ON qo.question_id = q.id
      WHERE q.survey_id = $1
      ORDER BY q.position ASC, qo.position ASC
    `,
    [surveyId],
  );

  return mapQuestionRows(result.rows);
}

async function hydrateSurvey(client, surveyId) {
  const surveyRow = await fetchSurveyRow(client, surveyId);
  if (!surveyRow) {
    return null;
  }

  const questions = await fetchSurveyQuestions(client, surveyId);

  return {
    ...mapSurveyRow(surveyRow),
    questions,
  };
}

async function ensureOwnedSurvey(client, surveyId, userId) {
  const survey = await fetchSurveyRow(client, surveyId);

  if (!survey) {
    throw new AppError(404, "survey_not_found", "Survey not found");
  }

  if (survey.author_id !== userId) {
    throw new AppError(403, "forbidden", "You do not have access to this survey");
  }

  return survey;
}

async function ensureDraftSurvey(client, surveyId, userId) {
  const survey = await ensureOwnedSurvey(client, surveyId, userId);

  if (survey.status !== "draft") {
    throw new AppError(409, "invalid_status", "Survey can be changed only while it is in draft status");
  }

  return survey;
}

async function ensurePublishedSurvey(client, surveyId, userId) {
  const survey = await ensureOwnedSurvey(client, surveyId, userId);

  if (survey.status !== "published") {
    throw new AppError(409, "invalid_status", "Survey must be published before it can be closed");
  }

  return survey;
}

async function ensureQuestionOwned(client, questionId, userId) {
  const result = await client.query(
    `
      SELECT
        q.id,
        q.survey_id,
        q.type,
        q.prompt,
        q.position,
        q.is_required,
        s.author_id,
        s.status
      FROM questions q
      JOIN surveys s ON s.id = q.survey_id
      WHERE q.id = $1
    `,
    [questionId],
  );

  if (result.rowCount === 0) {
    throw new AppError(404, "question_not_found", "Question not found");
  }

  const question = result.rows[0];
  if (question.author_id !== userId) {
    throw new AppError(403, "forbidden", "You do not have access to this question");
  }

  if (question.status !== "draft") {
    throw new AppError(409, "invalid_status", "Survey structure can be changed only in draft status");
  }

  return question;
}

async function ensureOptionOwned(client, optionId, userId) {
  const result = await client.query(
    `
      SELECT
        qo.id,
        qo.question_id,
        qo.label,
        qo.position,
        q.type AS question_type,
        q.survey_id,
        s.author_id,
        s.status
      FROM question_options qo
      JOIN questions q ON q.id = qo.question_id
      JOIN surveys s ON s.id = q.survey_id
      WHERE qo.id = $1
    `,
    [optionId],
  );

  if (result.rowCount === 0) {
    throw new AppError(404, "option_not_found", "Option not found");
  }

  const option = result.rows[0];
  if (option.author_id !== userId) {
    throw new AppError(403, "forbidden", "You do not have access to this option");
  }

  if (option.status !== "draft") {
    throw new AppError(409, "invalid_status", "Survey structure can be changed only in draft status");
  }

  return option;
}

async function countScopedRecords(client, tableKey, scopeValue) {
  const config = POSITION_TABLES[tableKey];
  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM ${config.tableName} WHERE ${config.scopeColumn} = $1`,
    [scopeValue],
  );

  return result.rows[0].count;
}

async function shiftPositionsForInsert(client, tableKey, scopeValue, newPosition) {
  const config = POSITION_TABLES[tableKey];
  await client.query(
    `
      UPDATE ${config.tableName}
      SET position = position + 1
      WHERE ${config.scopeColumn} = $1
        AND position >= $2
    `,
    [scopeValue, newPosition],
  );
}

async function shiftPositionsForMove(client, tableKey, scopeValue, currentPosition, newPosition) {
  const config = POSITION_TABLES[tableKey];

  if (newPosition === currentPosition) {
    return;
  }

  if (newPosition < currentPosition) {
    await client.query(
      `
        UPDATE ${config.tableName}
        SET position = position + 1
        WHERE ${config.scopeColumn} = $1
          AND position >= $2
          AND position < $3
      `,
      [scopeValue, newPosition, currentPosition],
    );
    return;
  }

  await client.query(
    `
      UPDATE ${config.tableName}
      SET position = position - 1
      WHERE ${config.scopeColumn} = $1
        AND position > $2
        AND position <= $3
    `,
    [scopeValue, currentPosition, newPosition],
  );
}

async function closeGapAfterDelete(client, tableKey, scopeValue, removedPosition) {
  const config = POSITION_TABLES[tableKey];
  await client.query(
    `
      UPDATE ${config.tableName}
      SET position = position - 1
      WHERE ${config.scopeColumn} = $1
        AND position > $2
    `,
    [scopeValue, removedPosition],
  );
}

async function resolveInsertPosition(client, tableKey, scopeValue, requestedPosition) {
  const count = await countScopedRecords(client, tableKey, scopeValue);

  if (requestedPosition == null) {
    return count + 1;
  }

  return ensureInteger(requestedPosition, "position", {
    min: 1,
    max: count + 1,
  });
}

async function resolveMovePosition(client, tableKey, scopeValue, requestedPosition, currentPosition) {
  if (requestedPosition == null) {
    return currentPosition;
  }

  const count = await countScopedRecords(client, tableKey, scopeValue);
  return ensureInteger(requestedPosition, "position", {
    min: 1,
    max: count,
  });
}

function validateSurveyPayload(payload) {
  ensureObject(payload, "body");

  return {
    title: ensureString(payload.title, "title", {
      minLength: 3,
      maxLength: 150,
    }),
    description: ensureString(payload.description, "description", {
      minLength: 0,
      maxLength: 2000,
      optional: true,
      allowEmpty: true,
    }),
  };
}

function validateQuestionPayload(payload, options = {}) {
  ensureObject(payload, "body");

  if (!options.allowPartial) {
    return {
      prompt: ensureString(payload.prompt, "prompt", {
        minLength: 3,
        maxLength: 1000,
      }),
      type: ensureEnum(payload.type, "type", QUESTION_TYPES),
      isRequired: ensureBoolean(payload.isRequired, "isRequired", {
        optional: true,
        defaultValue: true,
      }),
      position: payload.position == null ? null : ensureInteger(payload.position, "position", { min: 1 }),
    };
  }

  const normalizedPayload = {};

  if (payload.prompt !== undefined) {
    normalizedPayload.prompt = ensureString(payload.prompt, "prompt", {
      minLength: 3,
      maxLength: 1000,
    });
  }

  if (payload.type !== undefined) {
    normalizedPayload.type = ensureEnum(payload.type, "type", QUESTION_TYPES);
  }

  if (payload.isRequired !== undefined) {
    normalizedPayload.isRequired = ensureBoolean(payload.isRequired, "isRequired");
  }

  if (payload.position !== undefined) {
    normalizedPayload.position = ensureInteger(payload.position, "position", { min: 1 });
  }

  if (Object.keys(normalizedPayload).length === 0) {
    throw new AppError(400, "validation_error", "At least one field must be provided");
  }

  return normalizedPayload;
}

function validateOptionPayload(payload, options = {}) {
  ensureObject(payload, "body");

  if (!options.allowPartial) {
    return {
      label: ensureString(payload.label, "label", {
        minLength: 1,
        maxLength: 255,
      }),
      position: payload.position == null ? null : ensureInteger(payload.position, "position", { min: 1 }),
    };
  }

  const normalizedPayload = {};

  if (payload.label !== undefined) {
    normalizedPayload.label = ensureString(payload.label, "label", {
      minLength: 1,
      maxLength: 255,
    });
  }

  if (payload.position !== undefined) {
    normalizedPayload.position = ensureInteger(payload.position, "position", { min: 1 });
  }

  if (Object.keys(normalizedPayload).length === 0) {
    throw new AppError(400, "validation_error", "At least one field must be provided");
  }

  return normalizedPayload;
}

async function listSurveys(userId, query) {
  const scope = query.scope || "mine";
  const status = query.status ? ensureEnum(query.status, "status", SURVEY_STATUSES) : null;
  const sortBy = query.sort_by || "created_at";
  const sortOrder = query.sort_order === "asc" ? "ASC" : "DESC";
  const pagination = parsePagination(query);

  if (!["mine", "active", "completed"].includes(scope)) {
    throw new AppError(400, "validation_error", "scope must be one of: mine, active, completed");
  }

  const sortMap = {
    created_at: "s.created_at",
    published_at: "s.published_at",
    responses_count: "COALESCE(rc.responses_count, 0)",
    title: "s.title",
  };

  if (!sortMap[sortBy]) {
    throw new AppError(
      400,
      "validation_error",
      "sort_by must be one of: created_at, published_at, responses_count, title",
    );
  }

  const conditions = [];
  const params = [];

  if (scope === "mine") {
    params.push(userId);
    conditions.push(`s.author_id = $${params.length}`);
  }

  if (scope === "active") {
    conditions.push(`s.status = 'published'`);
  }

  if (scope === "completed") {
    conditions.push(`s.status = 'closed'`);
  }

  if (status) {
    params.push(status);
    conditions.push(`s.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM surveys s
      ${whereClause}
    `,
    params,
  );

  const listParams = [...params, pagination.limit, pagination.offset];
  const rows = await db.query(
    `
      SELECT
        s.id,
        s.author_id,
        s.title,
        s.description,
        s.status,
        s.published_at,
        s.closed_at,
        s.created_at,
        s.updated_at,
        u.display_name AS author_display_name,
        u.email AS author_email,
        COALESCE(rc.responses_count, 0)::int AS responses_count,
        COALESCE(qc.questions_count, 0)::int AS questions_count
      FROM surveys s
      JOIN users u ON u.id = s.author_id
      LEFT JOIN (
        SELECT survey_id, COUNT(*)::int AS responses_count
        FROM responses
        GROUP BY survey_id
      ) rc ON rc.survey_id = s.id
      LEFT JOIN (
        SELECT survey_id, COUNT(*)::int AS questions_count
        FROM questions
        GROUP BY survey_id
      ) qc ON qc.survey_id = s.id
      ${whereClause}
      ORDER BY ${sortMap[sortBy]} ${sortOrder}, s.created_at DESC
      LIMIT $${listParams.length - 1}
      OFFSET $${listParams.length}
    `,
    listParams,
  );

  return {
    data: rows.rows.map(mapSurveyRow),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: countResult.rows[0].total,
    },
  };
}

async function getSurvey(userId, surveyId) {
  const client = await db.getClient();

  try {
    await ensureOwnedSurvey(client, surveyId, userId);
    return await hydrateSurvey(client, surveyId);
  } finally {
    client.release();
  }
}

async function createSurvey(userId, payload) {
  const { title, description } = validateSurveyPayload(payload);

  return db.withTransaction(async (client) => {
    const result = await client.query(
      `
        INSERT INTO surveys (author_id, title, description)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [userId, title, description],
    );

    logBusinessEvent("survey.created", {
      actorUserId: userId,
      surveyId: result.rows[0].id,
    });

    return hydrateSurvey(client, result.rows[0].id);
  });
}

async function updateSurvey(userId, surveyId, payload) {
  ensureObject(payload, "body");

  const updates = [];
  const params = [];

  if (payload.title !== undefined) {
    params.push(
      ensureString(payload.title, "title", {
        minLength: 3,
        maxLength: 150,
      }),
    );
    updates.push(`title = $${params.length}`);
  }

  if (payload.description !== undefined) {
    params.push(
      ensureString(payload.description, "description", {
        minLength: 0,
        maxLength: 2000,
        allowEmpty: true,
      }),
    );
    updates.push(`description = $${params.length}`);
  }

  if (updates.length === 0) {
    throw new AppError(400, "validation_error", "At least one field must be provided");
  }

  return db.withTransaction(async (client) => {
    await ensureDraftSurvey(client, surveyId, userId);

    params.push(surveyId);
    await client.query(
      `
        UPDATE surveys
        SET ${updates.join(", ")}, updated_at = NOW()
        WHERE id = $${params.length}
      `,
      params,
    );

    return hydrateSurvey(client, surveyId);
  });
}

async function deleteSurvey(userId, surveyId) {
  return db.withTransaction(async (client) => {
    await ensureDraftSurvey(client, surveyId, userId);
    await client.query("DELETE FROM surveys WHERE id = $1", [surveyId]);

    logBusinessEvent("survey.deleted", {
      actorUserId: userId,
      surveyId,
    });

    return { deleted: true };
  });
}

async function createQuestion(userId, surveyId, payload) {
  const normalizedPayload = validateQuestionPayload(payload);

  return db.withTransaction(async (client) => {
    await ensureDraftSurvey(client, surveyId, userId);
    const position = await resolveInsertPosition(
      client,
      "questions",
      surveyId,
      normalizedPayload.position,
    );

    await shiftPositionsForInsert(client, "questions", surveyId, position);

    await client.query(
      `
        INSERT INTO questions (survey_id, type, prompt, position, is_required)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        surveyId,
        normalizedPayload.type,
        normalizedPayload.prompt,
        position,
        normalizedPayload.isRequired,
      ],
    );

    return hydrateSurvey(client, surveyId);
  });
}

async function updateQuestion(userId, surveyId, questionId, payload) {
  const normalizedPayload = validateQuestionPayload(payload, { allowPartial: true });

  return db.withTransaction(async (client) => {
    await ensureDraftSurvey(client, surveyId, userId);

    const question = await ensureQuestionOwned(client, questionId, userId);
    if (question.survey_id !== surveyId) {
      throw new AppError(404, "question_not_found", "Question not found in this survey");
    }

    if (normalizedPayload.type === "text" && question.type !== "text") {
      const optionsCountResult = await client.query(
        "SELECT COUNT(*)::int AS count FROM question_options WHERE question_id = $1",
        [questionId],
      );

      if (optionsCountResult.rows[0].count > 0) {
        throw new AppError(
          409,
          "invalid_question_type",
          "Choice question with existing options cannot be converted to text",
        );
      }
    }

    const newPosition = await resolveMovePosition(
      client,
      "questions",
      surveyId,
      normalizedPayload.position,
      question.position,
    );

    if (newPosition !== question.position) {
      const tempPosition = (await countScopedRecords(client, "questions", surveyId)) + 1;
      await client.query("UPDATE questions SET position = $1 WHERE id = $2", [tempPosition, questionId]);
      await shiftPositionsForMove(client, "questions", surveyId, question.position, newPosition);
    }

    const updates = [];
    const params = [];

    if (normalizedPayload.prompt !== undefined) {
      params.push(normalizedPayload.prompt);
      updates.push(`prompt = $${params.length}`);
    }

    if (normalizedPayload.type !== undefined) {
      params.push(normalizedPayload.type);
      updates.push(`type = $${params.length}`);
    }

    if (normalizedPayload.isRequired !== undefined) {
      params.push(normalizedPayload.isRequired);
      updates.push(`is_required = $${params.length}`);
    }

    params.push(newPosition);
    updates.push(`position = $${params.length}`);

    params.push(questionId);
    await client.query(
      `
        UPDATE questions
        SET ${updates.join(", ")}, updated_at = NOW()
        WHERE id = $${params.length}
      `,
      params,
    );

    return hydrateSurvey(client, surveyId);
  });
}

async function deleteQuestion(userId, surveyId, questionId) {
  return db.withTransaction(async (client) => {
    await ensureDraftSurvey(client, surveyId, userId);

    const question = await ensureQuestionOwned(client, questionId, userId);
    if (question.survey_id !== surveyId) {
      throw new AppError(404, "question_not_found", "Question not found in this survey");
    }

    await client.query("DELETE FROM questions WHERE id = $1", [questionId]);
    await closeGapAfterDelete(client, "questions", surveyId, question.position);

    return hydrateSurvey(client, surveyId);
  });
}

async function createOption(userId, questionId, payload) {
  const normalizedPayload = validateOptionPayload(payload);

  return db.withTransaction(async (client) => {
    const question = await ensureQuestionOwned(client, questionId, userId);

    if (question.type === "text") {
      throw new AppError(409, "invalid_question_type", "Text questions cannot have answer options");
    }

    const position = await resolveInsertPosition(
      client,
      "question_options",
      questionId,
      normalizedPayload.position,
    );

    await shiftPositionsForInsert(client, "question_options", questionId, position);

    await client.query(
      `
        INSERT INTO question_options (question_id, label, position)
        VALUES ($1, $2, $3)
      `,
      [questionId, normalizedPayload.label, position],
    );

    return hydrateSurvey(client, question.survey_id);
  });
}

async function updateOption(userId, questionId, optionId, payload) {
  const normalizedPayload = validateOptionPayload(payload, { allowPartial: true });

  return db.withTransaction(async (client) => {
    const option = await ensureOptionOwned(client, optionId, userId);
    if (option.question_id !== questionId) {
      throw new AppError(404, "option_not_found", "Option not found in this question");
    }

    const newPosition = await resolveMovePosition(
      client,
      "question_options",
      questionId,
      normalizedPayload.position,
      option.position,
    );

    if (newPosition !== option.position) {
      const tempPosition =
        (await countScopedRecords(client, "question_options", questionId)) + 1;
      await client.query("UPDATE question_options SET position = $1 WHERE id = $2", [
        tempPosition,
        optionId,
      ]);
      await shiftPositionsForMove(client, "question_options", questionId, option.position, newPosition);
    }

    const updates = [];
    const params = [];

    if (normalizedPayload.label !== undefined) {
      params.push(normalizedPayload.label);
      updates.push(`label = $${params.length}`);
    }

    params.push(newPosition);
    updates.push(`position = $${params.length}`);

    params.push(optionId);
    await client.query(
      `
        UPDATE question_options
        SET ${updates.join(", ")}
        WHERE id = $${params.length}
      `,
      params,
    );

    return hydrateSurvey(client, option.survey_id);
  });
}

async function deleteOption(userId, questionId, optionId) {
  return db.withTransaction(async (client) => {
    const option = await ensureOptionOwned(client, optionId, userId);
    if (option.question_id !== questionId) {
      throw new AppError(404, "option_not_found", "Option not found in this question");
    }

    await client.query("DELETE FROM question_options WHERE id = $1", [optionId]);
    await closeGapAfterDelete(client, "question_options", questionId, option.position);

    return hydrateSurvey(client, option.survey_id);
  });
}

async function publishSurvey(userId, surveyId) {
  return db.withTransaction(async (client) => {
    const survey = await ensureDraftSurvey(client, surveyId, userId);
    const questions = await fetchSurveyQuestions(client, surveyId);

    if (questions.length === 0) {
      throw new AppError(409, "invalid_survey", "Survey must contain at least one question before publishing");
    }

    for (const question of questions) {
      if (question.type !== "text" && question.options.length < 2) {
        throw new AppError(
          409,
          "invalid_survey",
          `Question "${question.prompt}" must contain at least two answer options`,
        );
      }
    }

    await client.query(
      `
        UPDATE surveys
        SET status = 'published', published_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [survey.id],
    );

    logBusinessEvent("survey.published", {
      actorUserId: userId,
      surveyId,
    });

    return hydrateSurvey(client, surveyId);
  });
}

async function closeSurvey(userId, surveyId) {
  return db.withTransaction(async (client) => {
    await ensurePublishedSurvey(client, surveyId, userId);

    await client.query(
      `
        UPDATE surveys
        SET status = 'closed', closed_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [surveyId],
    );

    logBusinessEvent("survey.closed", {
      actorUserId: userId,
      surveyId,
    });

    return hydrateSurvey(client, surveyId);
  });
}

async function getPublicSurvey(surveyId) {
  const client = await db.getClient();

  try {
    const survey = await hydrateSurvey(client, surveyId);
    if (!survey || survey.status !== "published") {
      throw new AppError(404, "survey_not_found", "Published survey not found");
    }

    return survey;
  } finally {
    client.release();
  }
}

function validateResponsePayload(payload, questionMap) {
  ensureObject(payload, "body");
  const answers = ensureArray(payload.answers, "answers", {
    minLength: 1,
    maxLength: questionMap.size,
  });

  const normalizedAnswers = [];
  const answeredQuestionIds = new Set();

  for (const answer of answers) {
    ensureObject(answer, "answers[]");

    const questionId = ensureString(answer.questionId, "questionId", {
      minLength: 1,
      maxLength: 100,
    });

    if (answeredQuestionIds.has(questionId)) {
      throw new AppError(400, "validation_error", "Each question can be answered only once");
    }
    answeredQuestionIds.add(questionId);

    const question = questionMap.get(questionId);
    if (!question) {
      throw new AppError(400, "validation_error", `Question ${questionId} does not belong to this survey`);
    }

    if (question.type === "text") {
      const textValue = ensureString(answer.textValue, "textValue", {
        minLength: 1,
        maxLength: 4000,
      });

      if (answer.optionIds !== undefined) {
        throw new AppError(400, "validation_error", "Text question answer must not contain optionIds");
      }

      normalizedAnswers.push({
        questionId,
        textValue,
        optionIds: [],
      });
      continue;
    }

    const optionIds = ensureArray(answer.optionIds, "optionIds", {
      minLength: 1,
      maxLength: question.optionIds.size,
    }).map((optionId) =>
      ensureString(optionId, "optionIds[]", {
        minLength: 1,
        maxLength: 100,
      }),
    );

    const uniqueOptionIds = [...new Set(optionIds)];
    if (uniqueOptionIds.length !== optionIds.length) {
      throw new AppError(400, "validation_error", "optionIds must not contain duplicates");
    }

    if (question.type === "single_choice" && uniqueOptionIds.length !== 1) {
      throw new AppError(400, "validation_error", "Single choice question requires exactly one option");
    }

    for (const optionId of uniqueOptionIds) {
      if (!question.optionIds.has(optionId)) {
        throw new AppError(400, "validation_error", `Option ${optionId} does not belong to question ${questionId}`);
      }
    }

    if (answer.textValue !== undefined) {
      throw new AppError(400, "validation_error", "Choice question answer must not contain textValue");
    }

    normalizedAnswers.push({
      questionId,
      textValue: null,
      optionIds: uniqueOptionIds,
    });
  }

  for (const question of questionMap.values()) {
    if (question.isRequired && !answeredQuestionIds.has(question.id)) {
      throw new AppError(400, "validation_error", `Required question ${question.id} is missing`);
    }
  }

  return normalizedAnswers;
}

async function submitSurveyResponse(userId, surveyId, payload) {
  return db.withTransaction(async (client) => {
    const surveyResult = await client.query(
      `
        SELECT id, status
        FROM surveys
        WHERE id = $1
      `,
      [surveyId],
    );

    if (surveyResult.rowCount === 0 || surveyResult.rows[0].status !== "published") {
      throw new AppError(404, "survey_not_found", "Published survey not found");
    }

    const questionRows = await fetchSurveyQuestions(client, surveyId);
    const questionMap = new Map(
      questionRows.map((question) => [
        question.id,
        {
          id: question.id,
          type: question.type,
          isRequired: question.isRequired,
          optionIds: new Set(question.options.map((option) => option.id)),
        },
      ]),
    );

    const answers = validateResponsePayload(payload, questionMap);

    const existingResponseResult = await client.query(
      `
        SELECT id
        FROM responses
        WHERE survey_id = $1 AND respondent_id = $2
      `,
      [surveyId, userId],
    );

    if (existingResponseResult.rowCount > 0) {
      throw new AppError(409, "already_responded", "User has already submitted answers for this survey");
    }

    const responseResult = await client.query(
      `
        INSERT INTO responses (survey_id, respondent_id)
        VALUES ($1, $2)
        RETURNING id, submitted_at
      `,
      [surveyId, userId],
    );

    const response = responseResult.rows[0];

    for (const answer of answers) {
      const answerResult = await client.query(
        `
          INSERT INTO answers (response_id, question_id, text_value)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [response.id, answer.questionId, answer.textValue],
      );

      for (const optionId of answer.optionIds) {
        await client.query(
          `
            INSERT INTO answer_options (answer_id, option_id)
            VALUES ($1, $2)
          `,
          [answerResult.rows[0].id, optionId],
        );
      }
    }

    logBusinessEvent("survey.responded", {
      actorUserId: userId,
      surveyId,
      responseId: response.id,
    });

    return {
      id: response.id,
      surveyId,
      respondentId: userId,
      submittedAt: response.submitted_at,
    };
  });
}

async function buildAnalytics(client, surveyId, userId) {
  await ensureOwnedSurvey(client, surveyId, userId);
  const survey = await hydrateSurvey(client, surveyId);

  const respondentCountResult = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM responses
      WHERE survey_id = $1
    `,
    [surveyId],
  );
  const respondentCount = respondentCountResult.rows[0].count;

  const choiceResult = await client.query(
    `
      SELECT
        q.id AS question_id,
        qo.id AS option_id,
        qo.label,
        qo.position,
        COUNT(ao.answer_id)::int AS selected_count
      FROM questions q
      JOIN question_options qo ON qo.question_id = q.id
      LEFT JOIN answer_options ao ON ao.option_id = qo.id
      WHERE q.survey_id = $1
      GROUP BY q.id, q.position, qo.id, qo.label, qo.position
      ORDER BY q.position ASC, qo.position ASC
    `,
    [surveyId],
  );

  const choiceStatsByQuestionId = new Map();
  for (const row of choiceResult.rows) {
    const optionStat = {
      optionId: row.option_id,
      label: row.label,
      position: row.position,
      selectedCount: Number(row.selected_count),
      selectedPercent:
        respondentCount === 0 ? 0 : Number(((Number(row.selected_count) / respondentCount) * 100).toFixed(2)),
    };

    if (!choiceStatsByQuestionId.has(row.question_id)) {
      choiceStatsByQuestionId.set(row.question_id, []);
    }
    choiceStatsByQuestionId.get(row.question_id).push(optionStat);
  }

  const textResult = await client.query(
    `
      SELECT
        q.id AS question_id,
        a.text_value,
        r.respondent_id,
        u.display_name AS respondent_display_name
      FROM questions q
      JOIN answers a ON a.question_id = q.id
      JOIN responses r ON r.id = a.response_id
      JOIN users u ON u.id = r.respondent_id
      WHERE q.survey_id = $1
        AND q.type = 'text'
        AND a.text_value IS NOT NULL
      ORDER BY q.position ASC, a.created_at ASC
    `,
    [surveyId],
  );

  const textAnswersByQuestionId = new Map();
  for (const row of textResult.rows) {
    if (!textAnswersByQuestionId.has(row.question_id)) {
      textAnswersByQuestionId.set(row.question_id, []);
    }

    textAnswersByQuestionId.get(row.question_id).push({
      respondentId: row.respondent_id,
      respondentDisplayName: row.respondent_display_name,
      value: row.text_value,
    });
  }

  return {
    survey,
    respondentCount,
    questions: survey.questions.map((question) => ({
      questionId: question.id,
      prompt: question.prompt,
      type: question.type,
      position: question.position,
      options: choiceStatsByQuestionId.get(question.id) || [],
      textAnswers: textAnswersByQuestionId.get(question.id) || [],
    })),
  };
}

async function getAnalytics(userId, surveyId) {
  const client = await db.getClient();

  try {
    return await buildAnalytics(client, surveyId, userId);
  } finally {
    client.release();
  }
}

async function exportAnalytics(userId, surveyId) {
  const client = await db.getClient();

  try {
    const analytics = await buildAnalytics(client, surveyId, userId);
    const rawResponsesResult = await client.query(
      `
        SELECT
          r.id AS response_id,
          r.submitted_at,
          u.id AS respondent_id,
          u.display_name AS respondent_display_name,
          q.id AS question_id,
          q.prompt,
          q.type,
          a.id AS answer_id,
          a.text_value,
          qo.id AS option_id,
          qo.label AS option_label,
          qo.position AS option_position
        FROM responses r
        JOIN users u ON u.id = r.respondent_id
        JOIN answers a ON a.response_id = r.id
        JOIN questions q ON q.id = a.question_id
        LEFT JOIN answer_options ao ON ao.answer_id = a.id
        LEFT JOIN question_options qo ON qo.id = ao.option_id
        WHERE r.survey_id = $1
        ORDER BY r.submitted_at ASC, q.position ASC, qo.position ASC
      `,
      [surveyId],
    );

    const responses = [];
    const responsesById = new Map();

    for (const row of rawResponsesResult.rows) {
      let response = responsesById.get(row.response_id);

      if (!response) {
        response = {
          id: row.response_id,
          submittedAt: row.submitted_at,
          respondent: {
            id: row.respondent_id,
            displayName: row.respondent_display_name,
          },
          answers: [],
        };
        responsesById.set(row.response_id, response);
        responses.push(response);
      }

      let answer = response.answers.find((item) => item.id === row.answer_id);
      if (!answer) {
        answer = {
          id: row.answer_id,
          questionId: row.question_id,
          prompt: row.prompt,
          type: row.type,
          textValue: row.text_value,
          options: [],
        };
        response.answers.push(answer);
      }

      if (row.option_id) {
        answer.options.push({
          id: row.option_id,
          label: row.option_label,
          position: row.option_position,
        });
      }
    }

    return {
      exportedAt: new Date().toISOString(),
      analytics,
      responses,
    };
  } finally {
    client.release();
  }
}

module.exports = {
  closeSurvey,
  createOption,
  createQuestion,
  createSurvey,
  deleteOption,
  deleteQuestion,
  deleteSurvey,
  exportAnalytics,
  getAnalytics,
  getPublicSurvey,
  getSurvey,
  listSurveys,
  publishSurvey,
  submitSurveyResponse,
  updateOption,
  updateQuestion,
  updateSurvey,
};
