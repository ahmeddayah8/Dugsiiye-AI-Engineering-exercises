# AI Tools Chatbot — Exercise #5

Next.js 16 + TypeScript + Tailwind 4 + OpenRouter AI SDK + MongoDB/Mongoose + OMDb + icanhazdadjoke.

## Setup

Requires Node.js 20.9+ (Node 22+ recommended), MongoDB local or Atlas, OpenRouter key, OMDb key.

```bash
npm install
cp .env.example .env.local
# edit .env.local; for seed script also copy the same values to .env
npm run seed
npm run dev
```

On PowerShell: `Copy-Item .env.example .env` then edit `.env`; Next.js reads `.env` automatically. Open http://localhost:3000.

## Features

- Safe, allowlisted database operations for movies, users and reviews. Maximum 10 rows/page.
- OMDb title/year lookup and 24-hour MongoDB cache; recommendations and partial-title search from local movies.
- Random dad jokes, keyword search, programming keyword search, stored fallback jokes, ratings.
- Conversation history and tool usage saved under a random per-tab session ID. Clear removes that conversation.
- Responsive UI with structured tables, poster cards and joke voting.
- Zod validation and retry/backoff for external APIs.

## Examples

`Show me all sci-fi movies`; `Find users over 25`; `Get movies with rating above 8.5`; `Count total movies by genre`; `Tell me about Interstellar (2014)`; `Recommend sci-fi movies`; `Tell me a programming joke`.

## Tests

```bash
npm test
npm run build
```

Unit tests cover input validation and regex escaping. Integration testing requires MongoDB and API keys; manual end-to-end checks are still required.

## Troubleshooting

- `MONGODB_URI is missing`: check `.env`.
- MongoDB connection refused: start MongoDB or set Atlas connection string and network access.
- OMDb missing key: request a free key from omdbapi.com.
- AI model errors: choose a tool-capable OpenRouter model, check credits/key.
- `next start` says no build: use `npm run dev` or run `npm run build` before `npm start`.
- Programming jokes are keyword-search results, not a guaranteed category from the external API.

## Important limits

Educational demo, not production multi-user authentication. Session IDs are client-generated and not bound to verified identities. Do not put sensitive data in sample users. Rating endpoint does not prevent repeated votes or enforce per-user limits. Movie recommendations are limited to cached/local records. AI/API usage can incur costs. External APIs may rate-limit or return errors. OMDb posters use ordinary lazy-loaded image elements. Tool calls may take several seconds.
