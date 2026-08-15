# Roomix— Development and Deployment

## 1. Назначение документа

Этот документ описывает практическую сторону разработки Roomix: как запускаются отдельные части проекта, какие инструменты используются, как устроено окружение, какие конфигурационные границы существуют между frontend, backend, MongoDB и Python speech/translation service, а также какие проблемы возникали во время разработки.

Важно: этот документ описывает фактически подтверждённый development workflow проекта. Полноценный production deployment pipeline в исходных материалах не представлен как законченная инфраструктура, поэтому здесь не придумывается несуществующий Docker/Kubernetes/CI/CD слой.

---

## 2. Project layout

Проект разделён на несколько самостоятельных частей:

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

Frontend, backend и translation service являются отдельными runtime-компонентами.

---

## 3. Frontend development environment

Frontend использует Next.js.

В development workflow использовался Bun:

```bash
bun dev
```

Команда запускает:

```text
next dev --webpack
```

В логах проекта зафиксирован:

```text
▲ Next.js 16.2.9 (webpack)
- Local: http://localhost:3000
- Network: http://...
- Environments: .env.local
```

Следовательно, локальный frontend обычно доступен на:

```text
http://localhost:3000
```

---

## 4. Development server on a local network

Для доступа к frontend с другого устройства использовался:

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

Это особенно полезно при тестировании realtime-функций с несколькими устройствами в одной сети.

Однако WebRTC тестирование через LAN не равно полноценному production network test: NAT, firewall и публичная маршрутизация могут вести себя иначе.

---

## 5. Frontend environment variables

Next.js загружает локальное окружение из:

```text
.env.local
```

По логам разработки Next.js явно показывает:

```text
Environments: .env.local
```

В проекте frontend использует environment-based configuration для адресов backend/realtime infrastructure.

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

Это позволяет не зашивать backend URL непосредственно в frontend source code.

---

## 6. Backend development environment

Backend использует Fastify.

Development script backend:

```bash
bun dev
```

Запускает:

```text
fastify start -w -l info -P index.js
```

Где:

```text
-w
    watch mode

-l info
    info-level logging

-P index.js
    application entry point
```

В development backend запускается на:

```text
http://localhost:5000
```

В логах зафиксировано:

```text
Server listening at http://[::1]:5000
Server listening at http://127.0.0.1:5000
```

---

## 7. Backend production-style start command

В backend package configuration также присутствует:

```json
"start": "fastify start -l info index.js"
```

В отличие от development command:

```text
fastify start -w -l info -P index.js
```

production-style `start` не использует watch mode.

Таким образом:

```text
Development
    → fastify start -w ...

Start
    → fastify start ...
```

Это разделяет development workflow и обычный запуск приложения.

---

## 8. Backend package responsibilities

Backend package содержит зависимости для нескольких infrastructure layers:

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

Основные библиотеки:

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

## 9. MongoDB during development

Backend подключается к MongoDB через Mongoose.

MongoDB является persistence layer для:

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

После успешного подключения Fastify начинает обслуживать HTTP requests.

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

## 10. MongoDB failure example

Во время разработки была зафиксирована ошибка:

```text
MongoDB connection failed

Error:
querySrv ECONNREFUSED
_mongodb._tcp....
```

Это означает, что проблема возникла на уровне DNS/SRV connection к MongoDB Atlas, а не в frontend UI.

После восстановления соединения backend снова вывел:

```text
MongoDB connected successfully
```

и начал принимать requests.

Практический debugging rule:

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

## 11. Authentication environment

Frontend использует Clerk через Next.js integration.

Backend использует:

```text
@clerk/backend
```

и authentication plugin.

HTTP route защищается:

```js
preHandler: [fastify.authenticate];
```

Таким образом development environment должен содержать корректно согласованные Clerk keys.

Во время разработки также возникал случай:

```text
Clerk:
Refreshing the session token resulted in an infinite redirect loop.
```

Причиной Clerk прямо указывал mismatch между publishable и secret keys.

Практический вывод:

```text
Frontend Clerk keys
        +
Backend Clerk configuration
        ↓
must belong to the same Clerk instance/environment
```

---

## 12. Development Clerk warning

В development console появляется сообщение о том, что используются development keys.

Это ожидаемо для локальной разработки.

Однако development keys не следует использовать как production configuration.

Перед production deployment необходимо:

```text
development Clerk instance
        ↓
production Clerk configuration
```

с соответствующими production environment variables.

---

## 13. Socket.IO development configuration

Realtime server работает через Socket.IO.

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

Это принципиально важно.

Если frontend использует:

```text
/ws
```

а backend ожидает другой Socket.IO path, соединение не установится.

Полная цепочка:

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

## 14. Realtime debugging

Для Socket.IO использовались события:

```text
connect
connect_error
disconnect
```

При проблемах браузер показывал:

```text
SOCKET CONNECT ERROR:
websocket error
```

