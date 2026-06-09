# Chess API

A free, open-source Chess REST API built with [NestJS](https://nestjs.com/), MongoDB, and [chess.js](https://github.com/jhlywa/chess.js).

## Features

- Guest user authentication (JWT)
- Matchmaking — players are automatically paired into a game with the same duration
- Full chess rule enforcement via chess.js (move validation, turn control, checkmate/draw detection)
- REST endpoints for board state, legal moves, and move execution
- Interactive browser demo (no framework, plain HTML/CSS/JS + chessboard.js)

---

## Requirements

- Node.js 18+
- Docker & Docker Compose (for local MongoDB)

---

## Getting Started

### 1. Start MongoDB

```bash
docker compose up -d
```

### 2. Configure environment

```bash
cp .env.example .env
```

> Edit `.env` if you need to change the port or database URL.

### 3. Install dependencies

```bash
npm install
```

### 4. Run the API

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run start:prod
```

The API will be available at `http://localhost:3000`.  
Swagger docs: `http://localhost:3000/api`

---

## Demo

An interactive front-end demo is included in the `demo/` folder. It uses [chessboard.js](https://chessboardjs.com/) for board rendering and polls the API every 2 seconds.

```bash
npm run demo:start
```

Open `http://localhost:8080` in **two browser tabs** — each tab joins as a different guest player and they are automatically matched into the same game.

---

## API Overview

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/guest-users` | Create a guest user and get a JWT token |
| `POST` | `/players` | Register the authenticated user as a player |
| `POST` | `/games` | Create or join a waiting game (matchmaking) |
| `GET` | `/games` | List all games |
| `GET` | `/games/:id` | Get game details |
| `GET` | `/games/:id/board` | Get current board state (FEN + board array) |
| `GET` | `/games/:id/moves` | List legal moves for the current position |
| `POST` | `/games/:id/moves` | Make a move `{ "move": "e4" }` |

---

## Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

---

## License

[MIT](LICENSE)
