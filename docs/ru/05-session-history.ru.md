# Roomix— Session History / Action History

## 1. Назначение

Session History — это отдельный слой истории работы комнаты.

Его задача не в том, чтобы хранить всю Session целиком, а в том, чтобы записывать отдельные события, произошедшие во время сессии:

```text
Session
   |
   +---- SessionAction
   |        |
   |        +-- SESSION_STARTED
   |        +-- PARTICIPANT_JOINED
   |        +-- FILE_UPLOADED
   |        +-- ...
   |
   +---- participants
```

`SessionAction` хранится отдельной MongoDB collection. Это позволяет не раздувать документ `Session` историческими событиями и отдельно запрашивать timeline действий.

В проекте фактически создаются только:

```text
SESSION_STARTED
PARTICIPANT_JOINED
FILE_UPLOADED
```

Некоторые другие action types объявлены в enum/schema, но код их создания отсутствует.

---

## 2. Архитектура

Основной flow:

```text
Socket.IO
   |
   | join-room
   v
createSession()
   |
   v
Session
   |
   v
createSessionAction()
   |
   v
SessionAction
   |
   v
MongoDB
```

Получение истории:

```text
Session History page
        |
        v
useSessionActions(sessionId)
        |
        v
getSessionActions()
        |
        v
Axios
        |
        v
GET /sessions/:sessionId/actions
        |
        v
session-action.service.js
        |
        v
SessionAction.find(...)
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
        |
        v
timeline
```

---

# 3. Session и SessionAction — разные сущности

Важно не путать их.

`Session` описывает саму сессию.

`SessionAction` описывает событие внутри этой сессии.

То есть:

```text
Session
  "сессия 123 существовала с момента X"

SessionAction
  "в момент X сессия была создана"
  "в момент Y присоединился пользователь"
  "в момент Z был загружен файл"
```

Связь:

```text
Session
   |
   | 1
   |
   +------------------+
                      |
                      | N
                      v
               SessionAction
```

Каждый `SessionAction` содержит `sessionId`, который ссылается на соответствующую Session.

---

# 4. SessionAction.model.js

По фактической структуре модели:

```text
sessionId
type
userId
metadata
createdAt
updatedAt
```

### `sessionId`

Тип:

```text
ObjectId
```

Reference:

```text
Session
```

Он определяет, к какой сессии относится действие.

### `type`

Enum действия.

В проекте объявлены:

```text
SESSION_STARTED
SESSION_ENDED
PARTICIPANT_JOINED
PARTICIPANT_LEFT
FILE_UPLOADED
MESSAGE_SENT
SCREEN_SHARED
```

Но наличие значения в enum ещё не означает, что оно реально генерируется приложением.

### `userId`

Идентификатор пользователя, связанного с action.

### `metadata`

Объект с дополнительной информацией.

Например для `FILE_UPLOADED` metadata содержит:

```text
fileName
fileSize
mimeType
messageId
```

### timestamps

Mongoose автоматически хранит:

```text
createdAt
updatedAt
```

Это позволяет сортировать actions по времени.

---

# 5. Почему отдельная collection

В проекте SessionAction вынесен отдельно.

Идея:

```text
Session
{
   ...
}

SessionAction
{
   sessionId,
   type,
   userId,
   metadata,
   createdAt
}
```

а не:

```text
Session
{
   ...
   actions: [
      {...},
      {...},
      {...}
   ]
}
```

Это удобно для истории:

```js
SessionAction.find({
  sessionId,
});
```

и позволяет отдельно получать timeline.

По материалам проекта отдельно отмечено, что такой подход нужен, чтобы не раздувать `Session` и быстрее запрашивать history.

---

# 6. `createSessionAction()`

Центральная функция записи history:

```text
session-action.service.js
```

Функция:

```text
createSessionAction()
```

Её задача — создать документ `SessionAction`.

Концептуально:

```text
createSessionAction({
   sessionId,
   type,
   userId,
   metadata
})
        |
        v
SessionAction.create(...)
        |
        v
MongoDB
```

Таким образом business logic отдельных событий вызывает единый service для записи action.

---

# 7. SESSION_STARTED

Первое фактически создаваемое действие:

```text
SESSION_STARTED
```

Оно возникает в:

```text
session.service.js
```

в функции:

```text
createSession()
```

Flow:

```text
join-room
    |
    v
createSession()
    |
    +--> Session.create(...)
    |
    +--> createSessionAction(...)
             |
             +--> SESSION_STARTED
```

