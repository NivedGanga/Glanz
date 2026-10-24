# 004: Flags and Run 1 additions

Store flags, rules and audit entries in PostgreSQL; evaluate server-side with 30-second cache and an injectable provider interface. Off is the fallback on error. Every flag has owner, description and removal target. No flag is enabled in production while developing.

Added Run 1 flags: `marketplace.report` protects authenticity moderation; `search.fuzzy_keywords` controls trigram search; `customer.photo_tagging` gates consented request-photo analysis; `reco.fuzzy_keywords` controls keyword relevance. Later-run reserved keys are documentation only, not registered. Turning off a flag preserves existing data.
