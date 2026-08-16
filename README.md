![Roomix](docs/cover.png)

# Roomix

> A real-time video communication platform built around WebRTC, live sessions, and real-time speech translation.

Roomix is a web-based video communication project focused on real-time communication between participants.

The project combines peer-to-peer video communication, room chat, session management, file sharing, authentication, and a separate speech-processing and translation service.

The project is currently frozen in its present state. The repository and documentation are preserved as a technical reference and as a foundation for possible future development.

## Features

* Real-time video and audio communication
* WebRTC-based peer-to-peer connections
* Room-based communication
* Real-time room chat
* Session creation and session history
* Session action tracking
* File upload and sharing
* Authentication
* Real-time speech processing
* Real-time subtitles and translation
* Multiple room layouts
* Camera and microphone controls
* Screen and media sharing
* Light and dark themes
* Responsive web interface

## Architecture

Roomix is organized as a small multi-service system:

```text
Roomix
├── web/            # Next.js frontend
├── server/         # Node.js backend
├── translation/    # Speech recognition and translation service
└── docs/           # Project documentation
```

### Web

The frontend is built with Next.js and TypeScript.

The application follows a Feature-Sliced Design-inspired structure:

```text
web/
├── app/
├── src/
│   ├── entities/
│   ├── features/
│   ├── shared/
│   └── widgets/
└── public/
```

The frontend contains the room interface, video components, session interface, chat, file handling, authentication pages, and reusable UI components.

### Server

The backend is responsible for application-level communication, persistence, authentication integration, sessions, chat, file uploads, and WebSocket communication.

```text
server/
├── config/
├── models/
├── plugins/
├── routes/
├── services/
├── uploads/
└── index.js
```

The server contains dedicated services for sessions, session actions, speech processing, and translation.

### Translation

The translation service is separated from the main backend.

```text
translation/
├── models/
├── app.py
├── main.py
├── schemas.py
├── translator.py
└── requirements.txt
```

It uses local speech-recognition models based on Faster-Whisper and provides the speech-processing layer required for real-time translation.

## Real-time communication

The communication layer is built around WebRTC.

The frontend contains dedicated room-session logic for:

* media streams
* peer connections
* socket communication
* media controls
* subtitles

The backend provides the signaling and real-time communication infrastructure required to establish and maintain room connections.

## Sessions

Roomix treats a meeting as a session rather than only a temporary video room.

Sessions can contain information about:

* participants
* session actions
* session duration
* room activity
* chat messages
* related session data

The frontend provides a session history interface and detailed session views.

## Documentation

The repository contains detailed technical documentation in English and Russian.

### English

* [Project Overview](docs/en/01-project-overview.en.md)
* [Room and WebRTC](docs/en/02-room-and-webrtc.en.md)
* [Realtime Translation](docs/en/03-realtime-translation.en.md)
* [Video Communication](docs/en/04-video-communication.en.md)
* [Session History](docs/en/05-session-history.en.md)
* [Authentication and HTTP API](docs/en/06-authentication-and-http-api.en.md)
* [WebRTC and Video Communication](docs/en/07-webrtc-and-video-communication.en.md)
* [Backend Architecture](docs/en/08-backend-architecture.en.md)
* [Development and Deployment](docs/en/09-development-and-deployment.en.md)
* [Realtime Communication Internals](docs/en/10-realtime-communication-internals.en.md)

## Project structure

```text
.
├── docs/
│   ├── en/
│   └── ru/
│
├── server/
│   ├── config/
│   ├── models/
│   ├── plugins/
│   ├── routes/
│   ├── services/
│   └── uploads/
│
├── translation/
│   ├── models/
│   ├── app.py
│   ├── main.py
│   ├── schemas.py
│   └── translator.py
│
└── web/
    ├── app/
    ├── public/
    └── src/
        ├── entities/
        ├── features/
        ├── shared/
        └── widgets/
```

## Technology

### Frontend

* Next.js
* React
* TypeScript
* WebRTC
* WebSocket
* Ant Design
* Feature-Sliced Design principles

### Backend

* Node.js
* Fastify
* WebSocket
* MongoDB
* Clerk
* REST API

### Speech and translation

* Python
* Faster-Whisper
* Local speech recognition models
* Dedicated translation service

## Development

The project consists of three independently organized parts:

```text
web          → frontend application
server       → backend and realtime infrastructure
translation  → speech recognition and translation
```

Each part contains its own dependency configuration and environment example.

For detailed installation, environment variables, development, and deployment instructions, see:

[Development and Deployment](docs/en/09-development-and-deployment.en.md)

## Status

**Frozen**

Roomix is currently not under active development.

The project is preserved in its current state together with its technical documentation. The repository can be used as a reference for studying:

* WebRTC architecture
* real-time communication
* WebSocket signaling
* speech recognition
* real-time translation
* session-oriented application design
* frontend architecture
* multi-service web applications

## License

No license has been specified for this repository yet.