Metadata:

```js
{
  ownerName;
}
```

То есть история знает, кто был владельцем/создателем сессии.

---

# 8. Где создаётся Session

Session создаётся не на frontend напрямую.

Frontend отправляет:

```text
join-room
```

через Socket.IO.

Backend вызывает:

```text
createSession()
```

Внутри выполняется проверка существующей активной Session:

```text
Session.findOne({
   roomId,
   endedAt: { $exists: false }
})
```

Если активной Session нет, создаётся новая:

```text
Session.create(...)
```

После этого создаётся:

```text
SESSION_STARTED
```

Таким образом frontend не занимается непосредственной записью Session в MongoDB.

---

# 9. PARTICIPANT_JOINED

Когда новый пользователь присоединяется к уже активной Session, используется:

```text
joinParticipant()
```

Он также находится в:

```text
session.service.js
```

При присоединении создаётся:

```text
PARTICIPANT_JOINED
```

Metadata:

```js
{
  userName;
}
```

Flow:

```text
join-room
    |
    v
активная Session найдена
    |
    v
joinParticipant()
    |
    v
createSessionAction()
    |
    v
PARTICIPANT_JOINED
    |
    v
MongoDB
```

---

# 10. FILE_UPLOADED

Это третий action, который реально создаётся.

Он возникает при загрузке файла в чат.

Endpoint:

```text
POST /chat/:roomId/files
```

Реализация находится в:

```text
RoomMessage.route.js
```

Flow:

```text
POST /chat/:roomId/files
        |
        v
RoomMessage.create(...)
        |
        v
Session.findOne({
   roomId,
   endedAt: { $exists: false }
})
        |
        v
createSessionAction(...)
        |
        v
FILE_UPLOADED
        |
        v
MongoDB
```

Metadata:

```text
fileName
fileSize
mimeType
messageId
```

---

# 11. Почему сначала создаётся RoomMessage

Файл является частью chat/file subsystem.

Поэтому сначала создаётся:

```text
RoomMessage
```

и только затем history связывает эту операцию с Session:

```text
RoomMessage
    |
    +--> messageId
    |
    v
SessionAction
    |
    +--> type: FILE_UPLOADED
    +--> metadata.messageId
```

Это позволяет history знать, какой именно файл был загружен.

---

# 12. Actions, которые только объявлены

В enum/schema присутствуют:

```text
SESSION_ENDED
PARTICIPANT_LEFT
MESSAGE_SENT
SCREEN_SHARED
```

Но они не являются фактически создаваемыми actions в текущей реализации.

Это важно.

Нельзя говорить:

> "При disconnect проект создаёт SESSION_ENDED."

Фактически код создания `SESSION_ENDED` отсутствует.

Нельзя говорить:

> "При выходе участника создаётся PARTICIPANT_LEFT."

Код создания этого action также отсутствует.

Нельзя говорить:

> "Каждое сообщение создаёт MESSAGE_SENT."

Сообщения сохраняются через `RoomMessage`, но `MESSAGE_SENT` как SessionAction не создаётся.

`SCREEN_SHARED` также объявлен, но код создания отсутствует.

---

# 13. Таблица реальных actions

| Action               | Есть в enum | Реально создаётся | Где создаётся                            | Metadata                                        |
| -------------------- | ----------: | ----------------: | ---------------------------------------- | ----------------------------------------------- |
| `SESSION_STARTED`    |          Да |                Да | `session.service.js → createSession()`   | `{ ownerName }`                                 |
| `SESSION_ENDED`      |          Да |               Нет | Нет                                      | Нет фактической записи                          |
| `PARTICIPANT_JOINED` |          Да |                Да | `session.service.js → joinParticipant()` | `{ userName }`                                  |
| `PARTICIPANT_LEFT`   |          Да |               Нет | Нет                                      | Нет фактической записи                          |
| `FILE_UPLOADED`      |          Да |                Да | `RoomMessage.route.js`                   | `fileName`, `fileSize`, `mimeType`, `messageId` |
| `MESSAGE_SENT`       |          Да |               Нет | Нет                                      | Сообщение хранится в `RoomMessage`              |
| `SCREEN_SHARED`      |          Да |               Нет | Нет                                      | Нет фактической записи                          |

Это один из важных моментов для защиты проекта: schema и runtime behavior здесь не полностью совпадают.

---

# 14. Получение истории

Для получения history существует endpoint:

```text
GET /sessions/:sessionId/actions
```

