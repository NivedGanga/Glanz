# 002: Jobs and media

Run pg-boss as a separate long-running Railway Node container, sharing the Neon database; Vercel cannot run that worker. Host provisioning is pending. Choose Cloudflare R2 S3-compatible storage: the advertised free allowance is 10 GB-month storage, 1 million Class A and 10 million Class B operations monthly (verify current billing terms before launch). Resize uploads, strip metadata, and issue short-lived signed GET URLs. Neither service is provisioned yet.
