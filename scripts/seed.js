require("dotenv").config({ quiet: true });

const { Client } = require("pg");
const config = require("../src/config");
const { hashPassword } = require("../src/lib/password");

async function upsertUser(client, user) {
  const result = await client.query(
    `
      INSERT INTO users (email, password_hash, display_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        display_name = EXCLUDED.display_name,
        updated_at = NOW()
      RETURNING id
    `,
    [user.email, hashPassword(user.password), user.displayName],
  );

  return result.rows[0].id;
}

async function seed() {
  const client = new Client({ connectionString: config.databaseUrl });
  await client.connect();

  try {
    await client.query("BEGIN");

    const authorId = await upsertUser(client, {
      email: "author@example.com",
      password: "Password123",
      displayName: "Demo Author",
    });

    await upsertUser(client, {
      email: "respondent@example.com",
      password: "Password123",
      displayName: "Demo Respondent",
    });

    const existingSurveyResult = await client.query(
      `
        SELECT id
        FROM surveys
        WHERE author_id = $1 AND title = $2
      `,
      [authorId, "Employee Satisfaction Survey"],
    );

    let surveyId;
    if (existingSurveyResult.rowCount > 0) {
      surveyId = existingSurveyResult.rows[0].id;
    } else {
      const surveyResult = await client.query(
        `
          INSERT INTO surveys (author_id, title, description, status, published_at)
          VALUES ($1, $2, $3, 'published', NOW())
          RETURNING id
        `,
        [
          authorId,
          "Employee Satisfaction Survey",
          "Demo survey for manual API checks",
        ],
      );
      surveyId = surveyResult.rows[0].id;

      const question1 = await client.query(
        `
          INSERT INTO questions (survey_id, type, prompt, position, is_required)
          VALUES ($1, 'single_choice', 'How satisfied are you with your workload?', 1, true)
          RETURNING id
        `,
        [surveyId],
      );

      const question2 = await client.query(
        `
          INSERT INTO questions (survey_id, type, prompt, position, is_required)
          VALUES ($1, 'multiple_choice', 'Which benefits do you value most?', 2, true)
          RETURNING id
        `,
        [surveyId],
      );

      await client.query(
        `
          INSERT INTO questions (survey_id, type, prompt, position, is_required)
          VALUES ($1, 'text', 'What should we improve next quarter?', 3, false)
          RETURNING id
        `,
        [surveyId],
      );

      await client.query(
        `
          INSERT INTO question_options (question_id, label, position)
          VALUES
            ($1, 'Very satisfied', 1),
            ($1, 'Satisfied', 2),
            ($1, 'Neutral', 3),
            ($1, 'Dissatisfied', 4)
        `,
        [question1.rows[0].id],
      );

      await client.query(
        `
          INSERT INTO question_options (question_id, label, position)
          VALUES
            ($1, 'Remote work', 1),
            ($1, 'Healthcare', 2),
            ($1, 'Learning budget', 3)
        `,
        [question2.rows[0].id],
      );
    }

    await client.query("COMMIT");
    console.log(`Seed completed for survey ${surveyId}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error("Seed failed");
  console.error(error);
  process.exit(1);
});
