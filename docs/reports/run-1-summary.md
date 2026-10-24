# Run 1 summary — scaffold, not launch-ready

## What shipped

Five separate commits cover Foundations, Inventory, Photo entry and availability, Marketplace and search, and Requests and recommendations v1. The Run 1 migrations define district configuration, inventory, consent, availability, recommendation, moderation, event, flag and notification tables; no Run 2 or Run 3 tables or registered flags exist. All Run 1 flags are seeded **off**. The app, migration/seed scripts, worker, server APIs, demo portal screens, tests and CI scaffold are present. The only Playwright scenario implemented is a mobile portal smoke check, **not** the specified end-to-end business flows.

Every feature remains flagged off in production and in the demo seed. Staging may explicitly turn flags on only when prerequisites exist. Events themselves are always on. Production flags cannot be enabled through the admin flag endpoint while this run is in development.

## Decisions

- [Application, Drizzle, Neon, Vercel and Hobby-to-Pro rule](../decisions/001-stack.md)
- [Railway pg-boss worker and Cloudflare R2 media](../decisions/002-worker-and-media.md)
- [Gemini dev/prod, Resend, Twilio, email magic links, SMS OTP and future adapters](../decisions/003-adapters.md)
- [PostgreSQL flags and the four added Run 1 keys](../decisions/004-flags.md)
- [Kochi district configuration, English-only UI and draft romanised Malayalam synonyms](../decisions/005-district.md)
- [Consent purposes, DPDP legal review and export/deletion choices](../decisions/006-privacy.md)
- [Configurable limits, relevance, digest, badge and later calibration placeholders](../decisions/007-defaults.md)
- [Solo-owner overrides and explicit exclusions of payments/auto-match/later runs](../decisions/008-solo-overrides.md)
- [Free bucketless local development media, not for Vercel or production](../decisions/009-local-media.md)
- [Proposed latency and photo-accuracy launch gates](../gates.md)

Vercel Pro upgrade date: **pending**. Managed database extension/plan-limit checks, worker host, R2, paid Gemini project and budget alert, DNS and DLT registration: **pending owner provisioning**. No external credentials are stored.

## Verification and blockers

After npm access was approved, Docker PostgreSQL was started locally, migrations and a synthetic-photo seed loaded, and the worker completed a health job. `RUN_DB_TESTS=1 npm test` passes 55 tests against real PostgreSQL and `RUN_DEMO_E2E=1 npm run test:e2e` passes two browser tests. `npm run demo:local` exercises the local synthetic shop/customer flow; see the [Wave 3 local media](wave-3-local-media.md) and [Wave 5 local demo](wave-5-local-demo.md) reports. `npx tsc --noEmit` passes. The prior [GitHub Actions run 40114328355](https://github.com/NivedGanga/Glanz/actions/runs/40114328355) passed on the verification branch; CI on the local-media branch still needs confirmation. Live AI is excluded from normal CI by design.

Before enabling any real-user flag: fix the issues recorded in [Wave 1](wave-1.md), [Wave 2](wave-2.md), [Wave 3](wave-3.md), [Wave 4](wave-4.md) and [Wave 5](wave-5.md), especially atomic OTP and notification limits, real media erasure, authenticated moderation UI, test coverage, actual provider adapters, publication/photo validation and full end-to-end staging flows. pg_trgm works in CI's PostgreSQL container, but Neon extension availability on the selected actual plan was not verified before Wave 4; production enablement is blocked. Every missing acceptance check remains open rather than assumed passed.

## Exact commands

For the free local demo, from the repository root:

```sh
npm ci
npm run setup:local
docker compose up -d --wait
npm run db:migrate
npm run db:seed
# In separate terminals: npm run worker and npm run dev
npm run demo:local
RUN_DB_TESTS=1 npm test
RUN_DEMO_E2E=1 npm run test:e2e
npx tsc --noEmit
npm run build
npm audit --audit-level=high
```

The seed is **not idempotent**; run it once on a clean demo database. For no-bucket local development, run `npm run setup:local` **once**, `docker compose up -d --wait`, `npm run db:migrate`, `npm run db:seed`, then start `npm run worker` and `npm run dev` in separate terminals before `npm run demo:local`. `setup:local` refuses to overwrite existing secrets. This creates untracked local-only secrets and synthetic media under `.local-data/`. `PHOTO_TAGGER=fake` has no Gemini key and makes no external calls. Production requires owner-provisioned persistent storage, a paid Gemini project and real provider credentials; local files and generated development secrets must not be deployed to Vercel.

## Open questions for Run 2

Confirm the legal entity and privacy-policy owner, WhatsApp Business verification, invoice/GST requirements, provider contracts and storage retention, shop pricing/plan details, seasonal pause rules, and whether offline checkout conflict handling is viable for participating shops. Run 2 requires a separate prompt; no Run 2 code was started here.
