# Survey API (Чекпоинт 1)

REST API для сервиса опросов и голосований с поддержкой вопросов разных типов, отправки ответов и аналитики.

Выбранный проект: **Survey API**  
Предметная область: сервис корпоративных и публичных опросов.

## Стек

- Node.js 22
- Express.js
- PostgreSQL 16
- SQL migrations (custom runner)

## Что сделано в Чекпоинте 1

- Выбран стек и предметная область
- Инициализирован проект и git-структура
- Спроектирована ER-диаграмма: `docs/er-diagram.dbml`
- Спроектированы эндпоинты API: `docs/endpoints.md`
- Создана начальная миграция БД: `db/migrations/001_init.sql`
- Добавлен runner миграций: `scripts/migrate.js`

## Структура

```
.
├── db/
│   └── migrations/
├── docs/
│   ├── endpoints.md
│   └── er-diagram.dbml
├── scripts/
│   └── migrate.js
├── src/
│   ├── app.js
│   └── server.js
├── tests/
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Быстрый старт

1. Установить зависимости:

```bash
npm install
```

2. Поднять PostgreSQL:

```bash
docker compose up -d db
```

3. Скопировать окружение:

```bash
cp .env.example .env
```

4. Применить миграции:

```bash
npm run migrate
```

5. Запустить API:

```bash
npm run dev
```

Проверка доступности:

```bash
curl http://localhost:3000/health
```

## Переменные окружения

- `PORT` (по умолчанию `3000`)
- `DATABASE_URL` (по умолчанию `postgres://survey_user:survey_password@localhost:5432/survey_api`)

## Документация

- ER-диаграмма: `docs/er-diagram.dbml`
- Эндпоинты: `docs/endpoints.md`
