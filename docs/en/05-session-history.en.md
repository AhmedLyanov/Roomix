# Roomix— Session History / Action History

## 1. Purpose

Session History is a separate layer for recording what happened during a room session.

Its purpose is not to store the entire `Session` document as a historical log. Instead, it records individual events that occurred during the session:

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

`SessionAction` is stored in a separate MongoDB collection. This prevents the `Session` document from growing with historical events and allows the timeline to be queried independently.

In the current implementation, the application actually creates only:

```text
SESSION_STARTED
PARTICIPANT_JOINED
FILE_UPLOADED
```

Other action types exist in the enum/schema, but their creation code is absent.

---

## 2. Architecture

The main creation flow is:

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

Reading history follows a separate REST flow:

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

## 3. `Session` and `SessionAction` are different entities

They should not be confused.

`Session` represents the session itself.

`SessionAction` represents an event that happened inside that session.

Conceptually:

```text
Session
  "session 123 existed from time X"

SessionAction
  "the session was created at time X"
  "a user joined at time Y"
  "a file was uploaded at time Z"
```

Relationship:

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

Every `SessionAction` contains a `sessionId` that points to the corresponding Session.

---

## 4. `SessionAction.model.js`

The actual model contains:

```text
sessionId
type
userId
metadata
createdAt
updatedAt
```

### `sessionId`

Type:

```text
ObjectId
```

Reference:

```text
Session
```

It identifies which Session the action belongs to.

### `type`

The action enum contains:

```text
SESSION_STARTED
SESSION_ENDED
PARTICIPANT_JOINED
PARTICIPANT_LEFT
FILE_UPLOADED
MESSAGE_SENT
SCREEN_SHARED
```

However, an enum value existing in the schema does not mean the application actually generates that action.

### `userId`

The identifier of the user associated with the action.

### `metadata`

An object containing additional information.

For `FILE_UPLOADED`, the metadata contains:

```text
fileName
fileSize
mimeType
messageId
```

### Timestamps

Mongoose automatically stores:

```text
createdAt
updatedAt
```

These timestamps allow actions to be sorted chronologically.

---

## 5. Why `SessionAction` is a separate collection

The project keeps `SessionAction` separate from `Session`.

Conceptually:

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

instead of:

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

This is convenient for history queries such as:

```js
SessionAction.find({
  sessionId,
});
```

and allows the timeline to be retrieved independently.

The project materials explicitly describe this separation as a way to avoid bloating `Session` and to make history retrieval independent.

---

## 6. `createSessionAction()`

The central function responsible for writing history is in:

```text
session-action.service.js
```

The function is:

```text
createSessionAction()
```

Its responsibility is to create a `SessionAction` document.

Conceptually:

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

This gives the business logic for individual events a single service responsible for persisting history actions.

---

## 7. `SESSION_STARTED`

The first action that is actually created is:

```text
SESSION_STARTED
```

It is created in:

```text
session.service.js
```

inside:

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

Its metadata contains:

```js
{
  ownerName;
}
```

Therefore, the history records the owner/creator name associated with the session start.

---

## 8. Where `Session` is created

`Session` is not created directly by the frontend.

The frontend sends:

```text
join-room
```

through Socket.IO.

The backend calls:

```text
createSession()
```

Inside that function, the application checks for an existing active Session:

```text
Session.findOne({
   roomId,
   endedAt: { $exists: false }
})
```

If no active Session exists, a new one is created:

```text
Session.create(...)
```

After that:

```text
SESSION_STARTED
```

is recorded.

Therefore:

```text
Frontend
   |
   | join-room
   v
Backend
   |
   v
createSession()
   |
   +--> Session
   |
   +--> SessionAction
```

The frontend does not directly write the Session to MongoDB.

---

## 9. `PARTICIPANT_JOINED`

When another user joins an already active Session, the application uses:

```text
joinParticipant()
```

This function is also located in:

```text
session.service.js
```

The action created is:

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
active Session found
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

## 10. `FILE_UPLOADED`

This is the third action that is actually created.

It occurs when a file is uploaded to the room chat.

