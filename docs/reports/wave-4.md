# Wave 4 status

Shipped publish/pause gates, date-first search with district timezone conversion, availability-buffer and distance checks, structured exact filters, optional pg_trgm keyword matching, synonym normalisation, and reports with audited admin API. Search, distance, calendar, report and fuzzy flags remain off. The proposed search p95 gate is recorded in `docs/gates.md`.

Open: no Neon project to verify pg_trgm extension availability on the chosen plan before this wave; production enablement is blocked. Rating source and full calendar UI are incomplete. Reports have API moderation but no interactive review UI. Search integration/property tests against PostgreSQL and performance measurement have not run. Demo seed synonyms remain draft pending owner approval.
