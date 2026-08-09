# Merriweather — Authentication and HTTP API

## 1. Document Purpose

This document describes the HTTP layer of Merriweather and the authentication mechanism between the frontend and backend.

The project uses two primary communication mechanisms:

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

## 2. General HTTP Architecture

The main flow is:

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

The frontend should not know the details of MongoDB or Mongoose.

Its responsibility is:

```text
создать HTTP request
        ↓
передать необходимые данные
        ↓
получить response
        ↓
обновить UI/server state
```

The backend is responsible for:

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

The backend is built with Fastify.

The backend entry point is responsible for:

- создание Fastify application;
- загрузку environment variables;
- CORS;
- подключение MongoDB;
- регистрацию plugins;
- регистрацию routes;
- запуск сервера.

Approximate structure:

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

Clerk is used for authentication.

The backend uses:

```text
@clerk/backend
```

и Fastify decorator:

```text
fastify.authenticate
```

HTTP request authentication is performed through `preHandler`.

For example:

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

This means:

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

## 5. Frontend Authentication Token

The frontend uses Clerk to obtain an access token.

Общий Axios client располагается в:

```text
web/src/shared/api/client.ts
```

Before sending an HTTP request, the client obtains the token and adds it to:

```http
Authorization: Bearer <token>
```

This allows the backend to perform verification through:

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

## 6. Why Authentication Is Centralized in the Shared API Client

Without a shared client, every endpoint would have to handle:

```text
получением token
добавлением Authorization
```

This would lead to duplication of the same code.

Instead, a single shared point is used:

```text
api
 |
 +--> authentication header
 +--> baseURL
 +--> HTTP configuration
```

Поэтому feature API-функции могут заниматься только своим endpoint.

For example:

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

Session History uses the following endpoint:

```http
GET /sessions/:sessionId/actions
```

Route:

```text
server/routes/sessions/index.js
```

Flow:

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

## 8. Session Details API

The Session itself is fetched separately:

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

This is intentionally different from the history endpoint.

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

One endpoint returns the Session.

The other returns an array of SessionAction events.

---

## 9. Sessions List API

Getting a user's sessions:

```http
GET /sessions/:userId
```

The route calls:

```text
getSessions(userId)
```

The service executes:

```js
Session.find({
  ownerId: userId
}).sort({
  startedAt: -1
})
```

Therefore, the list is returned from newest sessions to oldest.

---

## 10. Delete Session API

Deletion:

```http
DELETE /sessions/:id
```

The route calls:

```text
deleteSession(id)
```

The service uses:

```text
Session.findByIdAndDelete()
```

Successful response:

```http
204 No Content
```

---

## 11. File Upload API

File upload is performed through:

```http
POST /chat/:roomId/files
```

Этот endpoint также защищён:

```text
fastify.authenticate
```

Flow:

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

This is a good example of how one HTTP operation can affect multiple subsystems.

---

## 12. File Storage

The file itself is not stored directly inside MongoDB.

The backend creates:

```text
uploads/
```

and generates a unique name:

```text
crypto.randomUUID()
```

The original file extension is preserved.

Получается примерно:

```text
uploads/
   |
   +-- 7c4...a91.pdf
   +-- 2af...91b.png
```

The following metadata is stored in `RoomMessage`:

```text
originalName
storedName
mimeType
size
url
```

MongoDB stores file information, while the filesystem stores the actual bytes.

---

## 13. Why the Filename Is Generated Again

The original filename is not used as the physical filename.

Instead:

```text
originalName
```

остаётся metadata, а:

```text
storedName
```

генерируется отдельно.

This prevents simple filename collisions:

```text
document.pdf
document.pdf
document.pdf
```

Multiple users can upload files with the same original name, while the physical files will have different generated names.

---

## 14. File Upload and Session History

A file upload belongs to two subsystems at the same time.

### Chat/File subsystem

Created:

```text
RoomMessage
```

### Session History

Created:

```text
SessionAction
```

with:

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

which links the history entry to the corresponding message.

---

## 15. Translation HTTP API

The project also contains an HTTP route for translation.

It is important to distinguish two things:

```text
real-time translation
```

and:

```text
translation HTTP endpoint
```

The main realtime pipeline uses Socket.IO:

```text
audio-chunk
   ↓
speechService
   ↓
translationService
   ↓
subtitle
```

The HTTP translation route is a separate API layer/proxy.

Поэтому нельзя описывать весь realtime translation как обычный REST request.

