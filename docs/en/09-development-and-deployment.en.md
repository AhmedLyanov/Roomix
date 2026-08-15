# Roomix— Development and Deployment

> English version of the project development and deployment documentation. The technical scope follows the available project material and does not invent infrastructure that is not present in the source.

## 1. Document Purpose

This document describes the practical side of developing Roomix: how the individual parts of the project are started, which tools are used, how the environment is organized, which configuration boundaries exist between the frontend, backend, MongoDB, and Python speech/translation service, and which problems appeared during development.

Important: this document describes the development workflow that is actually supported by the available project material. A complete production deployment pipeline is not presented in the source material as finished infrastructure, so this document does not invent a Docker/Kubernetes/CI/CD layer that is not there.

---

## 2. Project Layout

The project is divided into several independent parts:

```text
Roomix/
│
├── web/
│   └── Next.js / React frontend
│
├── server/
│   └── Fastify backend
│
├── translation/
│   └── Python speech / translation service
│
└── docs/
    └── project documentation
```

Архитектурно:

```text
web
  ↓
Next.js / React
  ↓
HTTP + Socket.IO
  ↓
server
  ↓
Fastify + Socket.IO + MongoDB
  ↓
translation
  ↓
Python ML services
```

The frontend, backend, and translation service are separate runtime components.

---

## 3. Frontend Development Environment

The frontend uses Next.js.

Bun was used in the development workflow:

```bash
bun dev
```

The command starts:

```text
next dev --webpack
```

The project logs show:

```text
▲ Next.js 16.2.9 (webpack)
- Local: http://localhost:3000
- Network: http://...
- Environments: .env.local
```

Therefore, the local frontend is normally available at:

```text
http://localhost:3000
```

---

## 4. Development Server on a Local Network

To access the frontend from another device, the following command was used:

```bash
bun run dev --hostname 0.0.0.0
```

что запускает:

```text
next dev --webpack --hostname "0.0.0.0"
```

После этого Next.js слушает все интерфейсы:

```text
Local:
http://localhost:3000

Network:
http://0.0.0.0:3000
```

This is especially useful when testing realtime features with multiple devices on the same network.

However, testing WebRTC over a LAN is not the same as a full production network test: NAT, firewalls, and public routing can behave differently.

---

## 5. Frontend Environment Variables

Next.js loads the local environment from:

```text
.env.local
```

The Next.js development logs explicitly show:

```text
Environments: .env.local
```

The frontend uses environment-based configuration for backend and realtime infrastructure addresses.

Например Socket.IO подключается через:

```ts
io(process.env.NEXT_PUBLIC_SIGNALING_URL!, {
  path: "/ws",
  transports: ["websocket"],
  forceNew: true,
});
```

Следовательно:

```text
NEXT_PUBLIC_SIGNALING_URL
        ↓
Socket.IO server
        ↓
/ws
```

This avoids hard-coding the backend URL directly into the frontend source code.

---

## 6. Backend Development Environment

The backend uses Fastify.

Backend development script:

```bash
bun dev
```

Запускает:

```text
fastify start -w -l info -P index.js
```

Where:

```text
-w
    watch mode

-l info
    info-level logging

-P index.js
    application entry point
```

In development, the backend runs on:

```text
http://localhost:5000
```

The logs show:

```text
Server listening at http://[::1]:5000
Server listening at http://127.0.0.1:5000
```

---

## 7. Backend Production-Style Start Command

В backend package configuration также присутствует:

```json
"start": "fastify start -l info index.js"
```

Unlike the development command:

```text
fastify start -w -l info -P index.js
```

the production-style `start` command does not use watch mode.

Таким образом:

```text
Development
    → fastify start -w ...

Start
    → fastify start ...
```

This separates the development workflow from the normal application start.

---

## 8. Backend Package Responsibilities

The backend package contains dependencies for several infrastructure layers:

```text
Fastify
Socket.IO
Mongoose
Clerk
Multipart
Static files
CORS
Swagger
Autoload
```

Основные библиотекand:

```text
fastify
fastify-cli
fastify-plugin
@fastify/autoload
@fastify/cors
@fastify/multipart
@fastify/static
@fastify/swagger
@fastify/swagger-ui
mongoose
socket.io
@clerk/backend
dotenv
```

Это соответствует архитектуре:

```text
HTTP
  → Fastify

Realtime
  → Socket.IO

Database
  → Mongoose

Authentication
  → Clerk

Files
  → Multipart + Static

API documentation
  → Swagger
```

---

## 9. MongoDB During Development

Backend подключается к MongoDB через Mongoose.

MongoDB is the persistence layer for:

```text
User
Session
SessionAction
RoomMessage
```

Development logs показывают:

```text
MongoDB connected successfully
```

After a successful connection, Fastify starts serving HTTP requests.

Типичный startup flow:

```text
Fastify start
    ↓
environment loading
    ↓
MongoDB connection
    ↓
plugins
    ↓
routes
    ↓
Socket.IO
    ↓
server listening
```

---

## 10. MongoDB Failure Example

During development, the following error was recorded:

```text
MongoDB connection failed

Error:
querySrv ECONNREFUSED
_mongodb._tcp....
```

This means the problem occurred at the DNS/SRV connection level to MongoDB Atlas, not in the frontend UI.

After the connection was restored, the backend again reported:

```text
MongoDB connected successfully
```

и начал принимать requests.

Practical debugging rule:

```text
MongoDB error
    ↓
проверять connection string
DNS/network
Atlas availability
credentials
environment
```

Не следует сразу искать проблему в Mongoose model.

---

## 11. Authentication Environment

The frontend uses Clerk through the Next.js integration.

The backend uses:

```text
@clerk/backend
```

и authentication plugin.

An HTTP route is protected with:

```js
preHandler: [fastify.authenticate];
```

Therefore, the development environment must contain correctly matched Clerk keys.

During development, the following case also occurred:

```text
Clerk:
Refreshing the session token resulted in an infinite redirect loop.
```

Clerk explicitly indicated that the cause was a mismatch between the publishable and secret keys.

Practical conclusion:

```text
Frontend Clerk keys
        +
Backend Clerk configuration
        ↓
must belong to the same Clerk instance/environment
```

---

## 12. Development Clerk Warning

The development console reports that development keys are being used.

This is expected for local development.

However, development keys should not be used as production configuration.

Before production deployment, the following is required:

```text
development Clerk instance
        ↓
production Clerk configuration
```

с соответствующими production environment variables.

---

## 13. Socket.IO Development Configuration

The realtime server uses Socket.IO.

Backend создаёт server с:

```text
path: "/ws"
```

Frontend использует тот же path:

```ts
io(SIGNALING_URL, {
  path: "/ws",
});
```

This is critical.

Если frontend использует:

```text
/ws
```

а backend ожидает другой Socket.IO path, соединение не установится.

Full chain:

```text
Browser
   ↓
NEXT_PUBLIC_SIGNALING_URL
   ↓
Socket.IO
   ↓
/ws
   ↓
Fastify server
```

---

## 14. Realtime Debugging

The following Socket.IO events were used:

```text
connect
connect_error
disconnect
```

When problems occurred, the browser showed:

```text
SOCKET CONNECT ERROR:
websocket error
```

That error should not automatically be interpreted as a WebRTC error.

Recommended check order:

```text
1. frontend URL
2. backend running?
3. Socket.IO path
4. CORS
5. WebSocket transport
6. network accessibility
7. authentication/configuration
8. only then WebRTC negotiation
```

Это важная практика: сначала проверить транспорт signaling, а затем уже peer connection.

---

## 15. Frontend Build Environment Issue

During development, Next.js detected multiple lockfiles:

```text
Roomix/package-lock.json
web/bun.lock
```

and displayed the warning:

```text
Next.js inferred your workspace root,
but it may not be correct.
```

This shows that the project historically used multiple package-manager contexts.

For stable development, it is important to avoid unnecessarily mixing dependency trees.

Практическand:

