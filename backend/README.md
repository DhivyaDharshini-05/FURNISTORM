# FURNISTORM Backend

FURNISTORM is a furniture e-commerce platform. This repository contains the backend API built with Node.js and Express.

## Technology Stack

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: PostgreSQL 16
- **Cache / Broker**: Redis 7, RabbitMQ 3
- **Containerization**: Docker + Docker Compose

## Folder Structure

```
backend/
├── src/
│   ├── config/          # database, redis, rabbitmq connections
│   ├── middleware/      # error handling
│   ├── utils/           # logger
│   ├── app.js           # Express app
│   └── server.js        # entry point
├── tests/integration/
├── database/
│   ├── migrations/
│   └── seed/
├── .env.example
├── Dockerfile
└── docker-compose.yml
```

## Prerequisites

- Node.js 20+
- Docker & Docker Compose

## Environment Setup

```bash
cp .env.example .env
# Edit .env if needed
```

## Docker Commands

```bash
# Start all services
docker compose up --build

# Start in background
docker compose up -d --build

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

## Local Development

```bash
npm install
npm run dev
```

> Requires PostgreSQL, Redis, and RabbitMQ running locally or via Docker.

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start with nodemon (hot reload) |
| `npm test` | Run tests |

## Health Check Endpoint

```
GET /api/health
```

Response:
```json
{
  "success": true,
  "message": "FURNISTORM backend is running",
  "services": {
    "postgres": "up",
    "redis": "up",
    "rabbitmq": "up"
  }
}
```

## RabbitMQ Management UI

Available at http://localhost:15672 (user: `furnistorm_user`, pass: `furnistorm_pass`)
