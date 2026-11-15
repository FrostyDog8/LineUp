# LineUp

Activity registration for teams and clubs — fair lists, ranks, and capacity without the WhatsApp race.

**M1 foundation scaffold** (this PR): Next.js App Router, Drizzle schema, auth/dashboard stubs, analytics hook. Full registration engine, WhatsApp group bot, and Hebrew/RTL are out of scope.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui basics |
| DB | Supabase Postgres (`gehjyxyciymdwywjyfyx`, `eu-central-1`) + Drizzle ORM |
| Auth | Better Auth scaffold + phone OTP / WhatsApp magic-link **adapters (stubbed)** |
| Hosting | Vercel (planned) |
| Analytics | Stub module; loads GA only if `NEXT_PUBLIC_GA_ID` is set |

## Setup

### 1. Clone

```bash
git clone https://github.com/FrostyDog8/LineUp.git
cd LineUp
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in (from [Supabase project dashboard](https://supabase.com/dashboard/project/gehjyxyciymdwywjyfyx)):

| Variable | Where to get it |
| --- | --- |
| `DATABASE_URL` | Project Settings → Database → connection string (URI). Prefer **Session** or **Transaction** pooler for serverless. |
| `NEXT_PUBLIC_SUPABASE_URL` | Already set to `https://gehjyxyciymdwywjyfyx.supabase.co` in `.env.example` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` (server only) |
| `BETTER_AUTH_SECRET` | Generate a long random string (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_GA_ID` | Leave empty until Google Analytics is added |

Optional later (auth delivery spike): `AUTH_DELIVERY`, Twilio Verify, WhatsApp Cloud API vars — see `.env.example`.

**Do not commit secrets.** Vercel: add the same vars in Project → Settings → Environment Variables.

### 3. Database migrate

With `DATABASE_URL` set:

```bash
npm run db:migrate
```

Or generate/push during development:

```bash
npm run db:generate
npm run db:push
```

SQL for the initial domain schema also lives in `drizzle/0000_init_lineup_domain.sql` if you prefer applying it from the Supabase SQL editor.

**RLS note:** Domain tables were created without Row Level Security. The app talks to Postgres via `DATABASE_URL` (Drizzle), not the anon key. Optional hardening SQL (enable RLS, deny PostgREST by default) is in `drizzle/manual/enable_rls.sql` — review before applying.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- `/` — LineUp landing
- `/login` — phone OTP / magic-link UI (adapters stubbed without Twilio/WhatsApp)
- `/dashboard` — personal “my activities” shell (empty data)
- `/activities/new` · `/activities/join` — create/join UI stubs

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `start` | Production build |
| `npm run lint` | ESLint |
| `npm run db:generate` | Drizzle Kit generate migrations |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema (dev) |
| `npm run db:studio` | Drizzle Studio |

## Repo layout (high level)

```
src/app/           # App Router pages + auth API stubs
src/components/    # UI (shadcn-style) + dashboard shell
src/lib/db/        # Drizzle client + domain schema
src/lib/auth/      # Better Auth + AuthDelivery adapters
src/lib/analytics/ # GA no-op unless NEXT_PUBLIC_GA_ID is set
src/server/        # Domain modules (stubs → real logic in M2+)
drizzle/           # SQL migrations
```

## Out of scope (this scaffold)

- Full multi-phase registration engine
- WhatsApp **group** status bot
- Real Twilio / WhatsApp credentials in-repo
- Hebrew / RTL UI

## License

Private — LineUp (Omer Dabby).