```text
Choose one package manager per workspace
or explicitly configure the workspace boundaries.
```

---

## 16. Why This Matters for Deployment

Inconsistent lockfiles can affect:

```text
dependency resolution
workspace detection
Next.js tracing
build reproducibility
```

In development, Next.js suggested:

```text
outputFileTracingRoot
```

or removing the unnecessary lockfile.

This is not an application-logic error, but it can become a problem during a production build.

---

## 17. Next.js Development Warnings

During development, warnings appeared for:

```text
Clerk createRouteMatcher is deprecated
```

and:

```text
Next.js inferred your workspace root
```

It is important to distinguish:

```text
warning
```

от:

```text
runtime error
```

For example, a deprecated API does not mean that the application is currently broken.

However, such warnings should be reviewed before production deployment because deprecated APIs may be removed in the next major version.

---

## 18. Development Testing of the Room

The main realtime scenario starts with:

```text
/room/:roomId
```

Frontend:

```text
open room
    ↓
request camera/microphone
    ↓
create MediaStream
    ↓
connect Socket.IO
    ↓
emit join-room
```

Backend:

```text
join-room
    ↓
register participant
    ↓
create/retrieve Session
    ↓
notify participants
```

After that, WebRTC negotiation begins.

---

## 19. Development Testing of WebRTC

Testing video communication requires at least two browser contexts.

Например:

```text
Browser A
    ↓
/room/abc

Browser B
    ↓
/room/abc
```

Оба должны подключиться к одному:

```text
roomId
```

After that, the expected result is:

```text
A sees B
B sees A
```

If participants cannot see each other, use this debugging chain:

```text
MediaStream
   ↓
Socket.IO connection
   ↓
join-room
   ↓
existing-users / user-connected
   ↓
createPeer
   ↓
offer
   ↓
answer
   ↓
ICE
   ↓
peer.on("stream")
```

---

## 20. Development Testing of Realtime Translation

Translation testing requires another chain:

```text
Microphone
    ↓
MediaStream
    ↓
AudioSender
    ↓
audio-chunk
    ↓
Socket.IO
    ↓
SpeechService
    ↓
Speech-to-Text
    ↓
recognized text
    ↓
language routing
    ↓
TranslationService
    ↓
translation
    ↓
subtitle
    ↓
Socket.IO
    ↓
React UI
```

If a subtitle does not appear, the translation model should not be blamed immediately.

The pipeline should be checked sequentially:

```text
microphone
→ AudioSender
→ audio-chunk
→ backend
→ speech recognition
→ recognized text
→ translation
→ subtitle event
→ frontend state
→ UI
```

---

## 21. Development Testing of Session History

After the room ends, the following can be opened:

```text
/session/:sessionId
```

Страница получает:

```text
Session
SessionActions
Participants
Files
Chat
```

The history allows persistence to be verified independently of the live room.

Typical test:

```text
1. create room
2. start session
3. join participant
4. upload file
5. send message
6. leave room
7. session finishes
8. open session history
```

A chronological timeline is expected.

---

## 22. Session History Debugging

For the history pipeline, it is important to distinguish:

```text
Session
```

and:

```text
SessionAction
```

Например:

```text
Session
    =
meeting metadata

SessionAction
    =
event timeline
```

Если action существует в MongoDB, но не отображается на frontend:

```text
MongoDB
   ↓
GET /sessions/:sessionId/actions
   ↓
Axios
   ↓
React Query
   ↓
SessionActions widget
```

Нужно проверять каждый boundary отдельно.

Это особенно важно для portfolio demonstration, потому что наличие persistence ещё не означает корректную UI delivery.

---

## 23. File Upload Testing

File upload используется через HTTP:

```text
POST /chat/:roomId/files
```

Тестирование:

```text
select file
    ↓
multipart request
    ↓
Fastify
    ↓
filesystem
    ↓
RoomMessage
    ↓
FILE_UPLOADED SessionAction
    ↓
chat:new
```

При корректной работе должны существовать три связанных representations:

```text
physical file
RoomMessage
SessionAction
```