Endpoint:

```text
POST /chat/:roomId/files
```

The implementation is located in:

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

## 11. Why `RoomMessage` is created first

The file belongs to the chat/file subsystem.

Therefore the application first creates:

```text
RoomMessage
```

and only then connects the operation to Session History:

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

This allows history to identify the exact uploaded file/message associated with the action.

---

## 12. Actions that are only declared

The enum/schema contains:

```text
SESSION_ENDED
PARTICIPANT_LEFT
MESSAGE_SENT
SCREEN_SHARED
```

but these are not actually created by the current implementation.

This distinction is important.

It would be incorrect to say:

> "When disconnect happens, the project creates SESSION_ENDED."

The actual `SESSION_ENDED` SessionAction creation code is absent.

Likewise, it would be incorrect to say:

> "When a participant leaves, PARTICIPANT_LEFT is created."

The code that creates that action is also absent.

And:

> "Every message creates MESSAGE_SENT."

Messages are stored through `RoomMessage`, but `MESSAGE_SENT` is not created as a SessionAction.

`SCREEN_SHARED` is also declared but has no action-creation code.

---

## 13. Table of actual actions

| Action               | In enum | Actually created | Where                                    | Metadata                                        |
| -------------------- | ------: | ---------------: | ---------------------------------------- | ----------------------------------------------- |
| `SESSION_STARTED`    |     Yes |              Yes | `session.service.js → createSession()`   | `{ ownerName }`                                 |
| `SESSION_ENDED`      |     Yes |               No | None                                     | No actual record                                |
| `PARTICIPANT_JOINED` |     Yes |              Yes | `session.service.js → joinParticipant()` | `{ userName }`                                  |
| `PARTICIPANT_LEFT`   |     Yes |               No | None                                     | No actual record                                |
| `FILE_UPLOADED`      |     Yes |              Yes | `RoomMessage.route.js`                   | `fileName`, `fileSize`, `mimeType`, `messageId` |
| `MESSAGE_SENT`       |     Yes |               No | None                                     | Message is stored in `RoomMessage`              |
| `SCREEN_SHARED`      |     Yes |               No | None                                     | No actual record                                |

This is an important point when presenting the project: schema definitions and runtime behavior are not completely identical.

---

## 14. Retrieving history

The history endpoint is:

```text
GET /sessions/:sessionId/actions
```

It is located in the sessions routes:

```text
index.js
```

The route calls:

```text
getSessionActions(sessionId)
```

from:

```text
session-action.service.js
```

---

## 15. `getSessionActions()`

The service performs:

```js
SessionAction.find({
  sessionId,
}).sort({
  createdAt: 1,
});
```

The important part is:

```text
createdAt: 1
```

which means ascending order.

Therefore the frontend receives actions chronologically:

```text
SESSION_STARTED
       ↓
PARTICIPANT_JOINED
       ↓
FILE_UPLOADED
       ↓
...
```

This is the natural order for a timeline.

---

## 16. REST endpoint

The full endpoint is:

```text
GET /sessions/:sessionId/actions
```

For example:

```text
GET /sessions/6a78750c96a62efdb4f4860a/actions
```

Backend flow:

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

## 17. Frontend API client

The frontend uses a shared Axios client:

```text
web/src/shared/api/client.ts
```

It creates an API client conceptually like:

```ts
axios.create({
  baseURL: "http://localhost:5000",
});
```

The request interceptor also obtains the access token:

```ts
const token = await getAccessTokenValue();

if (token) {
  config.headers.Authorization = `Bearer ${token}`;
}
```

Therefore the REST history request goes through the shared API client and receives the authorization header when a token is available.

---

## 18. `get-session-actions.ts`

The frontend API function is:

```text
get-session-actions.ts
```

The function:

```ts
getSessionActions(sessionId);
```

performs:

```ts
const { data } = await api.get<SessionAction[]>(
  `/sessions/${sessionId}/actions`,
);
```

and returns:

```text
SessionAction[]
```

The complete path is:

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

## 19. Why the API function is separated from the React hook

Two responsibilities are separated.

