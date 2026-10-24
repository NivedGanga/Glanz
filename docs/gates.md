# Proposed launch gates (owner approval required)

- Search p95 server latency: below 500 ms on a representative district dataset and production-sized database.
- Photo tagging on 50 owner-labelled real shop photos: category precision >= 0.90, colour precision >= 0.85, era/style precision >= 0.80; inspect recall and failure examples separately. Do not enable in production before approval.
- Conservative free-text pg_trgm similarity threshold: 0.45. Minimum recommendation relevance: 2 points. Present at most 5 shops.
- Run 3 calibration placeholders only (no implementation): at least 100 labelled outcomes per category and measured acceptance; the owner sets thresholds before Run 3.
- Real-user launch requires Vercel Pro, production Gemini paid project with budget alert, verified storage/worker/database limits, legal privacy review and configured email DNS/DLT registration.