---

## 24. Translation Service Development

Translation architecture отделяет Node.js orchestration от Python ML inference.

Концептуально:

```text
Node.js
    |
    +--> speech-to-text HTTP endpoint
    |
    +--> translation HTTP endpoint
```

Python service выполняет:

```text
speech recognition
translation
```

Node.js отвечает за:

```text
timing
routing
buffering
participant languages
Socket.IO delivery
fallback behavior
```

---

## 25. Why Python Is Separated

ML dependencies и realtime server имеют разные требования.

Node.js:

```text
Fastify
Socket.IO
Mongoose
HTTP
realtime orchestration
```

Python:

```text
audio/ML libraries
speech model
translation model
inference
```

Такое разделение позволяет не смешивать:

```text
application server
```

and:

```text
ML runtime
```

в один процесс.

---

## 26. Realtime Translation Development Checkpoints

Для диагностики translation pipeline полезно мыслить checkpoints.

### Checkpoint 1 — audio

```text
AudioSender
```

должен реально получать microphone audio.

### Checkpoint 2 — transport

Backend должен получать:

```text
audio-chunk
```

### Checkpoint 3 — speech

Speech service должен вернуть:

```text
recognized text
```

### Checkpoint 4 — routing

Backend должен определить:

```text
speaker language
listener languages
```

### Checkpoint 5 — translation

Translation service должен вернуть:

```text
translated text
```

### Checkpoint 6 — delivery

Socket.IO должен отправить:

```text
subtitle
```

### Checkpoint 7 — UI

Frontend должен обновить subtitle state.

---

## 27. Git Workflow

Разработка Roomixвелась через Git.

В истории проекта присутствуют feature/fix commits, например:

```text
Feature: added subtitles
```

and:

```text
feat: implement real-time speech translation pipeline
```

Также фиксировались изменения translation architecture.

Это показывает развитие системы поэтапно:

```text
basic realtime functionality
        ↓
subtitles
        ↓
speech pipeline
        ↓
translation pipeline
        ↓
session/history integration
```

---

## 28. Lint and Pre-Commit Checks

The project uses ESLint and a Husky/lint-staged workflow.

При commit запускались проверкand:

```text
eslint
eslint --fix
prettier
lint-staged
```

The project history contains cases where pre-commit ended with:

```text
husky - pre-commit script failed
```

At the same time, ESLint warnings and actual errors must be distinguished.

Например:

```text
✖ 8 problems
```

может содержать warnings, а не только blocking errors.

---

## 29. Example of a Blocking Lint Problem

Во время development был зафиксирован сценарий:

```text
eslint --fix [FAILED]
```

and:

```text
react-hooks/exhaustive-deps
```

Warnings также появлялись для:

```text
@typescript-eslint/no-unused-vars
```

и React refs в cleanup.

Практический подход:

```text
1. identify error severity
2. fix actual errors
3. review warnings
4. run lint again
5. commit only after expected checks pass
```

---

## 30. Temporary Debug Code

Temporary logs were used while developing session history and realtime features.

Например:

```text
SESSION ACTIONS
GET ACTIONS SESSION ID
GET ACTIONS RESULT
FILE ACTION CREATED
SESSION FOUND FOR FILE
```

Such logs are useful when investigating a problem across:

```text
database
→ API
→ React Query
→ UI
```

However, they should be removed after debugging is complete.

Production code should not contain exploratory logs for every intermediate state.

---

## 31. Debugging Methodology Used in the Project

For complex realtime features, boundary-based debugging is the most useful approach.

Например для session action:

```text
1. Was action created?
2. Does MongoDB contain it?
3. Does GET endpoint return it?
4. Does Axios receive it?
5. Does React Query store it?
6. Does component render it?
```

Для translation:

```text
1. Is microphone data produced?
2. Is audio chunk sent?
3. Is backend receiving it?
4. Is STT returning text?
5. Is translation returning text?
6. Is subtitle emitted?
7. Is React state updated?
8. Is subtitle rendered?
```

