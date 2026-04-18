# PRECISO — Vercel Deployment Reference

Authoritative settings for deploying the PRECISO monorepo to Vercel. One Vercel
project per Next.js app — three projects total, all pointed at the same GitHub
repository (`WebSynq/Preciso-App`).

## Live URLs

| Surface | Production URL | Vercel project |
|---|---|---|
| Provider portal | `https://preciso-app.vercel.app` | `preciso-portal` |
| Admin console | `https://preciso-admin.vercel.app` | `preciso-admin` |
| Developer console | _(not yet deployed)_ | `preciso-dev-console` (future) |

> ⚠️ Production HIPAA deploy requires Vercel Enterprise + signed BAA + same for
> Supabase (Team plan). These instructions are for **dev / preview / fake-data**
> environments only. See `README.md` for the production-readiness checklist.

---

## One-time per Vercel project

| Setting | Provider Portal | Admin Console | Developer Console |
|---|---|---|---|
| Suggested project name | `preciso-portal` | `preciso-admin` | `preciso-dev-console` |
| **Root Directory** | `apps/portal` | `apps/admin` | `apps/dev` |
| Production Branch | `main` | `main` | `main` |
| Framework Preset | Next.js (auto-detected) | Next.js (auto-detected) | Next.js (auto-detected) |
| Build Command | _leave default_ | _leave default_ | _leave default_ |
| Install Command | _leave default_ | _leave default_ | _leave default_ |
| Output Directory | _leave default_ | _leave default_ | _leave default_ |
| Include source files outside Root Directory | **ON** (default since Aug 2020) | **ON** | **ON** |

### Why these defaults work

The repo follows Vercel's canonical monorepo pattern:

1. The root `package.json` declares `"workspaces": ["apps/*", "packages/*"]`.
   Vercel auto-detects npm workspaces and runs `npm install` at the repo root,
   linking the workspace packages (`@preciso/types`, `@preciso/schemas`,
   `@preciso/utils`) into each app's `node_modules`.
2. Each app's `next.config.js` declares `transpilePackages` for the
   `@preciso/*` packages, and those packages' `main`/`types` fields point at
   source `.ts` files. Next compiles them in-process — no pre-build step
   required.
3. Setting **Root Directory** to the app folder makes Vercel look at that
   folder's `package.json`, auto-detect Next.js from the `next` dependency,
   run `next build`, and serve the resulting `.next` directory.
4. **Include source files outside the Root Directory** must stay ON so the
   build can read source files from `packages/*` siblings.
5. There is intentionally **no** `vercel.json` at the repo root or inside any
   app. Default behaviour is correct; explicit overrides cause subtle bugs
   (we removed several iterations of overrides during initial setup).

## Environment variables — per project

Set these for **Production**, **Preview**, and **Development** scopes.

All three apps now need the same three env vars. The service role key
is used server-side for audit-log inserts (HIPAA read-tracking),
failed-login counter writes, and the order-creation API route.
**Service role bypasses RLS — never paste in chat, never commit.**

### Provider portal (`apps/portal`)

```
NEXT_PUBLIC_SUPABASE_URL          = https://kzawghnjegnyihgtjcfn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = <legacy anon JWT — Supabase dashboard → Settings → API Keys → Legacy tab>
SUPABASE_SERVICE_ROLE_KEY         = <legacy service_role JWT — same location>
UPSTASH_REDIS_URL                 = https://<your-db>.upstash.io
UPSTASH_REDIS_TOKEN               = <REST token from Upstash console>
# Admin-login cross-link rendered at the bottom of /login:
NEXT_PUBLIC_ADMIN_URL             = https://preciso-admin.vercel.app/login
```

> `NEXT_PUBLIC_*` vars are build-time only — they get baked into the client
> bundle. Any change requires a rebuild (Vercel → Deployments → Redeploy
> **without** cache).

### Admin console (`apps/admin`)

```
NEXT_PUBLIC_SUPABASE_URL          = https://kzawghnjegnyihgtjcfn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = <legacy anon JWT>
SUPABASE_SERVICE_ROLE_KEY         = <legacy service_role JWT>
UPSTASH_REDIS_URL                 = https://<your-db>.upstash.io
UPSTASH_REDIS_TOKEN               = <REST token>
```

Admin role is enforced by the JWT claim `app_metadata.role = 'admin'`,
applied via SQL on `auth.users`.

### Developer console (`apps/dev`)

```
NEXT_PUBLIC_SUPABASE_URL          = https://kzawghnjegnyihgtjcfn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = <legacy anon JWT>
SUPABASE_SERVICE_ROLE_KEY         = <legacy service_role JWT>
UPSTASH_REDIS_URL                 = https://<your-db>.upstash.io
UPSTASH_REDIS_TOKEN               = <REST token>
```

## Test accounts (Supabase Auth)

| Role | Email | Password | Reaches |
|---|---|---|---|
| `provider` | `drjane@preciso.test` | `PrecisoTest#2026!` | Portal + Admin (Jane is also admin) |
| `developer` | `devops@preciso.test` | `DevOps#2026!` | Developer console only |

Role is set via `auth.users.raw_app_meta_data.role`. Never assignable from
the UI; SQL only.

## Local development

```bash
# in three separate terminals
npm run dev:portal   # http://localhost:3000
npm run dev:admin    # http://localhost:3001
npm run dev:dev      # http://localhost:3002
```

Each app needs its own `.env.local` with the same env vars listed above.
`.env.local` is gitignored.

## Common pitfalls

- **`Root Directory "app/portal" does not exist`** — typo. The folder is
  `apps/portal` (plural). No leading space, no trailing slash.
- **`No Next.js version detected`** — Root Directory is unset or set to `.`.
  Vercel is looking for `next` in the root `package.json` instead of
  `apps/portal/package.json`. Set Root Directory to `apps/portal`.
- **Build succeeds but every URL is 404** — Vercel built the right thing but
  doesn't know it's a Next.js app to route. Caused by an explicit
  `outputDirectory` in a `vercel.json` overriding framework detection.
  Solution: delete `vercel.json` and rely on Root Directory.
- **Auth cookies not persisting / login redirect loop** — make sure
  `@supabase/ssr` is `^0.5.2` or later in each app's `package.json`. 0.3
  has a known cookie-default bug.

## Sources

- [Vercel — Using Monorepos](https://vercel.com/docs/monorepos)
- [Vercel — Monorepos FAQ](https://vercel.com/docs/monorepos/monorepo-faq)
- [Vercel — Deploying Yarn workspaces](https://vercel.com/kb/guide/deploying-yarn-monorepos-to-vercel)
- [Vercel — Understanding Monorepos (Academy)](https://vercel.com/academy/production-monorepos/understanding-monorepos)