Он находится в sessions routes:

```text
index.js
```

Route вызывает:

```text
getSessionActions(sessionId)
```

из:

```text
session-action.service.js
```

---

# 15. `getSessionActions()`

Service выполняет запрос:

```js
SessionAction.find({
  sessionId,
}).sort({
  createdAt: 1,
});
```

Ключевой момент:

```text
createdAt: 1
```

означает сортировку по возрастанию.

Следовательно, frontend получает actions в chronological order:

```text
SESSION_STARTED
       ↓
PARTICIPANT_JOINED
       ↓
FILE_UPLOADED
       ↓
...
```

Это естественный порядок timeline.

---

# 16. REST endpoint

Полный путь:

```text
GET /sessions/:sessionId/actions
```

Например:

```text
GET /sessions/6a78750c96a62efdb4f4860a/actions
```

Backend:

```text
route
  ↓
getSessionActions(sessionId)
  ↓
SessionAction.find({ sessionId })
  ↓
sort(createdAt: 1)
  ↓
JSON response
```

---

# 17. Frontend API client

Frontend использует общий Axios client:

```text
web/src/shared/api/client.ts
```

В нём создаётся:

```ts
axios.create({
  baseURL: "http://localhost:5000",
});
```

Также request interceptor получает access token:

```ts
const token = await getAccessTokenValue();

if (token) {
  config.headers.Authorization = `Bearer ${token}`;
}
```

То есть REST history request проходит через общий API client.

---

# 18. `get-session-actions.ts`

Frontend API function:

```text
get-session-actions.ts
```

Функция:

```ts
getSessionActions(sessionId);
```

делает:

```ts
const { data } = await api.get<SessionAction[]>(
  `/sessions/${sessionId}/actions`,
);
```

и возвращает:

```text
SessionAction[]
```

Полный путь:

```text
React
  |
  v
getSessionActions(sessionId)
  |
  v
Axios api
  |
  v
GET /sessions/:sessionId/actions
```

---

# 19. Почему API function отделена от React hook

Архитектурно здесь разделены две ответственности.

`get-session-actions.ts` знает:

```text
как запросить данные
```

`use-session-actions.ts` знает:

```text
как интегрировать запрос с React Query
```

Получается:

```text
Component
    |
    v
useSessionActions()
    |
    v
getSessionActions()
    |
    v
Axios
```

Это не позволяет UI напрямую управлять HTTP request details.

---

# 20. `useSessionActions()`

Hook находится:

```text
use-session-actions.ts
```

Использует:

```text
@tanstack/react-query
```

Кодовая структура:

```ts
return useQuery({
  queryKey: ["session-actions", sessionId],
  queryFn: () => getSessionActions(sessionId),
  enabled: Boolean(sessionId),
});
```

Здесь есть три важных вещи.

---

# 21. `queryKey`

Используется:

```ts
["session-actions", sessionId];
```

Например:

```text
["session-actions", "abc123"]
```

Это идентифицирует cache entry конкретной Session.

Для другой Session:

```text
["session-actions", "xyz789"]
```

будет другой cache entry.

То есть history разных Session не смешивается.

---

# 22. `queryFn`

Используется:

```ts
() => getSessionActions(sessionId);
```

React Query вызывает API function.

Получается:

```text
useSessionActions
       |
       v
React Query
       |
       v
getSessionActions
       |
       v
Axios
       |
       v
GET /sessions/:sessionId/actions
```

---

# 23. `enabled`

Используется:

```ts
enabled: Boolean(sessionId);
```

Если:

```text
sessionId = ""
```

запрос не выполняется.

Если:

```text
sessionId = "abc"
```

React Query может выполнить query.

Это защищает компонент от запроса с отсутствующим session ID.

---

# 24. SessionActions component

Компонент:

```text
session-actions.tsx
```

использует:

```text
useSessionActions(sessionId)
```

Получает:

```text
actions
loading state
error state
```

и рендерит timeline.

Из фактического поведения компонент отображает:

```text
SESSION_STARTED
PARTICIPANT_JOINED
FILE_UPLOADED
```

Для `FILE_UPLOADED` используется:

```text
action.metadata?.fileName
```

Поэтому пользователь может видеть название загруженного файла в истории.

---

# 25. Полный frontend data flow

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
Axios api
      |
      v
GET /sessions/:sessionId/actions
      |
      v
Fastify route
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
JSON response
      |
      v
React Query cache
      |
      v
SessionActions
      |
      v