Это значительно эффективнее, чем хаотично менять frontend и backend одновременно.

---

## 32. Production Configuration Boundary

At the time of this documentation, the source material does not present a complete production deployment infrastructure.

Therefore, the following should not be claimed as existing:

```text
Docker production image
Kubernetes
CI/CD deployment
managed TURN
load balancer
horizontal Socket.IO scaling
production monitoring
```

unless the corresponding configuration/code actually exists.

What is actually present:

```text
Next.js frontend
Fastify backend
MongoDB
Python translation service
environment-based configuration
```

A production deployment will need to connect these components.

---

## 33. Production Architecture That Follows the Current Design

Логическая production topology должна выглядеть примерно так:

```text
                 Internet
                    |
              Reverse Proxy
                    |
          +---------+---------+
          |                   |
          v                   v
      Next.js              Fastify
          |                   |
          |             +-----+-----+
          |             |     |     |
          |             v     v     v
          |          MongoDB Socket.IO
          |                   |
          |              Python service
          |                   |
          +-------------------+
```

Это архитектурная схема, а не утверждение, что именно такой deployment уже реализован в проекте.

---

## 34. Production Concerns for WebRTC

WebRTC requires special attention during deployment.

The following must be considered:

```text
HTTPS
WSS
STUN
TURN
NAT
firewalls
```

The current WebRTC configuration demonstrates STUN, but not a complete TURN infrastructure.

Therefore, production-grade reliability will require:

```text
TURN relay
```

along with correct public network configuration.

---

## 35. Production Concerns for Socket.IO

In the current implementation, Socket.IO realtime state is stored in process memory:

```text
rooms = new Map()
users = new Map()
```

This means:

```text
one process
    =
one runtime state
```

При горизонтальном масштабированиand:

```text
Server A
Server B
Server C
```

these Maps will not automatically be shared.

Production scaling therefore requires a shared coordination layer, such as an appropriate Socket.IO adapter and shared infrastructure.

Это архитектурное направление для будущего production hardening, а не часть текущей реализации.

---

## 36. Production Concerns for MongoDB

MongoDB is already the persistent layer.

Production configuration should provide:

```text
secure connection string
network access
credentials
backups
indexes
monitoring
```

The connection string must not be stored in source code.

It should come from environment/secret management.

---

## 37. Production Concerns for Clerk

Production Clerk configuration must be separated from development configuration.

The following is required:

```text
production publishable key
production secret key
correct domains
correct redirect URLs
correct frontend/backend configuration
```

Нельзя смешивать development instance credentials с production instance.

---

## 38. Production Concerns for the Translation Service

The translation service is a separate ML runtime.

The production environment must account for:

```text
CPU/GPU availability
model memory
startup time
concurrent inference
request timeout
failure handling
model storage
```

This is particularly important because speech recognition and translation can be computationally expensive.

The realtime feature therefore depends not only on application correctness but also on inference latency.

---

## 39. Latency Budget of Realtime Translation

The translation feature is inherently latency-sensitive.

Full chain:

```text
speech
   ↓
audio capture
   ↓
buffer
   ↓
network
   ↓
speech recognition
   ↓
network
   ↓
translation
   ↓
network
   ↓
subtitle
```

Each stage adds latency.

Optimization should therefore consider the entire pipeline:

```text
total latency
=
capture
+
buffering
+
network
+
STT
+
translation
+
delivery
+
rendering
```

Это важнее, чем оптимизация одного отдельного function call.

---

## 40. Development vs. Production

| Area        | Development                | Production goal                  |
| ----------- | -------------------------- | -------------------------------- |
| Frontend    | Next.js dev server         | Next.js production build/runtime |
| Backend     | Fastify watch mode         | Fastify without watch            |
| MongoDB     | remote/dev database        | secured production database      |
| Clerk       | development instance       | production instance              |
| Socket.IO   | one process                | scalable realtime infrastructure |
| WebRTC      | STUN testing               | STUN + reliable TURN             |
| Translation | local Python service       | dedicated reliable ML runtime    |
| Logging     | verbose debugging          | structured operational logging   |
| Secrets     | `.env.local` / environment | managed secrets                  |
| Build       | local                      | reproducible CI/CD build         |

