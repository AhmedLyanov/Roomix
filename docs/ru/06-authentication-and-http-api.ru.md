# Roomix— Authentication and HTTP API

## 1. Назначение документа

Этот документ описывает HTTP-часть Roomixи механизм аутентификации между frontend и backend.

В проекте используются два основных способа взаимодействия:

```text
Frontend
   |
   +---- HTTP / REST ----> Fastify API
   |
   +---- Socket.IO ------> WebSocket server
```

HTTP используется для persisted/server state и операций, которые естественно выражаются через request/response:

- получение сессий;
- получение деталей сессии;
- получение истории SessionAction;
- загрузка файлов;
- HTTP proxy для translation;
- аутентифицированные запросы.

Socket.IO используется отдельно для realtime-коммуникации.

---

## 2. Общая HTTP-архитектура

Основной поток выглядит так:

```text
Next.js / React
      |
      v
shared/api/client.ts
      |
      | Axios
      v
Fastify
      |
      +--> authenticate
      |
      +--> route
      |
      v
service
      |
      v
Mongoose
      |
      v
MongoDB
```

Frontend не должен знать детали MongoDB или Mongoose.

Его задача:

```text
создать HTTP request
        ↓
передать необходимые данные
        ↓
получить response
        ↓
обновить UI/server state
```

Backend отвечает за:

```text
authentication
validation
business logic
database access
file processing
response
```

---

## 3. Backend

Backend построен на Fastify.

Стартовая точка backend отвечает за:

- создание Fastify application;
- загрузку environment variables;
- CORS;
- подключение MongoDB;
- регистрацию plugins;
- регистрацию routes;
- запуск сервера.

Условная структура:

```text
server/
├── index.js
├── plugins/
│   ├── auth.js
│   └── websocket.js
├── routes/
│   ├── chat/
│   ├── sessions/
│   └── translation/
├── services/
│   ├── session.service.js
│   ├── session-action.service.js
│   ├── speech.service.js
│   └── translation.service.js
└── models/
    ├── Session.model.js
    ├── SessionAction.model.js
    ├── RoomMessage.model.js
    └── User.js
```

---

## 4. Authentication

Для authentication используется Clerk.

Backend использует:

```text
@clerk/backend
```

и Fastify decorator:

```text
fastify.authenticate
```

Аутентификация HTTP-запроса выполняется через `preHandler`.

Например:

```js
fastify.get(
  "/:sessionId/actions",
  {
    preHandler: [fastify.authenticate],
  },
  async (request) => {
    ...
  }
);
```

Это означает:

```text
HTTP request
     |
     v
fastify.authenticate
     |
     +---- invalid token --> request rejected
     |
     +---- valid token ----> route handler
```

---

## 5. Frontend authentication token

Frontend использует Clerk для получения access token.

Общий Axios client располагается в:

```text
web/src/shared/api/client.ts
```

Перед отправкой HTTP-запроса клиент получает token и добавляет его в:

```http
Authorization: Bearer <token>
```

Таким образом backend может выполнить проверку через:

```text
fastify.authenticate
```

Архитектурно:

```text
Clerk
  |
  v
Frontend
  |
  | Authorization: Bearer ...
  v
Fastify
  |
  v
Clerk verification
```

---

## 6. Почему authentication вынесена в shared API client

Без общего клиента каждый endpoint должен был бы самостоятельно заниматься:

```text
получением token
добавлением Authorization
```

Это привело бы к повторению одного и того же кода.

Вместо этого используется единая точка:

```text
api
 |
 +--> authentication header
 +--> baseURL
 +--> HTTP configuration
```

Поэтому feature API-функции могут заниматься только своим endpoint.

Например:

```text
getSessionActions()
```

знает:

```text
GET /sessions/:sessionId/actions
```

но не должен вручную собирать Authorization header.

---

## 7. Sessions API

Для Session History используется endpoint:

```http
GET /sessions/:sessionId/actions
```

Route:

```text
server/routes/sessions/index.js
```

Логика:

```text
GET /sessions/:sessionId/actions
             |
             v
fastify.authenticate
             |
             v
getSessionActions(sessionId)
             |
             v
SessionAction.find(...)
             |
             v
MongoDB
             |
             v
JSON
```

---

## 8. Session details API

Получение самой Session выполняется отдельно:

```http
GET /sessions/details/:id
```

Backend вызывает:

```text
getSession(id)
```

из:

```text
session.service.js
```

Это принципиально отличается от history endpoint.