render
```

Это главный data flow Session History.

---

# 26. Почему здесь React Query

History — это обычные серверные данные.

Они:

```text
получаются через HTTP
хранятся на backend
читаются из MongoDB
могут кешироваться
```

Поэтому React Query подходит естественно.

Он управляет:

```text
request
cache
loading
error
data
```

В отличие от realtime subtitle state, history не нужно получать через постоянный Socket.IO stream.

---

# 27. Почему history не используется через Socket.IO

History не является realtime stream.

Для получения history достаточно:

```text
GET /sessions/:sessionId/actions
```

Backend читает MongoDB и возвращает snapshot.

В результате:

```text
History
   |
   v
REST + React Query
```

а realtime события комнаты:

```text
Room events
   |
   v
Socket.IO
```

Это разделение ответственности.

---

# 28. Session details vs Session actions

В frontend есть отдельный API для Session:

```text
GET /sessions/details/:id
```

и отдельный API для actions:

```text
GET /sessions/:sessionId/actions
```

То есть:

```text
Session details
       |
       v
GET /sessions/details/:id
```

и:

```text
Session history
       |
       v
GET /sessions/:sessionId/actions
```

Это позволяет не смешивать сам объект Session и timeline событий.

---

# 29. Session lifecycle в контексте History

Фактически подтверждённый lifecycle выглядит так:

```text
User opens room
       |
       v
Socket.IO connect
       |
       v
join-room
       |
       v
createSession()
       |
       v
Session created
       |
       v
SESSION_STARTED
       |
       v
SessionAction
       |
       v
MongoDB
```

Если входит другой участник:

```text
joinParticipant()
       |
       v
PARTICIPANT_JOINED
       |
       v
SessionAction
```

Если загружается файл:

```text
POST /chat/:roomId/files
       |
       v
RoomMessage.create()
       |
       v
find active Session
       |
       v
FILE_UPLOADED
       |
       v
SessionAction
```

После этого history читается отдельным REST flow.

---

# 30. Важное расхождение: disconnect и history

В проекте есть lifecycle:

```text
disconnect
   ↓
leaveParticipant()
   ↓
finishSession()
```

Однако в материалах анализа прямо отмечено:

```text
SESSION_ENDED
```

есть в enum, но код его создания отсутствует.

Аналогично:

```text
PARTICIPANT_LEFT
```

объявлен, но не создаётся.

Поэтому нельзя считать Session History полной audit log системой.

Она хранит только часть событий.

---

# 31. История сообщений отдельно от SessionAction

Chat messages не должны автоматически считаться SessionActions.

Фактическая архитектура:

```text
RoomMessage
   |
   +-- chat message
   +-- file message
```

а:

```text
SessionAction
   |
   +-- SESSION_STARTED
   +-- PARTICIPANT_JOINED
   +-- FILE_UPLOADED
```

Для файла существуют обе записи:

```text
RoomMessage
     +
SessionAction(FILE_UPLOADED)
```

Для обычного chat message:

```text
RoomMessage
```

но:

```text
SessionAction(MESSAGE_SENT)
```

не создаётся.

---

# 32. Пример реальной записи

При создании Session в runtime был получен action примерно такого вида:

```text
{
  id: ObjectId(...),
  sessionId: ObjectId(...),
  type: "SESSION_STARTED",
  metadata: {
    ownerName: "..."
  }
}
```

То есть MongoDB действительно возвращает action с:

```text
sessionId
type
metadata
```

а frontend затем получает его через REST endpoint.

---

# 33. Почему это не просто массив логов

`SessionAction` имеет структуру:

```text
sessionId
type
userId
metadata
timestamps
```

Это делает каждое действие структурированным объектом.

Например:

```text
FILE_UPLOADED
```

может иметь:

```text
fileName
fileSize
mimeType
messageId
```

А:

```text
PARTICIPANT_JOINED
```

имеет:

```text
userName
```

То есть `metadata` позволяет каждому типу события иметь собственные дополнительные данные, сохраняя общий action schema.

---

# 34. Что происходит при запросе history

Допустим:

```text
sessionId = abc
```

Frontend:

```text
useSessionActions("abc")
```

React Query вызывает:

```text
getSessionActions("abc")
```

Axios:

```text
GET /sessions/abc/actions
```

Backend:

```text
getSessionActions("abc")
```

MongoDB:

```js
SessionAction.find({
  sessionId: "abc",
}).sort({
  createdAt: 1,
});
```

Получаем:

```text
[
  SESSION_STARTED,
  PARTICIPANT_JOINED,
  FILE_UPLOADED
]
```

Backend сериализует результат в JSON.

React Query помещает результат в cache.

`SessionActions` получает данные и рендерит timeline.

---

# 35. Почему сортировка выполняется backend

MongoDB сразу возвращает данные:

```text
createdAt ascending
```

поэтому frontend не обязан самостоятельно сортировать:

```ts
actions.sort(...)
```

Backend формирует уже упорядоченную history.

Это уменьшает ответственность UI.

---

# 36. Где происходит бизнес-логика

Основные места:

```text
session.service.js
```

Session lifecycle.

```text
session-action.service.js
```

создание и получение SessionAction.

```text
RoomMessage.route.js
```

file upload и связанный `FILE_UPLOADED`.

```text
websocket.js
```

room/realtime lifecycle и вызов session services.

Таким образом:

```text
UI
  |
  v
