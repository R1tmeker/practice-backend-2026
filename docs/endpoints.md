# Survey API Endpoints

## Auth

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | Public | Регистрация пользователя |
| POST | `/api/v1/auth/login` | Public | Логин и получение JWT |
| GET | `/api/v1/auth/me` | Bearer | Профиль текущего пользователя |

## Surveys

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/surveys` | Bearer | Список опросов с `scope`, `status`, `sort_by`, `sort_order`, `page`, `limit` |
| GET | `/api/v1/surveys/mine` | Bearer | Список опросов текущего автора |
| POST | `/api/v1/surveys` | Bearer | Создать опрос в статусе `draft` |
| GET | `/api/v1/surveys/:surveyId` | Bearer | Получить свой опрос со всеми вопросами и вариантами |
| PATCH | `/api/v1/surveys/:surveyId` | Bearer | Обновить `title` и `description` у `draft` |
| DELETE | `/api/v1/surveys/:surveyId` | Bearer | Удалить свой `draft` опрос |

## Questions

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/surveys/:surveyId/questions` | Bearer | Добавить вопрос в `draft` |
| PATCH | `/api/v1/surveys/:surveyId/questions/:questionId` | Bearer | Изменить текст, тип, обязательность или позицию вопроса |
| DELETE | `/api/v1/surveys/:surveyId/questions/:questionId` | Bearer | Удалить вопрос из `draft` |

## Options

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/questions/:questionId/options` | Bearer | Добавить вариант ответа для `single_choice` или `multiple_choice` |
| PATCH | `/api/v1/questions/:questionId/options/:optionId` | Bearer | Обновить подпись или позицию варианта |
| DELETE | `/api/v1/questions/:questionId/options/:optionId` | Bearer | Удалить вариант ответа |

## Survey Lifecycle

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/surveys/:surveyId/publish` | Bearer | Перевести `draft -> published` |
| POST | `/api/v1/surveys/:surveyId/close` | Bearer | Перевести `published -> closed` |

## Public Participation

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/public/surveys/:surveyId` | Bearer | Получить опубликованный опрос для прохождения |
| POST | `/api/v1/public/surveys/:surveyId/responses` | Bearer | Отправить ответы на опубликованный опрос |

## Analytics

| Method | URL | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/surveys/:surveyId/analytics` | Bearer | Агрегированная статистика по опросу |
| GET | `/api/v1/surveys/:surveyId/analytics/export` | Bearer | Экспорт аналитики и сырых ответов в JSON |