`get-session-actions.ts` knows:

```text
how to request the data
```

`use-session-actions.ts` knows:

```text
how to integrate the request with React Query
```

Therefore:

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

The UI does not need to manage HTTP request details directly.

---

## 20. `useSessionActions()`

The hook is located in:

```text
use-session-actions.ts
```

and uses:

```text
@tanstack/react-query
```

Its structure is:

```ts
return useQuery({
  queryKey: ["session-actions", sessionId],
  queryFn: () => getSessionActions(sessionId),
  enabled: Boolean(sessionId),
});
```

There are three important parts.

---

## 21. `queryKey`

The query key is:

```ts
["session-actions", sessionId];
```

For example:

```text
["session-actions", "abc123"]
```

This identifies the cache entry for a specific Session.

For another Session:

```text
["session-actions", "xyz789"]
```

there is a different cache entry.

Therefore history from different Sessions is not mixed in the React Query cache.

---

## 22. `queryFn`

The query function is:

```ts
() => getSessionActions(sessionId);
```

React Query calls the API function.

Flow:

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

## 23. `enabled`

The hook uses:

```ts
enabled: Boolean(sessionId);
```

If:

```text
sessionId = ""
```

the query does not execute.

If:

```text
sessionId = "abc"
```

React Query can execute the query.

This prevents the component from making a history request without a valid Session ID.

---

## 24. `SessionActions` component

The component is:

```text
session-actions.tsx
```

It uses:

```text
useSessionActions(sessionId)
```

and receives:

```text
actions
loading state
error state
```

It then renders the timeline.

Based on the actual behavior, the component displays:

```text
SESSION_STARTED
PARTICIPANT_JOINED
FILE_UPLOADED
```

For `FILE_UPLOADED`, it uses:

```text
action.metadata?.fileName
```

Therefore the UI can show the name of the uploaded file in the history.

---

## 25. Complete frontend data flow

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

This is the main Session History data flow.

---

## 26. Why React Query is used here

History is ordinary server state.

It is:

```text
retrieved through HTTP
stored on the backend
read from MongoDB
cacheable
```

Therefore React Query fits naturally.

It manages:

```text
request
cache
loading
error
data
```

Unlike realtime subtitle state, history does not need to be delivered through a permanent Socket.IO stream.

---

## 27. Why history is not retrieved through Socket.IO

History is not a realtime stream.

To obtain it, the frontend only needs:

```text
GET /sessions/:sessionId/actions
```

The backend reads MongoDB and returns a snapshot.

Therefore:

```text
History
   |
   v
REST + React Query
```

while realtime room events use:

```text
Room events
   |
   v
Socket.IO
```

This is a separation of responsibilities.

---

## 28. Session details vs Session actions

The frontend has a separate API for Session details:

```text
GET /sessions/details/:id
```

and a separate API for actions:

```text
GET /sessions/:sessionId/actions
```

Therefore:

```text
Session details
       |
       v
GET /sessions/details/:id
```

and:

```text
Session history
       |
       v
GET /sessions/:sessionId/actions
```

This keeps the Session object and its event timeline separate.

---

## 29. Session lifecycle in the context of History

The factually confirmed lifecycle is:

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

If another participant joins:

```text
joinParticipant()
       |
       v
PARTICIPANT_JOINED
       |
       v
SessionAction
```

If a file is uploaded:

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

After that, history is read through the separate REST flow.

---

## 30. Important discrepancy: disconnect and history

The project has a lifecycle:

```text
disconnect
   ↓
leaveParticipant()
   ↓
finishSession()
```

However, the analysis explicitly notes:

```text
SESSION_ENDED
```

exists in the enum, but the code that creates it is absent.

Likewise:

```text
PARTICIPANT_LEFT
```

is declared but is not created.

Therefore Session History should not be considered a complete audit-log system.

It stores only a subset of the events that occur during a session.

---

## 31. Chat messages are separate from SessionAction

Chat messages should not automatically be considered SessionActions.

The actual architecture is:

```text
RoomMessage
   |
   +-- chat message
   +-- file message
```