API / Socket
  |
  v
Business services
  |
  v
MongoDB
```

---

# 37. REST и WebSocket в Session History

Они выполняют разные задачи.

### WebSocket

Используется для:

```text
join-room
user-connected
user-disconnected
WebRTC signaling
chat realtime
audio-chunk
subtitle
```

### REST

Используется для:

```text
GET session
GET session actions
file upload
```

В частности:

```text
GET /sessions/:sessionId/actions
```

получает уже сохранённую историю.

---

# 38. Почему это хороший architectural split

Если пользователь только что открыл Session History page, нет необходимости воспроизводить все события с момента создания комнаты через WebSocket.

Можно сразу сделать:

```text
GET /sessions/:sessionId/actions
```

и получить snapshot.

Поэтому:

```text
REST = persisted state/history
Socket.IO = realtime events
```

Это один из главных architectural principles данного участка проекта.

---

# 39. Потенциальная проблема duplicate sessions

В проекте отмечена проблема:

```text
createSession()
```

не блокирует параллельный доступ.

В сочетании с React Strict Mode development remount может возникнуть:

```text
mount
  ↓
join-room
  ↓
createSession()

cleanup
  ↓
disconnect
  ↓
finishSession()

mount
  ↓
join-room
  ↓
createSession()
```

В результате могут появиться две Session.

Именно поэтому frontend использует delayed socket disconnect в development lifecycle.

Это не проблема `SessionAction` как модели. Это проблема lifecycle и idempotency создания Session.

---

# 40. Что значит "Session History не является полной audit log"

Это важное инженерное уточнение.

Сейчас history покрывает:

```text
session started
participant joined
file uploaded
```

Но не покрывает:

```text
session ended
participant left
message sent
screen shared
```

хотя эти types существуют в schema.

Поэтому правильнее называть это:

```text
Session Action History
```

а не полноценным:

```text
Audit Log
```

если только архитектура не будет расширена.

---

# 41. Что нужно понимать про `metadata`

`metadata` является generic object.

Это позволяет хранить разные payloads:

```text
SESSION_STARTED
    metadata.ownerName

PARTICIPANT_JOINED
    metadata.userName

FILE_UPLOADED
    metadata.fileName
    metadata.fileSize
    metadata.mimeType
    metadata.messageId
```

Но это также означает, что TypeScript/Mongoose schema не задаёт для каждого action отдельный строгий metadata shape в описанной реализации.

Следовательно, frontend должен аккуратно обращаться к metadata.

Например:

```text
action.metadata?.fileName
```

для `FILE_UPLOADED`.

---

# 42. Почему `FILE_UPLOADED` является и chat event, и session history event

Загрузка файла является операцией chat subsystem:

```text
RoomMessage
```

Но одновременно это значимое событие Session:

```text
FILE_UPLOADED
```

Поэтому создаются две связанные сущности:

```text
POST /chat/:roomId/files
          |
          +--> RoomMessage
          |
          +--> SessionAction
                 |
                 +--> FILE_UPLOADED
```

Это позволяет:

- chat subsystem хранить сам файл/message;
- session history показывать факт загрузки.

---

# 43. Что происходит с frontend cache

React Query использует:

```text
queryKey:
["session-actions", sessionId]
```

После успешного запроса данные становятся cached server state.

Компонент:

```text
SessionActions
```

получает cached query result через hook.

Поэтому компонент не занимается напрямую:

```text
fetch
axios
loading flags
cache
```

Это делает React Query.

---

# 44. Минимальная схема всего Session History

```text
                 Socket.IO
                     |
                  join-room
                     |
                     v
              session.service
                     |
              +------+------+
              |             |
              v             v
          Session     SessionAction
                            |
                            v
                         MongoDB


             File Upload
                  |
                  v
        RoomMessage.route.js
                  |
          +-------+-------+
          |               |
          v               v
     RoomMessage     SessionAction
                         |
                         v
                      MongoDB


       Session History Page
                |
                v
     useSessionActions(id)
                |
                v
          React Query
                |
                v
      getSessionActions(id)
                |
                v
             Axios
                |
                v
