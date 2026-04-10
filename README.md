# PRECISO Platform

HIPAA-regulated clinical genomics ordering platform built for Renoviant Inc.

## Architecture

```
preciso-platform/
├── apps/
│   ├── portal/          # Next.js 14 — physician ordering portal
│   └── api/             # Node.js Express — HIPAA middleware + integrations
├── packages/
│   ├── types/           # Shared TypeScript types across apps
│   ├── schemas/         # Zod validation schemas (shared)
│   └── utils/           # Shared utility functions
├── supabase/
│   ├── migrations/      # All DB migrations (numbered)
│   └── seed/            # Test seed data
├── .github/
│   └── workflows/       # CI/CD — GitHub Actions
└── .env.example         # All required env vars documented
```

## Prerequisites

- Node.js >= 20
- npm >= 10
- Supabase CLI (for local DB development)
- Git

## Setup

1. **Clone and install dependencies:**

   ```bash
   git clone <repo-url>
   cd preciso-platform
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Fill in your Supabase, GHL, and AWS credentials
   ```

3. **Run Supabase migrations:**

   ```bash
   supabase db reset   # applies migrations + seed data
   ```

4. **Start development servers:**

   ```bash
   # Terminal 1 — Portal (Next.js)
   npm run dev:portal

   # Terminal 2 — API (Express)
   npm run dev:api
   ```

   - Portal: http://localhost:3000
   - API: http://localhost:4000

## Packages

| Package | Description |
|---|---|
| `@preciso/types` | TypeScript interfaces and enums matching DB schema |
| `@preciso/schemas` | Zod validation schemas for API input validation |
| `@preciso/utils` | Shared utility functions |

## Database

All schema changes go through numbered migration files in `supabase/migrations/`. Never edit the database manually.

- **00001** — Enum types
- **00002** — Core tables (providers, kit_orders, lab_results, custody_events, audit_logs)
- **00003** — Row Level Security policies

## Security

- Row Level Security enforced on all tables
- HMAC-SHA256 validation on all webhook endpoints
- AES-256 encryption for PHI at rest
- TLS 1.3 for all transit
- 15-minute session timeout
- Rate limiting on all public endpoints
- All secrets in AWS Secrets Manager (never in code)

## Testing

```bash
npm test              # Run all tests
npm run typecheck     # TypeScript type checking
npm run lint          # ESLint
npm run format:check  # Prettier
```

## Build Phases

1. **Phase 1** — Project scaffolding, DB schema, types, schemas (current)
2. **Phase 2** — Authentication and provider portal
3. **Phase 3** — Kit ordering + GHL pipeline integration
4. **Phase 4** — Inbound webhooks (tracking + lab results)
5. **Phase 5** — Chain of custody + barcode tracking
6. **Phase 6** — Live integration wiring

---

Built by Web Synq Design for Renoviant Inc. | Confidential