```text
Session details
    |
    v
GET /sessions/details/:id

Session history
    |
    v
GET /sessions/:sessionId/actions
```

Один endpoint возвращает Session.

Другой возвращает массив событий SessionAction.

---

## 9. Sessions list API

Получение списка сессий пользователя:

```http
GET /sessions/:userId
```

Route вызывает:

```text
getSessions(userId)
```

Service выполняет:

```js
Session.find({
  ownerId: userId,
}).sort({
  startedAt: -1,
});
```

Поэтому список возвращается от новых сессий к старым.

---

## 10. Delete Session API

Удаление:

```http
DELETE /sessions/:id
```

Route вызывает:

```text
deleteSession(id)
```

Service использует:

```text
Session.findByIdAndDelete()
```

Успешный ответ:

```http
204 No Content
```

---

## 11. File upload API

Загрузка файла выполняется через:

```http
POST /chat/:roomId/files
```

Этот endpoint также защищён:

```text
fastify.authenticate
```

Общий поток:

```text
Frontend
   |
   | multipart/form-data
   v
POST /chat/:roomId/files
   |
   v
authenticate
   |
   v
request.file()
   |
   v
uploads/
   |
   v
RoomMessage.create()
   |
   v
active Session
   |
   v
SessionAction(FILE_UPLOADED)
   |
   v
Socket.IO chat:new
```

Это хороший пример того, как одна HTTP-операция затрагивает несколько подсистем.

---

## 12. File storage

Файл не хранится непосредственно внутри MongoDB.

Backend создаёт:

```text
uploads/
```

и генерирует уникальное имя:

```text
crypto.randomUUID()
```

При этом сохраняется расширение исходного файла.

Получается примерно:

```text
uploads/
   |
   +-- 7c4...a91.pdf
   +-- 2af...91b.png
```

В `RoomMessage` сохраняются metadata:

```text
originalName
storedName
mimeType
size
url
```

Таким образом MongoDB хранит информацию о файле, а filesystem хранит сами bytes.

---

## 13. Почему filename генерируется заново

Исходное имя файла не используется как физическое имя файла.

Вместо этого:

```text
originalName
```

остаётся metadata, а:

```text
storedName
```

генерируется отдельно.

Это предотвращает простое столкновение имён:

```text
document.pdf
document.pdf
document.pdf
```

Несколько пользователей могут загрузить файл с одинаковым исходным названием, но физические файлы будут иметь разные generated names.

---

## 14. File upload и Session History

Загрузка файла одновременно относится к двум подсистемам.

### Chat/File subsystem

Создаётся:

```text
RoomMessage
```

### Session History

Создаётся:

```text
SessionAction
```

с:

```text
type: FILE_UPLOADED
```

Поэтому:

```text
POST /chat/:roomId/files
          |
          +------------------+
          |                  |
          v                  v
    RoomMessage        SessionAction
          |                  |
          v                  v
       MongoDB            MongoDB
```

SessionAction дополнительно хранит:

```text
messageId
```

который связывает историю с соответствующим сообщением.

---

## 15. Translation HTTP API

В проекте существует также HTTP route для translation.

Важно разделять две вещи:

```text
real-time translation
```

и:

```text
translation HTTP endpoint
```

Основной realtime pipeline использует Socket.IO:

```text
audio-chunk
   ↓
speechService
   ↓
translationService
   ↓
subtitle
```

HTTP translation route является отдельным API-слоем/proxy.

Поэтому нельзя описывать весь realtime translation как обычный REST request.

---

## 16. REST vs Socket.IO

В проекте используется сознательное разделение каналов.

### REST

Подходит для:

```text
GET session
GET sessions
GET session actions
POST file upload
translation HTTP proxy
DELETE session
```

То есть для операций:

```text
request → processing → response
```

### Socket.IO

Подходит для:

```text
join-room
user-connected
user-disconnected
offer
answer
ice-candidate
chat:new
audio-chunk
subtitle
camera:update
mic:update
language:update
```

То есть для realtime events.

---

## 17. Почему translation не строится на REST

Realtime speech translation постоянно генерирует данные.

Модель:

```text
microphone
   ↓
audio chunk
   ↓
speech recognition
   ↓
text
   ↓
translation
   ↓
subtitle
```

Это поток событий.

Для такого поведения Socket.IO подходит лучше, потому что соединение остаётся открытым.

REST пришлось бы использовать как множество независимых requests:

```text
POST audio chunk
POST audio chunk
POST audio chunk
POST audio chunk
...
```

