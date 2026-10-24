# 002: Jobs and media

Run pg-boss as a separate long-running Railway Node container, sharing the Neon database; Vercel cannot run that worker. Host provisioning is pending. Choose Cloudflare R2 S3-compatible storage for production: the advertised free allowance is 10 GB-month storage, 1 million Class A and 10 million Class B operations monthly (verify current billing terms before launch). Neither service is provisioned yet. The no-bucket local development fallback is documented in [009](009-local-media.md).
