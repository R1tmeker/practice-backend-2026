# Survey API

REST API для сервиса опросов и голосований с аналитикой, экспортом результатов и JWT-аутентификацией.

## Статус по чекпоинтам

- Чекпоинт 1: выполнен
- Чекпоинт 2: выполнен
- Чекпоинт 3: выполнен
- Чекпоинт 4: выполнен
- Чекпоинт 5: выполнен
- Чекпоинт 6: не выполнялся

## Предметная область

Пользователь может создавать опросы, добавлять вопросы разных типов, публиковать их и собирать ответы респондентов. Один и тот же аккаунт может выступать и автором, и респондентом.

Поддерживаемые типы вопросов:

- `single_choice`
- `multiple_choice`
- `text`

Жизненный цикл опроса:

- `draft`
- `published`
- `closed`

После публикации структура опроса больше не редактируется. Один респондент может пройти один опрос только один раз.

## Стек

- Node.js 22
- Express.js
- PostgreSQL 16
- SQL migrations
- OpenAPI 3.1
- Интеграционные тесты на `node:test`

## Реализованные возможности

- Регистрация, логин, профиль текущего пользователя
- JWT bearer auth
- CRUD для опросов
- CRUD для вопросов и вариантов ответа
- Публикация и закрытие опросов
- Валидация ответов по типу вопроса
- Защита от повторного прохождения
- Аналитика по вариантам и текстовым ответам
- Экспорт результатов в JSON
- Пагинация, фильтрация и сортировка списка опросов
- Docker-окружение для приложения и PostgreSQL
- Seeder для демо-данных
- OpenAPI-спецификация
- Интеграционные тесты

## Структура проекта

```text
.
├── db/
│   └── migrations/
├── docker/
│   └── db/
├── docs/
│   ├── access-matrix.md
│   ├── endpoints.md
│   ├── er-diagram.dbml
│   └── openapi.yaml
├── scripts/
│   ├── migrate.js
│   └── seed.js
├── src/
│   ├── lib/
│   ├── middlewares/
│   ├── routes/
│   ├── services/
│   ├── app.js
│   └── server.js
└── tests/
```

## Запуск без Docker

1. Установить зависимости:

```bash
npm install
```

2. Поднять PostgreSQL:

```bash
docker compose -p survey_api up -d db
```

3. Создать локальный `.env` из `.env.example`

4. Применить миграции:

```bash
npm run migrate
```

5. При необходимости загрузить демо-данные:

```bash
npm run seed
```

6. Запустить API:

```bash
npm run dev
```

## Запуск в Docker

```bash
docker compose -p survey_api up --build
```

Приложение будет доступно на `http://localhost:3000`, база данных на `localhost:5432`.

## Переменные окружения

- `PORT=3000`
- `DATABASE_URL=postgres://survey_user:survey_password@localhost:5432/survey_api`
- `TEST_DATABASE_URL=postgres://survey_user:survey_password@localhost:5432/survey_api_test`
- `JWT_SECRET=change-me-in-production`
- `TOKEN_TTL_SECONDS=86400`

## Основные эндпоинты

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/surveys`
- `POST /api/v1/surveys`
- `POST /api/v1/surveys/:surveyId/questions`
- `POST /api/v1/questions/:questionId/options`
- `POST /api/v1/surveys/:surveyId/publish`
- `POST /api/v1/public/surveys/:surveyId/responses`
- `GET /api/v1/surveys/:surveyId/analytics`
- `GET /api/v1/surveys/:surveyId/analytics/export`

Полный контракт:

- `docs/endpoints.md`
- `docs/openapi.yaml`

## Swagger / OpenAPI

- Спецификация в репозитории: `docs/openapi.yaml`
- Выдача через приложение: `GET /openapi.yaml`

## Тесты

Запуск:

```bash
npm test
```

Покрытые сценарии:

- регистрация и `GET /auth/me`
- публикация опроса после добавления вопросов и вариантов
- запрет вариантов у `text` вопроса
- запрет редактирования после `published`
- защита от повторного прохождения
- аналитика по ответам

## Демонстрационные учётные записи

После `npm run seed`:

- `author@example.com` / `Password123`
- `respondent@example.com` / `Password123`

## Документация

- ER-диаграмма: `docs/er-diagram.dbml`
- Матрица доступа: `docs/access-matrix.md`
- Эндпоинты: `docs/endpoints.md`
- OpenAPI: `docs/openapi.yaml`