---

## 41. Practical Local Startup Sequence

For local development, it is logical to start the components in the following order:

```text
1. MongoDB access
       ↓
2. Backend
       ↓
3. Python translation service
       ↓
4. Frontend
       ↓
5. Browser
```

After backend startup, verify:

```text
MongoDB connected
Fastify listening
Socket.IO available
```

After frontend startup:

```text
Next.js ready
Clerk configured
API URL configured
Socket.IO URL configured
```

После этого можно тестировать room.

---

## 42. Full Development Verification

Before demonstrating the project, it is useful to run through the complete scenario:

```text
Start MongoDB access
      ↓
Start Fastify
      ↓
Start Python service
      ↓
Start Next.js
      ↓
Sign in
      ↓
Create room
      ↓
Join from second browser
      ↓
Verify video/audio
      ↓
Speak
      ↓
Verify subtitles
      ↓
Upload file
      ↓
Send chat message
      ↓
End room
      ↓
Open session history
      ↓
Verify actions
```

This test verifies almost the entire architecture at once.

---

## 43. Failure Isolation

If the complete scenario does not work, split the system into boundaries.

### Frontend issue

```text
Next.js
React
React Query
MediaStream
UI
```

### Backend issue

```text
Fastify
routes
services
MongoDB
```

### Realtime issue

```text
Socket.IO
WebRTC signaling
network
```

### ML issue

```text
SpeechService
Python
STT
Translation
```

Это позволяет быстро локализовать проблему.

---

## 44. Example: Socket.IO Failure

If the following appears:

```text
websocket error
```

do not immediately change the WebRTC code.

Check:

```text
Frontend
    ↓
NEXT_PUBLIC_SIGNALING_URL
    ↓
host/port
    ↓
Socket.IO path
    ↓
/ws
    ↓
Fastify
    ↓
CORS/network
```

Если Socket.IO не подключён, WebRTC signaling не может начаться.

---

## 45. Example: MongoDB Failure

If the backend reports:

```text
MongoDB connection failed
```

check:

```text
MONGODB_URI
    ↓
DNS
    ↓
Atlas network access
    ↓
credentials
    ↓
Mongoose connection
```

Пока MongoDB unavailable, persistence-dependent functionality не должна считаться рабочей.

---

## 46. Example: Translation Failure

If video communication works but subtitles are missing:

```text
WebRTC works
Socket.IO may work
Translation pipeline does not necessarily work
```

Check:

```text
AudioSender
    ↓
audio-chunk
    ↓
SpeechService
    ↓
STT
    ↓
recognized text
    ↓
TranslationService
    ↓
subtitle
```

Это отдельная pipeline.

Именно поэтому видео может продолжать работать даже при полном падении translation service.

---

## 47. Example: Session History Failure

If the session exists but an action is not displayed:

```text
Session
    ≠
SessionAction
```

Check:

```text
createSessionAction()
    ↓
MongoDB
    ↓
GET /sessions/:sessionId/actions
    ↓
Axios
    ↓
React Query
    ↓
SessionActions component
```

Такой boundary-based подход уже оказался полезным во время разработки session history.

---

## 48. What Should Be Known Before Deployment

Перед production deployment разработчик должен понимать:

```text
Frontend URL
Backend URL
Socket.IO URL/path
MongoDB URI
Clerk configuration
Python service URL
CORS configuration
WebRTC STUN/TURN configuration
file storage
environment variables
```

It is especially important not to copy development assumptions into production.

Например:

```text
localhost:3000
localhost:5000
localhost Python service
```

не являются production architecture.

---

## 49. What Is Currently Confirmed

The following are confirmed by the project material:

```text
Next.js 16.2.9 frontend
Fastify backend
Socket.IO on /ws
MongoDB + Mongoose
Clerk authentication
Python speech/translation service
Bun development commands
.env.local frontend environment
Fastify development watch mode
Fastify normal start command
```