while:

```text
SessionAction
   |
   +-- SESSION_STARTED
   +-- PARTICIPANT_JOINED
   +-- FILE_UPLOADED
```

For a file, both records exist:

```text
RoomMessage
     +
SessionAction(FILE_UPLOADED)
```

For an ordinary chat message:

```text
RoomMessage
```

exists, but:

```text
SessionAction(MESSAGE_SENT)
```

is not created.

---

## 32. Example of an actual record

When a Session is created, the runtime can produce an action approximately like:

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

MongoDB therefore returns an action containing:

```text
sessionId
type
metadata
```

and the frontend receives it through the REST endpoint.

---

## 33. Why this is not simply an array of logs

`SessionAction` has a structured schema:

```text
sessionId
type
userId
metadata
timestamps
```

This makes every action a structured object.

For example:

```text
FILE_UPLOADED
```

can contain:

```text
fileName
fileSize
mimeType
messageId
```

while:

```text
PARTICIPANT_JOINED
```

contains:

```text
userName
```

The `metadata` field therefore allows each action type to carry its own additional information while sharing the same general action structure.

---

## 34. What happens when history is requested

Suppose:

```text
sessionId = abc
```

Frontend:

```text
useSessionActions("abc")
```

React Query calls:

```text
getSessionActions("abc")
```

Axios sends:

```text
GET /sessions/abc/actions
```

Backend calls:

```text
getSessionActions("abc")
```

MongoDB executes:

```js
SessionAction.find({
  sessionId: "abc",
}).sort({
  createdAt: 1,
});
```

The result may be:

```text
[
  SESSION_STARTED,
  PARTICIPANT_JOINED,
  FILE_UPLOADED
]
```

The backend serializes the result as JSON.

React Query places it into its cache.

`SessionActions` receives the data and renders the timeline.

---

## 35. Why sorting is performed on the backend

MongoDB returns the actions already sorted by:

```text
createdAt ascending
```

Therefore the frontend does not need to perform:

```ts
actions.sort(...)
```

The backend provides an already ordered history.

This keeps sorting responsibility out of the UI layer.

---

## 36. Where business logic lives

The main locations are:

```text
session.service.js
```

Session lifecycle.

```text
session-action.service.js
```

Creation and retrieval of SessionAction documents.

```text
RoomMessage.route.js
```

File upload and the related `FILE_UPLOADED` action.

```text
websocket.js
```

Room/realtime lifecycle and calls into the Session services.

Conceptually:

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

## 37. REST and WebSocket in Session History

They serve different purposes.

### WebSocket

Used for:

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

Used for:

```text
GET session
GET session actions
file upload
```

In particular:

```text
GET /sessions/:sessionId/actions
```

retrieves the already persisted history.

---

## 38. Why this is a good architectural split

If a user opens the Session History page, there is no need to replay every realtime event that happened since the room was created through WebSocket.

The frontend can simply request:

```text
GET /sessions/:sessionId/actions
```

and receive a snapshot.

Therefore:

```text
REST = persisted state/history
Socket.IO = realtime events
```

This is one of the main architectural principles of this part of the project.

---

## 39. Potential duplicate Session problem

The project identifies a potential issue where:

```text
createSession()
```

does not protect against concurrent access.

Combined with a React Strict Mode development remount, the lifecycle can look like:

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

This can result in two Session documents.

The frontend therefore uses delayed socket disconnect behavior in the development lifecycle.

This is not a `SessionAction` model problem.

It is a Session lifecycle and creation-idempotency problem.

---

## 40. Why Session History is not a complete audit log

This is an important engineering distinction.

Current history covers:

```text
session started
participant joined
file uploaded
```

It does not cover:

```text
session ended
participant left
message sent
screen shared
```

even though those action types exist in the schema.

Therefore the accurate description is:

```text
Session Action History
```

rather than a complete:

```text
Audit Log
```

unless the architecture is later extended.

---

## 41. Understanding `metadata`

`metadata` is a generic object.

It allows different payloads:

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

However, this also means that the described implementation does not define a separate strict metadata shape for every action type in the TypeScript/Mongoose model.