Такой error нельзя интерпретировать только как ошибку WebRTC.

Порядок проверки:

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

## 15. Frontend build environment issue

Во время development Next.js обнаруживал несколько lockfiles:

```text
Roomix/package-lock.json
web/bun.lock
```

и выводил предупреждение:

```text
Next.js inferred your workspace root,
but it may not be correct.
```

Это показывает, что проект исторически использовал несколько package manager contexts.

Для стабильной разработки важно избегать случайного смешивания dependency trees без необходимости.

Практически:

```text
Choose one package manager per workspace
or explicitly configure the workspace boundaries.
```

---

## 16. Why this matters for deployment

Несогласованные lockfiles могут влиять на:

```text
dependency resolution
workspace detection
Next.js tracing
build reproducibility
```

В development Next.js предлагал:

```text
outputFileTracingRoot
```

или устранение лишнего lockfile.

Это не является ошибкой application logic, но может становиться проблемой при production build.

---

## 17. Next.js development warnings

Во время разработки появлялись warnings:

```text
Clerk createRouteMatcher is deprecated
```

и:

```text
Next.js inferred your workspace root
```

Важно отличать:

```text
warning
```

от:

```text
runtime error
```

Например deprecated API не означает, что приложение сейчас не работает.

Но перед production deployment такие warnings следует пересмотреть, потому что deprecated APIs могут быть удалены в следующей major version.

---

## 18. Development testing of the room

Основной realtime сценарий начинается с:

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

После этого начинается WebRTC negotiation.

---

## 19. Development testing of WebRTC

Для тестирования видеосвязи необходимо минимум два browser contexts.

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

После этого ожидается:

```text
A sees B
B sees A
```

Если участники не видят друг друга, debugging chain:

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

## 20. Development testing of realtime translation

Translation testing требует ещё одной цепочки:

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

Если subtitle не появляется, нельзя сразу обвинять translation model.

Проверять необходимо последовательно:

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

## 21. Development testing of session history

После завершения комнаты можно открыть:

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

История позволяет проверить persistence независимо от live room.

Типичный тест:

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

Ожидается chronological timeline.

---

## 22. Session history debugging

Для history pipeline важно разделять:

```text
Session
```

и:

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

## 23. File upload testing

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

## 24. Translation service development

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

## 25. Why Python is separated

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

и:

```text
ML runtime
```

в один процесс.

---

## 26. Realtime translation development checkpoints

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

## 27. Git workflow

Разработка Roomixвелась через Git.

В истории проекта присутствуют feature/fix commits, например:

```text
Feature: added subtitles
```

и:

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

## 28. Lint and pre-commit checks

Проект использует ESLint и Husky/lint-staged workflow.

При commit запускались проверки:

```text
eslint
eslint --fix
prettier
lint-staged
```

В истории проекта встречались ситуации, когда pre-commit завершался с:

```text
husky - pre-commit script failed
```

При этом warnings ESLint и реальные errors необходимо различать.

Например:

```text
✖ 8 problems
```

может содержать warnings, а не только blocking errors.

---

## 29. Example of a blocking lint problem

Во время development был зафиксирован сценарий:

```text
eslint --fix [FAILED]
```

и:

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

## 30. Temporary debug code

При разработке session history и realtime features использовались временные logs.

Например:

```text
SESSION ACTIONS
GET ACTIONS SESSION ID
GET ACTIONS RESULT
FILE ACTION CREATED
SESSION FOUND FOR FILE
```

Такие logs полезны при расследовании проблемы:

```text
database
→ API
→ React Query
→ UI
```

Но после завершения debugging их следует удалить.

Production code не должен содержать исследовательский лог каждого промежуточного состояния.

---

## 31. Debugging methodology used in the project

Для сложных realtime features наиболее полезен boundary-based debugging.

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

## 32. Production configuration boundary

На момент описания проекта полноценный production deployment infrastructure не представлен в исходных материалах.

Поэтому нельзя утверждать наличие:

```text
Docker production image
Kubernetes
CI/CD deployment
managed TURN
load balancer
horizontal Socket.IO scaling
production monitoring
```

если соответствующий configuration/code отсутствует.

Что действительно существует:

```text
Next.js frontend
Fastify backend
MongoDB
Python translation service
environment-based configuration
```

Production deployment должен соединить эти компоненты.

---

## 33. Production architecture that follows the current design

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

## 34. Production concerns for WebRTC

WebRTC требует особого внимания при deployment.

Необходимо учитывать:

```text
HTTPS
WSS
STUN
TURN
NAT
firewalls
```

В текущей реализации WebRTC configuration демонстрирует STUN, но не полноценную TURN infrastructure.

Следовательно, для production-grade reliability потребуется:

```text
TURN relay
```

и корректная публичная network configuration.

---

## 35. Production concerns for Socket.IO

Socket.IO realtime state в текущей реализации хранится в памяти процесса:

