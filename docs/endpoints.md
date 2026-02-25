# Survey API Endpoints (Draft)

## Auth

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | Public | Регистрация пользователя |
| POST | `/api/v1/auth/login` | Public | Логин и получение JWT |
| GET | `/api/v1/auth/me` | Bearer | Профиль текущего пользователя |

## Surveys (Author)

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/surveys` | Bearer | Создать опрос (draft) |
| GET | `/api/v1/surveys/mine` | Bearer | Список моих опросов |
| GET | `/api/v1/surveys/:surveyId` | Bearer | Детали опроса |
| PATCH | `/api/v1/surveys/:surveyId` | Bearer | Обновить title/description (только draft) |
| DELETE | `/api/v1/surveys/:surveyId` | Bearer | Удалить опрос (только author) |

## Questions and Options (Author)

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/surveys/:surveyId/questions` | Bearer | Добавить вопрос |
| PATCH | `/api/v1/surveys/:surveyId/questions/:questionId` | Bearer | Обновить вопрос и порядок |
| DELETE | `/api/v1/surveys/:surveyId/questions/:questionId` | Bearer | Удалить вопрос |
| POST | `/api/v1/questions/:questionId/options` | Bearer | Добавить вариант ответа |
| PATCH | `/api/v1/questions/:questionId/options/:optionId` | Bearer | Обновить вариант |
| DELETE | `/api/v1/questions/:questionId/options/:optionId` | Bearer | Удалить вариант |

## Survey Lifecycle

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/surveys/:surveyId/publish` | Bearer | Перевести опрос в `published` |
| POST | `/api/v1/surveys/:surveyId/close` | Bearer | Перевести опрос в `closed` |

## Public Survey Participation

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/public/surveys/:surveyId` | Bearer | Получить опубликованный опрос для прохождения |
| POST | `/api/v1/public/surveys/:surveyId/responses` | Bearer | Отправить ответы респондента |

## Analytics (Author)

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/surveys/:surveyId/analytics` | Bearer | Агрегированная статистика по опросу |
| GET | `/api/v1/surveys/:surveyId/analytics/export` | Bearer | Экспорт результатов в JSON |