The following working development flows are also confirmed:

```text
room creation
WebRTC communication
realtime subtitles
session persistence
session action history
chat
file upload
```

---

## 50. What Should Not Be Claimed During a Demonstration

Do not claim that the project already has:

```text
enterprise-scale WebRTC infrastructure
TURN redundancy
horizontal Socket.IO scaling
Kubernetes deployment
zero-downtime deployment
production-grade observability
fully automated CI/CD
```

unless these elements have actually been implemented.

For a portfolio project, an honest formulation is stronger:

> The current implementation is a working engineering prototype with a clear path toward production hardening.

Это показывает понимание не только того, что уже сделано, но и того, какие инженерные задачи появляются при масштабировании.

---

## 51. Development Philosophy

Roomixполезно рассматривать не как набор отдельных features, а как систему asynchronous boundaries:

```text
Browser
   ↓
Realtime transport
   ↓
Backend orchestration
   ↓
Persistence / ML
   ↓
Realtime delivery
```

Особенно это заметно в translation feature.

Одна фраза пользователя проходит через несколько runtime boundaries:

```text
microphone
   ↓
AudioWorklet
   ↓
Socket.IO
   ↓
SpeechService
   ↓
Python STT
   ↓
language routing
   ↓
Python translation
   ↓
Socket.IO
   ↓
React
```

Именно понимание этих границ делает debugging и дальнейшее развитие проекта управляемыми.

---

## 52. Final Development Architecture

```text
                         DEVELOPMENT
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
       Next.js             Fastify             Python
       :3000                :5000             ML service
          |                   |                   |
          |              +----+----+              |
          |              |         |              |
          |           MongoDB   Socket.IO <-------+
          |                         |
          +-------------------------+
                    realtime
```

Main idea:

```text
Frontend
    → UI + browser APIs

Fastify
    → API + orchestration

Socket.IO
    → realtime signaling/events

MongoDB
    → persistence

Python
    → speech/translation inference

WebRTC
    → actual media transport
```

---

## 53. Short Demonstration Explanation

If someone asks during a demonstration:

### “How do you run the project?”

Short answer:

> The project is split into a Next.js frontend, a Fastify backend, and a separate Python speech/translation service. During development the frontend runs through Next.js with Bun, the backend runs through Fastify CLI, MongoDB provides persistence, and the frontend connects to the backend over HTTP and Socket.IO.

### “How do you test the realtime room?”

> I run the frontend and backend, open the same room from two browser contexts, verify Socket.IO connectivity, then verify WebRTC peer negotiation, audio/video streams, and finally the translation pipeline.

### “What happens if translation fails?”

> The video communication itself is independent from translation. The speech/translation pipeline can fail while WebRTC continues to carry audio and video. The backend also has a fallback path where recognized original text can still be delivered as subtitle content.

### “Is it production-ready?”

> The current project is a working engineering prototype and portfolio demonstration. The main production-hardening areas would be TURN infrastructure, scalable Socket.IO state, stronger realtime authentication, managed secrets, deployment automation, monitoring, and dedicated ML infrastructure.

---

## 54. Final Summary

The development architecture of Roomixis based on independent runtime components:

```text
Next.js
   ↓
Frontend

Fastify
   ↓
Backend API + orchestration

Socket.IO
   ↓
Realtime communication + signaling

WebRTC
   ↓
Audio/video transport

MongoDB
   ↓
Persistent application data

Python
   ↓
Speech recognition + translation
```

The most important engineering lesson is that a realtime application should be debugged by boundaries.

For video:

```text
MediaStream
→ signaling
→ WebRTC
→ remote stream
```

For translation:

```text
audio
→ AudioSender
→ Socket.IO
→ STT
→ translation
→ subtitle
```

For session history:

```text
event
→ SessionAction
→ MongoDB
→ HTTP API
→ React Query
→ Session UI
```

Understanding these chains is more valuable than memorizing individual files, because each feature is ultimately a sequence of cooperating systems rather than a single function.