```text
rooms = new Map()
users = new Map()
```

Это означает:

```text
one process
    =
one runtime state
```

При горизонтальном масштабировании:

```text
Server A
Server B
Server C
```

эти Maps не будут автоматически общими.

Production scaling therefore requires a shared coordination layer, for example an appropriate Socket.IO adapter and shared infrastructure.

Это архитектурное направление для будущего production hardening, а не часть текущей реализации.

---

## 36. Production concerns for MongoDB

MongoDB уже является persistent layer.

Production configuration должна обеспечивать:

```text
secure connection string
network access
credentials
backups
indexes
monitoring
```

Connection string не должен находиться в source code.

Он должен поступать из environment/secret management.

---

## 37. Production concerns for Clerk

Production Clerk configuration должна быть отделена от development configuration.

Необходимо:

```text
production publishable key
production secret key
correct domains
correct redirect URLs
correct frontend/backend configuration
```

Нельзя смешивать development instance credentials с production instance.

---

## 38. Production concerns for translation service

Translation service является отдельным ML runtime.

Production environment должен учитывать:

```text
CPU/GPU availability
model memory
startup time
concurrent inference
request timeout
failure handling
model storage
```

Особенно важно, что speech recognition и translation могут быть computationally expensive.

Realtime feature therefore depends not only on application correctness but also on inference latency.

---

## 39. Latency budget of realtime translation

Translation feature is inherently latency-sensitive.

Полная цепочка:

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

Каждый этап добавляет latency.

Поэтому оптимизация должна рассматривать весь pipeline:

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

## 40. Development vs production

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

## 41. Practical local startup sequence

Для локального development логично запускать компоненты в следующем порядке:

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

После backend startup необходимо убедиться:

```text
MongoDB connected
Fastify listening
Socket.IO available
```

После frontend startup:

```text
Next.js ready
Clerk configured
API URL configured
Socket.IO URL configured
```

После этого можно тестировать room.

---

## 42. Full development verification

Перед демонстрацией проекта полезно пройти полный сценарий:

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

Этот тест одновременно проверяет почти всю архитектуру.

---

## 43. Failure isolation

Если полный сценарий не работает, систему необходимо разделять на boundaries.

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

## 44. Example: Socket.IO failure

Если появляется:

```text
websocket error
```

не нужно сразу менять WebRTC code.

Проверяется:

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

## 45. Example: MongoDB failure

Если backend сообщает:

```text
MongoDB connection failed
```

проверяется:

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

## 46. Example: translation failure

Если видеосвязь работает, но subtitles отсутствуют:

```text
WebRTC works
Socket.IO may work
Translation pipeline does not necessarily work
```

Проверяется:

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

## 47. Example: session history failure

Если session существует, но action не отображается:

```text
Session
    ≠
SessionAction
```

Проверяется:

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

## 48. What should be known before deployment

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

Особенно важно не копировать development assumptions в production.

Например:

```text
localhost:3000
localhost:5000
localhost Python service
```

не являются production architecture.

---

## 49. What is currently confirmed

По материалам проекта подтверждены:

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

Также подтверждены рабочие development flows:

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

## 50. What should not be claimed during a demonstration

Не следует утверждать, что проект уже имеет:

```text
enterprise-scale WebRTC infrastructure
TURN redundancy
horizontal Socket.IO scaling
Kubernetes deployment
zero-downtime deployment
production-grade observability
fully automated CI/CD
```

если эти элементы не реализованы.

Для portfolio project честная формулировка сильнее:

> The current implementation is a working engineering prototype with a clear path toward production hardening.

Это показывает понимание не только того, что уже сделано, но и того, какие инженерные задачи появляются при масштабировании.

---

## 51. Development philosophy

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

## 52. Final development architecture

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

Главная идея:

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

## 53. Short demonstration explanation

Если на демонстрации спрашивают:

### “How do you run the project?”

Краткий ответ:

> The project is split into a Next.js frontend, a Fastify backend, and a separate Python speech/translation service. During development the frontend runs through Next.js with Bun, the backend runs through Fastify CLI, MongoDB provides persistence, and the frontend connects to the backend over HTTP and Socket.IO.

### “How do you test the realtime room?”

> I run the frontend and backend, open the same room from two browser contexts, verify Socket.IO connectivity, then verify WebRTC peer negotiation, audio/video streams, and finally the translation pipeline.

### “What happens if translation fails?”

> The video communication itself is independent from translation. The speech/translation pipeline can fail while WebRTC continues to carry audio and video. The backend also has a fallback path where recognized original text can still be delivered as subtitle content.

### “Is it production-ready?”

> The current project is a working engineering prototype and portfolio demonstration. The main production-hardening areas would be TURN infrastructure, scalable Socket.IO state, stronger realtime authentication, managed secrets, deployment automation, monitoring, and dedicated ML infrastructure.

---

## 54. Final summary

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