что плохо соответствует realtime event-driven модели проекта.

---

## 18. Error handling

Backend routes используют обработку ошибок.

Типовой flow:

```js
try {
  ...
} catch (error) {
  fastify.log.error(error);

  return reply.code(500).send({
    message: "..."
  });
}
```

Это позволяет:

```text
не отдавать stack trace frontend
```

и вернуть контролируемый HTTP response.

Например:

```http
500 Internal Server Error
```

с JSON:

```json
{
  "message": "Failed to upload file"
}
```

---

## 19. HTTP status codes

В проекте используются стандартные HTTP-коды.

Например:

```text
200
```

для успешного GET.

```text
201
```

для успешно созданного ресурса, например file message.

```text
204
```

для успешного удаления без response body.

```text
400
```

для некорректного request.

Например:

```text
File is required
```

```text
404
```

если ресурс или пользователь не найден.

```text
413
```

если загруженный файл превышает допустимый размер.

```text
500
```

для непредвиденной backend error.

---

## 20. Frontend API layer

Frontend API функции организованы отдельно от UI.

Например:

```text
entities/session-actions/api/get-session-actions.ts
```

Содержит:

```text
getSessionActions(sessionId)
```

UI не делает:

```text
axios.get(...)
```

непосредственно внутри JSX.

Вместо этого:

```text
UI
 ↓
React Query hook
 ↓
API function
 ↓
shared axios client
```

Это отделяет:

```text
presentation
server-state logic
HTTP transport
```

---

## 21. React Query и HTTP

Для server state используется:

```text
@tanstack/react-query
```

Например:

```text
useSessionActions()
```

вызывает:

```text
getSessionActions()
```

а React Query управляет:

```text
loading
data
cache
refetch
query lifecycle
```

Таким образом:

```text
Component
   |
   v
useSessionActions()
   |
   v
React Query
   |
   v
getSessionActions()
   |
   v
Axios
```

---

## 22. Session History example

Когда пользователь открывает страницу истории:

```text
SessionActions
       |
       v
useSessionActions(sessionId)
       |
       v
React Query
       |
       v
getSessionActions(sessionId)
       |
       v
Axios
       |
       v
GET /sessions/:sessionId/actions
       |
       v
Fastify
       |
       v
authenticate
       |
       v
session-action.service.js
       |
       v
MongoDB
       |
       v
JSON
       |
       v
React Query
       |
       v
SessionActions
```

Это полный HTTP data flow для истории.

---

## 23. Authentication boundaries

В текущей архитектуре HTTP и WebSocket имеют разные authentication boundaries.

HTTP routes явно используют:

```text
fastify.authenticate
```

например:

```text
GET /sessions/:sessionId/actions
POST /chat/:roomId/files
DELETE /sessions/:id
```

WebSocket connection устанавливается через Socket.IO.

В текущей реализации `join-room` получает:

```text
userId
userName
nativeLanguage
userAvatar
```

из client payload.

Это означает, что authentication HTTP-запросов и authentication Socket.IO-событий реализованы не одинаково.

Это важный момент при техническом review.

---

## 24. Что это означает с точки зрения безопасности

Нельзя автоматически считать:

```text
HTTP protected
```

и:

```text
WebSocket protected
```

одним и тем же.

В текущем коде:

```text
HTTP
  ↓
fastify.authenticate
  ↓
Clerk token verification
```

а Socket.IO:

```text
connect
  ↓
join-room payload
  ↓
room state
```

не использует тот же `fastify.authenticate` flow для проверки `join-room`.

Следовательно, полноценная WebSocket authentication/authorization является отдельным направлением для дальнейшего hardening.

Это описание фактической архитектуры, а не утверждение, что WebSocket обязательно уязвим в каждом deployment.

---

## 25. Data ownership

Каждый слой отвечает за свою область.

### Frontend

```text
UI
interaction
client state
server state
HTTP requests
Socket.IO events
```

### Fastify routes

```text
HTTP boundary
request parsing
authentication hooks
response
```

### Services

```text
business logic
```

Например:

```text
session.service.js
```

управляет Session lifecycle.

```text
session-action.service.js
```

управляет SessionAction.

```text
speech.service.js
```

работает со speech-to-text pipeline.

```text
translation.service.js
```

работает с translation service.

### Models

```text
MongoDB schema
```

### MongoDB

```text
persistent data
```

---

## 26. Главный принцип API-архитектуры

В проекте можно провести границу:

```text
UI
 |
 | knows
 v
API contract
 |
 v
Backend
 |
 | knows
 v
Business logic
 |
 v
Database
```

Frontend не должен знать:

```text
SessionAction.find(...)
```

Backend не должен зависеть от React-компонента.

MongoDB не должна быть доступна непосредственно браузеру.

Каждый слой имеет свою ответственность.

---

## 27. Основные HTTP endpoints

| Method            | Endpoint                       | Назначение                 |
| ----------------- | ------------------------------ | -------------------------- |
| `GET`             | `/sessions/:userId`            | список сессий пользователя |
| `GET`             | `/sessions/details/:id`        | детали сессии              |
| `GET`             | `/sessions/:sessionId/actions` | история SessionAction      |
| `DELETE`          | `/sessions/:id`                | удаление сессии            |
| `POST`            | `/chat/:roomId/files`          | загрузка файла             |
| `GET`             | `/chat/:roomId/files`          | список файлов комнаты      |
| `GET`             | `/chat/:roomId/messages`       | сообщения комнаты          |
| translation route | translation endpoint           | HTTP proxy для перевода    |

Конкретная авторизация применяется на защищённых routes через:

```text
fastify.authenticate
```

---

## 28. HTTP request lifecycle

Типичный защищённый request:

```text
Browser
   |
   | request
   | Authorization: Bearer token
   v
Axios
   |
   v
Fastify
   |
   v
authenticate
   |
   +---- fail --> 401/authorization error
   |
   v
route handler
   |
   v
service
   |
   v
Mongoose
   |
   v
MongoDB
   |
   v
service result
   |
   v
Fastify response
   |
   v
Axios
   |
   v
React Query / component
```

---

## 29. Что важно понимать разработчику

После изучения этого слоя необходимо понимать следующие границы:

1. Clerk отвечает за identity/authentication.
2. Axios является HTTP transport layer frontend.
3. Fastify является HTTP API layer backend.
4. `fastify.authenticate` защищает HTTP routes.
5. Services содержат основную бизнес-логику.
6. Mongoose отвечает за работу с MongoDB models.
7. Session и SessionAction являются отдельными persisted entities.
8. File upload создаёт `RoomMessage` и при наличии active Session создаёт `FILE_UPLOADED`.
9. React Query управляет server state на frontend.
10. REST используется для persisted/request-response операций.
11. Socket.IO используется для realtime events.
12. Realtime translation не является обычным REST request.
13. File bytes хранятся в filesystem, metadata хранится в MongoDB.
14. `sessionId` связывает Session с SessionAction.
15. `roomId` связывает realtime room с Session lifecycle.
16. HTTP authentication и Socket.IO authentication являются разными security boundaries.
17. Наличие endpoint не означает, что endpoint автоматически защищён, это определяется route configuration.
18. API layer скрывает детали backend implementation от frontend.
19. Business logic не должна находиться в React components.
20. Backend является единственным слоем, который напрямую работает с MongoDB.

---

## 30. Краткая схема

```text
                         Clerk
                           |
                           v
Browser / Next.js ---> Axios
                           |
                    Authorization
                           |
                           v
                       Fastify
                           |
                    authenticate
                           |
                           v
                         Routes
                           |
                           v
                       Services
                           |
                           v
                        Mongoose
                           |
                           v
                        MongoDB
```

Realtime канал существует параллельно:

```text
Browser
   |
   | Socket.IO
   v
WebSocket Server
   |
   +--> Session Service
   +--> Speech Service
   +--> Translation Service
   +--> Room state
   +--> realtime chat
   +--> WebRTC signaling
```

---

## 31. Итог

HTTP API в Roomixвыполняет роль контролируемого request/response слоя между браузером и backend.

Основной путь:

```text
Frontend
   ↓
Axios
   ↓
Fastify route
   ↓
Authentication
   ↓
Service
   ↓
Mongoose
   ↓
MongoDB
```

А realtime часть сознательно отделена:

```text
Frontend
   ↓
Socket.IO
   ↓
WebSocket server
   ↓
Realtime services/state
```

Самое важное для понимания проекта:

```text
REST
=
получение и изменение persisted state

Socket.IO
=
realtime communication

Clerk
=
identity/authentication

Fastify
=
HTTP boundary

Services
=
business logic

Mongoose/MongoDB
=
persistence

React Query
=
frontend server-state management
```

Именно такое разделение позволяет Roomixодновременно поддерживать обычные CRUD/API-операции, историю сессий, загрузку файлов и realtime-функции видеокомнаты.