---

## 16. REST vs Socket.IO

The project deliberately separates the two communication channels.

### REST

Suitable for:

```text
GET session
GET sessions
GET session actions
POST file upload
translation HTTP proxy
DELETE session
```

That is, for operations following:

```text
request → processing → response
```

### Socket.IO

Suitable for:

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

Backend routes use error handling.

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

This allows the backend to:

```text
не отдавать stack trace frontend
```

and return a controlled HTTP response.

For example:

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

The project uses standard HTTP status codes.

For example:

```text
200
```

for a successful GET.

```text
201
```

for a successfully created resource, such as a file message.

```text
204
```

for a successful deletion with no response body.

```text
400
```

for an invalid request.

For example:

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

for an unexpected backend error.

---

## 20. Frontend API layer

Frontend API functions are separated from the UI.

For example:

```text
entities/session-actions/api/get-session-actions.ts
```

Содержит:

```text
getSessionActions(sessionId)
```

The UI does not directly perform:

```text
axios.get(...)
```

inside JSX.

Instead:

```text
UI
 ↓
React Query hook
 ↓
API function
 ↓
shared axios client
```

This separates:

```text
presentation
server-state logic
HTTP transport
```

---

## 21. React Query и HTTP

Server state is managed with:

```text
@tanstack/react-query
```

For example:

```text
useSessionActions()
```

вызывает:

```text
getSessionActions()
```

React Query manages:

```text
loading
data
cache
refetch
query lifecycle
```

Therefore:

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

When the user opens the history page:

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

This is the complete HTTP data flow for the history feature.

---

## 23. Authentication boundaries

In the current architecture, HTTP and WebSocket have different authentication boundaries.

HTTP routes explicitly use:

```text
fastify.authenticate
```

for example:

```text
GET /sessions/:sessionId/actions
POST /chat/:roomId/files
DELETE /sessions/:id
```

The WebSocket connection is established through Socket.IO.

In the current implementation, `join-room` receives:

```text
userId
userName
nativeLanguage
userAvatar
```

from the client payload.

This means HTTP request authentication and Socket.IO event authentication are implemented differently.

Это важный момент при техническом review.

---

## 24. Что это означает с точки зрения безопасности

You cannot automatically assume:

```text
HTTP protected
```

and:

```text
WebSocket protected
```

that they are the same.

В текущем коде:

```text
HTTP
  ↓
fastify.authenticate
  ↓
Clerk token verification
```

while Socket.IO uses:

```text
connect
  ↓
join-room payload
  ↓
room state
```

and does not use the same `fastify.authenticate` flow to verify `join-room`.

Therefore, full WebSocket authentication/authorization is a separate area for future hardening.

This describes the actual architecture and does not claim that WebSocket is necessarily vulnerable in every deployment.

---

## 25. Data ownership

Each layer has its own responsibility.

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

For example:

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

The architecture can be viewed as this boundary:

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

The frontend should not know:

```text
SessionAction.find(...)
```

The backend should not depend on a React component.

MongoDB should not be directly accessible from the browser.

Each layer has its own responsibility.

---

## 27. Основные HTTP endpoints

| Method | Endpoint | Назначение |
|---|---|---|
| `GET` | `/sessions/:userId` | список сессий пользователя |
| `GET` | `/sessions/details/:id` | детали сессии |
| `GET` | `/sessions/:sessionId/actions` | история SessionAction |
| `DELETE` | `/sessions/:id` | удаление сессии |
| `POST` | `/chat/:roomId/files` | загрузка файла |
| `GET` | `/chat/:roomId/files` | список файлов комнаты |
| `GET` | `/chat/:roomId/messages` | сообщения комнаты |
| translation route | translation endpoint | HTTP proxy для перевода |

Конкретная авторизация применяется на защищённых routes через:

```text
fastify.authenticate
```

---

## 28. HTTP request lifecycle

Typical authenticated request:

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

After studying this layer, a developer should understand these boundaries:

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

The realtime channel exists in parallel:

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

The HTTP API in Merriweather acts as a controlled request/response layer between the browser and backend.

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

The realtime layer is deliberately separated:

```text
Frontend
   ↓
Socket.IO
   ↓
WebSocket server
   ↓
Realtime services/state
```

The most important architectural distinction to understand is:

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

This separation allows Merriweather to support conventional CRUD/API operations, session history, file uploads, and realtime video-room functionality at the same time.