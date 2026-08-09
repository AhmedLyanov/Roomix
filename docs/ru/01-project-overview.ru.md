# Merriweather

## Назначение

Merriweather — full-stack веб-приложение для проведения онлайн-сессий с видеосвязью, realtime-событиями, обменом сообщениями и файлами, переводом речи в реальном времени и сохранением детальной истории сессий.

Главная инженерная ценность проекта состоит в объединении нескольких realtime-конвейеров:

- WebRTC для передачи аудио и видео между браузерами.
- Socket.IO для signaling, событий комнаты и передачи аудиофрагментов.
- Speech-to-Text для распознавания речи.
- Machine Translation для перевода распознанного текста.
- Session Actions для постоянной истории событий.

## Архитектура

```text
Merriweather
├── web/
│   └── Next.js / React frontend
├── server/
│   └── Fastify backend
├── translation/
│   └── Python speech/translation service
└── docs/
    └── Project documentation
```

Frontend работает с камерой, микрофоном, WebRTC peer connections, Socket.IO, субтитрами и страницей истории. Backend предоставляет REST API, управляет сессиями и участниками, работает с MongoDB, принимает realtime-события и связывает frontend с speech/translation service.

## Room и Session

`roomId` идентифицирует realtime-комнату. Он используется Socket.IO и signaling-событиями.

`sessionId` идентифицирует конкретную историю встречи. Session хранит владельца, участников, время начала, время завершения и длительность. Связанные события хранятся в `SessionAction`.

Таким образом:

```text
Room
 └── realtime state

Session
 ├── participants
 ├── startedAt
 ├── endedAt
 ├── duration
 └── SessionActions
```

## Создание комнаты

Frontend генерирует идентификатор и открывает:

```text
/room/{roomId}
```

После получения MediaStream frontend создаёт Socket.IO connection и отправляет `join-room`.

Backend:

1. добавляет socket в Socket.IO room;
2. сохраняет участника в runtime-состоянии;
3. уведомляет существующих участников;
4. создаёт или получает активную Session;
5. добавляет нового участника в Session при необходимости.

## Видеосвязь

Видеосвязь реализована через WebRTC с `simple-peer`.

Socket.IO не передаёт сам видеопоток. Он используется как signaling transport:

```text
Browser A                    Browser B
    │                            │
    │──── offer ────────────────>│
    │<─── answer ────────────────│
    │<─── ICE candidates ───────>│
    │                            │
    └──── WebRTC media ──────────┘
```

Frontend использует `usePeer` для хранения peer connections и `useSocket` для передачи `offer`, `answer` и `ice-candidate`.

## Realtime translation

Перевод реализован отдельным realtime-конвейером:

```text
Microphone
   ↓
MediaStream
   ↓
AudioSender
   ↓
PCM audio chunks
   ↓
Socket.IO
   ↓
Fastify
   ↓
Speech Service
   ↓
recognized text
   ↓
Translation Service
   ↓
translated text
   ↓
Socket.IO
   ↓
subtitle
   ↓
UI
```

`AudioSender` получает аудиоданные, преобразует Float32 samples в Int16 PCM, отбрасывает тишину, собирает чанки и отправляет их через `audio-chunk`.

Backend передаёт аудио в speech service. После распознавания текста backend вызывает `TranslationService`, который обращается к отдельному Python translation service.

Результат возвращается frontend событием `subtitle`:

```ts
{
  originalText,
  translatedText,
  speakerId,
  sourceLanguage,
  targetLanguage
}
```

Frontend хранит субтитры по `speakerId` и отображает их поверх соответствующего видеопотока.

Подробный разбор этого конвейера должен находиться в `03-realtime-translation.md`.

## История сессии

Страница:

```text
/session/{sessionId}
```

получает Session и связанные Session Actions.

Основные endpoints:

```text
GET /sessions/{userId}
GET /sessions/details/{sessionId}
GET /sessions/{sessionId}/actions
```

Session содержит:

- owner;
- participants;
- startedAt;
- endedAt;
- duration.

SessionAction содержит:

- `_id`;
- `sessionId`;
- `type`;
- `userId`;
- `metadata`;
- `createdAt`.

Поддерживаемые типы действий включают:

```text
SESSION_STARTED
SESSION_ENDED
PARTICIPANT_JOINED
PARTICIPANT_LEFT
FILE_UPLOADED
MESSAGE_SENT
SCREEN_SHARED
```

Например, создание Session создаёт `SESSION_STARTED`, присоединение участника — `PARTICIPANT_JOINED`, загрузка файла — `FILE_UPLOADED`.

## Обмен файлами

Файлы загружаются через REST endpoint комнаты.

Backend сохраняет файл в `uploads`, создаёт `RoomMessage`, создаёт `FILE_UPLOADED` action для активной Session и отправляет `chat:new` через Socket.IO.

Физический файл и сообщение являются отдельными сущностями, связанными через metadata сообщения.

## Аутентификация

Для identity используется Clerk. Backend имеет authentication plugin, а Clerk webhook синхронизирует пользователей с MongoDB по `clerkId`.

## Технологический стек

### Frontend

- Next.js
- React
- TypeScript
- Socket.IO Client
- simple-peer
- TanStack Query
- Zustand
- Ant Design
- Clerk

### Backend

- Node.js
- Fastify
- Socket.IO
- Mongoose
- MongoDB
- Clerk
- multipart/static plugins

### Speech / Translation

- Python
- faster-whisper
- отдельный HTTP API для обработки перевода

## Где искать ключевые реализации

### Видеосвязь

```text
web/
├── use-media
├── use-peer
├── use-socket
└── use-room-session

server/plugins/websocket.js
```

### Realtime translation

```text
web/
├── AudioSender
├── use-media-controls
├── use-socket
└── use-room-session

server/
├── services/speech.service.js
├── services/translation.service.js
└── plugins/websocket.js

translation/
├── app.py
├── main.py
├── schemas.py
└── translator.py
```

### История сессии

```text
server/
├── models/Session.model.js
├── models/SessionAction.model.js
├── services/session.service.js
├── services/session-action.service.js
└── routes/sessions/index.js

web/
├── entities/session
├── entities/session-actions
└── session detail page
```

## Следующие документы

Документацию следует писать отдельными файлами и двигаться от общей картины к конкретной реализации:

1. `01-project-overview.md` — этот документ.
2. `02-room-and-webrtc.md` — создание комнаты и установление видеосвязи.
3. `03-realtime-translation.md` — полный технический разбор realtime translation.
4. `04-session-history.md` — Session, SessionAction и страница истории.
5. `05-realtime-architecture.md` — Socket.IO events и realtime data flow.
6. `06-backend-architecture.md` — Fastify, routes, services, models и plugins.
7. `07-frontend-architecture.md` — hooks, features, entities и widgets.
8. `08-data-models.md` — MongoDB schemas и связи.
9. `09-api-reference.md` — REST API.
10. `10-interview-guide.md` — объяснение проекта на технической демонстрации.

Особенно подробно должны быть разобраны документы `02`, `03` и `04`, поскольку они описывают три главные демонстрационные возможности проекта.
