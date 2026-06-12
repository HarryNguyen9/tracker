# Game Result Tracker

A mobile-first Next.js app for tracking game results by player. It stores players and records in Neon Postgres, uses server-side API routes for all data changes, and keeps edit access behind a simple admin PIN cookie.

## Features

- Add, rename, and delete players.
- Delete a player and automatically remove that player's records through database cascade rules.
- Add, edit, and delete records for each player.
- Server-calculated Return and Profit values:
  - `returnAmount = amount * rate`
  - `profit = returnAmount - amount`
- Running Balance per player sorted by creation time.
- Dashboard totals for Amount, Return, Profit, and record count.
- VND display formatting with decimal Rate input.
- Loading, empty, and error states.
- Edit protection with `ADMIN_PIN` and an httpOnly cookie.

## Tech stack

- Next.js App Router
- TypeScript
- TailwindCSS
- Neon Postgres
- Server-side API routes

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
DATABASE_URL=postgresql://...
ADMIN_PIN=choose-a-private-pin
```

`DATABASE_URL` is only used by server-side API routes. Do not expose it in browser code.

## Database setup with Neon

1. Create a Neon project.
2. Open the Neon SQL Editor.
3. Run the SQL in `migrations/001_create_game_tracker_tables.sql`.

Tables created:

- `players`
- `records`

No default players are inserted.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy to Vercel

1. Push this repository to your Git provider.
2. Import the project in Vercel.
3. Add these environment variables in Vercel Project Settings:
   - `DATABASE_URL`
   - `ADMIN_PIN`
4. Deploy.

## API routes

- `GET /api/players`
- `POST /api/players`
- `PATCH /api/players/[id]`
- `DELETE /api/players/[id]`
- `GET /api/records?playerId=...`
- `POST /api/records`
- `PATCH /api/records/[id]`
- `DELETE /api/records/[id]`
- `POST /api/auth/edit-pin`
