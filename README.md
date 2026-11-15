# LineUp

Activity registration for teams and clubs — fair lists, ranks, and capacity without the WhatsApp race.

**M2** ships activities & membership: create/join, approve/open, ranks, thin managers, owner settings, and **dev login** with real session cookies.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui basics |
| DB | Supabase Postgres (`gehjyxyciymdwywjyfyx`, `eu-central-1`) + Drizzle ORM |
| Auth | Phone identity + httpOnly session cookies; Better Auth scaffold retained; Twilio/WhatsApp adapters stubbed |
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
| `AUTH_DEV_BYPASS` | Optional. Set `true` to allow phone → session without Twilio (also on automatically when `NODE_ENV=development`) |
| `NEXT_PUBLIC_APP_URL` | Optional. Used for invite links (defaults to `http://localhost:3000`) |

Optional later (auth delivery spike): `AUTH_DELIVERY`, Twilio Verify, WhatsApp Cloud API vars — see `.env.example`.

**Do not commit secrets.** Vercel: add the same vars in Project → Settings → Environment Variables.

### 3. Database migrate

With `DATABASE_URL` set:

```bash
npm run db:migrate
```

M1 domain schema (`drizzle/0000_init_lineup_domain.sql`) is already applied on the LineUp Supabase project. M2 uses that schema (no new tables).

**RLS note:** Domain tables were created without Row Level Security. The app talks to Postgres via `DATABASE_URL` (Drizzle), not the anon key. Optional hardening SQL is in `drizzle/manual/enable_rls.sql`.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to test M2 (local)

1. Ensure `.env.local` has a working `DATABASE_URL` and `BETTER_AUTH_SECRET`.
2. Dev login is on in development (`NODE_ENV=development`). Or set `AUTH_DEV_BYPASS=true`.
3. Open `/login` → enter an E.164 phone (e.g. `+972501111111`) → **Dev sign-in**.
4. **Create** an activity (`/activities/new`) with must-approve or open join.
5. Copy the invite code from the activity page.
6. Sign out → sign in as a second phone → **Join** with the code.
7. As owner: approve (must-approve) or see immediate membership (open); open **Settings** for join mode / capacity / ranks / ownership transfer; promote a member to **manager** with approve-joins / change-ranks toggles.

Routes:

- `/` — landing
- `/login` — phone sign-in (dev bypass or OTP stub)
- `/dashboard` — activities you own or belong to
- `/activities/new` · `/activities/join` · `/activities/[id]` · `/activities/[id]/settings`

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
src/app/           # App Router pages + auth API + server actions
src/components/    # UI (shadcn-style) + dashboard / member panels
src/lib/db/        # Drizzle client + domain schema
src/lib/auth/      # Sessions, phone helpers, AuthDelivery adapters
src/lib/analytics/ # GA no-op unless NEXT_PUBLIC_GA_ID is set
src/server/        # Domain modules (activities, memberships, ranks, permissions)
drizzle/           # SQL migrations
```

## Out of scope (later milestones)

- Full multi-phase registration engine / waitlist / auto-promote
- Proxy-confirm, guests, manual list edit (M4)
- WhatsApp group status bot / real Twilio
- Hebrew / RTL
- Label polish

## License

Private — LineUp (Omer Dabby).
