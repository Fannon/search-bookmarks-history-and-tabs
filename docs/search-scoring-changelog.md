# Search scoring changelog

## Unreleased

- Removed the stopword guardrail on substring bonuses. Tokens are now filtered only by length or numeric checks, ensuring every configured term participates in scoring without needing locale-specific lists.
- Dropped support for legacy base-score option keys (e.g., `scoreBookmarkBaseScore`). Extension configurations must now use the canonical option names to take effect.
