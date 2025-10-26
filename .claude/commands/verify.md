---
description: Run the complete verification loop (lint + unit tests + e2e)
---

Execute the full verification workflow before committing code.

This runs the recommended verify loop:
1. `npm run lint` - ESLint validation (always start here)
2. `npm run test` - Jest unit tests
3. `npm run test:e2e` - Playwright end-to-end tests (chromium only)

After verification:
- Report all errors/warnings from each step
- If any step fails, stop and report the failure
- Suggest fixes for common issues
- Confirm when all checks pass

For faster iteration during development:
- Use `/lint` alone to check style
- Use `/test <file>` for focused testing
- Run `/verify` before creating commits or PRs