Therefore the frontend should access metadata defensively.

For example:

```text
action.metadata?.fileName
```

for `FILE_UPLOADED`.

---

## 42. Why `FILE_UPLOADED` is both a chat event and a Session History event

Uploading a file is a chat subsystem operation:

```text
RoomMessage
```

but it is also a meaningful Session event:

```text
FILE_UPLOADED
```

Therefore two related entities are created:

```text
POST /chat/:roomId/files
          |
          +--> RoomMessage
          |
          +--> SessionAction
                 |
                 +--> FILE_UPLOADED
```

This allows:

- the chat subsystem to store the actual message/file;
- Session History to record the fact that a file was uploaded.

---

## 43. What happens to the frontend cache

React Query uses:

```text
queryKey:
["session-actions", sessionId]
```

After a successful request, the result becomes cached server state.

The component:

```text
SessionActions
```

gets the cached query result through the hook.

Therefore the component itself does not directly manage:

```text
fetch
axios
loading flags
cache
```

React Query handles those concerns.

---

## 44. Minimal architecture of Session History

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

## 45. Cheat sheet

### Session

Stores the Session itself.

### SessionAction

Stores an event that occurred inside a Session.

### `createSession()`

Creates a Session on `join-room` when there is no active Session.

### `createSessionAction()`

Creates a history document.

### `joinParticipant()`

Adds a participant and creates `PARTICIPANT_JOINED`.

### `RoomMessage.route.js`

Handles file upload and creates `FILE_UPLOADED`.

### `getSessionActions()`

Reads actions from MongoDB:

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

## 46. Questions that may be asked during a defense

### Why is `SessionAction` a separate model?

Because the history events form a separate dataset that can be independently queried and sorted without making the Session document grow with historical data.

### Where is `SESSION_STARTED` created?

In `session.service.js`, inside `createSession()`.

### Where is `PARTICIPANT_JOINED` created?

In `session.service.js`, inside `joinParticipant()`.

### Where is `FILE_UPLOADED` created?

In `RoomMessage.route.js`, after the `RoomMessage` is created and the active Session is found.

### How does history reach the frontend?

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

### Why is React Query used?

Because Session History is persisted server state retrieved through REST.

### Why not Socket.IO?

Because history is not a realtime stream. A REST query is sufficient to retrieve the persisted history snapshot.

### Which actions actually work?

```text
SESSION_STARTED
PARTICIPANT_JOINED
FILE_UPLOADED
```

### Which actions are only declared?

```text
SESSION_ENDED
PARTICIPANT_LEFT
MESSAGE_SENT
SCREEN_SHARED
```

### Is `SESSION_ENDED` created on disconnect?

According to the actual code, there is no `SESSION_ENDED` SessionAction record created.

### Is `MESSAGE_SENT` created for every message?

No. Messages are stored in `RoomMessage`.

### What does `FILE_UPLOADED` metadata contain?

```text
fileName
fileSize
mimeType
messageId
```

### How are actions sorted?

```text
createdAt ascending
```

---

## 47. Summary

Session History in Roomixis built around a simple conceptual model:

```text
Session
   |
   +---- SessionAction[]
```

Physically, however, the actions live in a separate MongoDB collection and are connected through:

```text
sessionId
```

Runtime events create actions:

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

The frontend does not read them through WebSocket. It uses:

```text
GET /sessions/:sessionId/actions
```

followed by:

```text
Axios
   ↓
React Query
   ↓
SessionActions
```

The key concepts to remember are:

```text
Session = the session itself

SessionAction = an event inside the session

RoomMessage = a chat message/file

REST = retrieving persisted history

Socket.IO = realtime lifecycle/events
```

And one unpleasant but useful engineering truth: an action existing in an enum does not mean it exists at runtime. In the current code, `SESSION_ENDED`, `PARTICIPANT_LEFT`, `MESSAGE_SENT`, and `SCREEN_SHARED` are declared, but they are not created. Knowing this matters during a technical defense, otherwise it is very easy to confidently describe functionality that the code never actually executes.
