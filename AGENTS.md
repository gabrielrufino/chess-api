# AI Agent Instructions for Chess API

Welcome! If you are an AI coding assistant working on this repository, please adhere to the following project-specific rules:

## 1. CORS Policy
- **DO NOT restrict CORS.**
- This is a public API intended to be consumed by any frontend.
- `app.enableCors({ origin: true, credentials: true })` in `main.ts` is intentional and should NOT be flagged as a security vulnerability or changed to a whitelist.
- `@WebSocketGateway({ cors: { origin: '*' } })` is also intentional for the same reason.

## 2. API Design
- The API is stateless with anonymous guest access via JWT. Do not introduce mandatory persistent user registration.
- Any new mutation endpoints must return appropriate HTTP status codes (200 OK for updates, 201 Created for new resources).
