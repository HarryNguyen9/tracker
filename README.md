# Game Result Tracker

A mobile-first Next.js app for tracking game results by player. It stores players and records in Supabase Postgres, uses server-side API routes for all data changes, and keeps edit access behind a simple admin PIN cookie.

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
- Supabase Postgres
- Server-side API routes

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PIN=choose-a-private-pin
```

The service role key is only used in server-side API routes. Do not expose it in browser code.

## Database setup

Run the SQL in `supabase/migrations/001_create_game_tracker_tables.sql` in the Supabase SQL editor or through your preferred Supabase migration workflow.

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
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
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