GET /sessions/:id/actions
                |
                v
       session-action.service
                |
                v
        SessionAction.find()
                |
                v
             MongoDB
```

---

# 45. Cheat sheet

### Session

Хранит саму сессию.

### SessionAction

Хранит событие внутри Session.

### `createSession()`

Создаёт Session при `join-room`, если активной Session ещё нет.

### `createSessionAction()`

Создаёт документ history.

### `joinParticipant()`

Добавляет участника и создаёт `PARTICIPANT_JOINED`.

### `RoomMessage.route.js`

Обрабатывает file upload и создаёт `FILE_UPLOADED`.

### `getSessionActions()`

Читает actions из MongoDB:

```js
SessionAction.find({ sessionId }).sort({ createdAt: 1 });
```

### `get-session-actions.ts`

Frontend API function.

### `use-session-actions.ts`

React Query hook.

### `SessionActions`

UI timeline.

### Endpoint

```text
GET /sessions/:sessionId/actions
```

---

# 46. Вопросы, которые могут задать на защите

### Почему SessionAction отдельная модель?

Потому что история событий является отдельным набором данных, который можно независимо запрашивать и сортировать, не раздувая Session.

### Где создаётся SESSION_STARTED?

В `session.service.js`, внутри `createSession()`.

### Где создаётся PARTICIPANT_JOINED?

В `session.service.js`, внутри `joinParticipant()`.

### Где создаётся FILE_UPLOADED?

В `RoomMessage.route.js` после создания `RoomMessage` и поиска активной Session.

### Как history попадает на frontend?

```text
SessionActions
→ useSessionActions
→ getSessionActions
→ Axios
→ GET /sessions/:sessionId/actions
→ MongoDB
→ React Query
→ UI
```

### Почему используется React Query?

Потому что Session History является persisted server state, получаемым через REST.

### Почему не Socket.IO?

Потому что history не является realtime stream. Для получения сохранённой истории достаточно REST query.

### Какие actions реально работают?

```text
SESSION_STARTED
PARTICIPANT_JOINED
FILE_UPLOADED
```

### Какие только объявлены?

```text
SESSION_ENDED
PARTICIPANT_LEFT
MESSAGE_SENT
SCREEN_SHARED
```

### Создаётся ли SESSION_ENDED при disconnect?

По фактическому коду нет записи `SESSION_ENDED` в SessionAction.

### Создаётся ли MESSAGE_SENT для каждого сообщения?

Нет. Сообщения сохраняются в `RoomMessage`.

### Что содержит metadata FILE_UPLOADED?

```text
fileName
fileSize
mimeType
messageId
```

### Как сортируются actions?

```text
createdAt ascending
```

---

# 47. Итог

Session History в Roomixпостроена вокруг простой модели:

```text
Session
   |
   +---- SessionAction[]
```

Но физически actions находятся в отдельной MongoDB collection и связаны через:

```text
sessionId
```

Runtime события создают actions:

```text
createSession()
      ↓
SESSION_STARTED

joinParticipant()
      ↓
PARTICIPANT_JOINED

file upload
      ↓
FILE_UPLOADED
```

Frontend читает их не через WebSocket, а через:

```text
GET /sessions/:sessionId/actions
```

и обрабатывает через:

```text
Axios
   ↓
React Query
   ↓
SessionActions
```

Главное, что нужно запомнить:

```text
Session = сама сессия

SessionAction = событие внутри сессии

RoomMessage = сообщение/файл чата

REST = получение сохранённой history

Socket.IO = realtime lifecycle/events
```

И ещё одна неприятная, но полезная правда: наличие action в enum не означает, что он существует в runtime. В текущем коде `SESSION_ENDED`, `PARTICIPANT_LEFT`, `MESSAGE_SENT` и `SCREEN_SHARED` объявлены, но не создаются. Это нужно знать, иначе на защите можно очень уверенно рассказать комисии сказку о функции, которой код никогда не вызывал.
