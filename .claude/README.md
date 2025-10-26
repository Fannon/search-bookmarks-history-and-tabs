# Claude Code Configuration

This directory contains Claude Code enhancements for the browser extension project.

## Slash Commands

Available commands (use with `/` prefix):

### `/context`
Loads project context from `AGENTS.md` to understand architecture and conventions.

### `/lint`
Runs ESLint validation to check code style and catch errors.
```bash
npm run lint
```

### `/test [file]`
Runs Jest unit tests. Optional file path for focused testing.
```bash
npm run test                    # All tests
npm run test path/to/file.test.js  # Specific test
```

### `/build`
Executes full production build (clean → bundle → manifests → dist → size report).
```bash
npm run build
```

### `/verify`
Runs the complete verification loop (recommended before commits):
1. ESLint validation
2. Jest unit tests
3. Playwright e2e tests

```bash
npm run lint && npm run test && npm run test:e2e
```

## Hooks

Automated verification hooks are configured in `settings.local.json`:

### SessionStart Hook
Displays available commands when starting a new Claude Code session.

### PostToolUse Hooks

**File modification reminder**: After Edit/Write operations, reminds to run verification.

**Pre-commit linting**: Before git commits, automatically runs lint check.

## Permissions

Pre-approved permissions:
- `WebFetch(domain:github.com)` - Fetch GitHub documentation and issues
- `Read(//tmp/**)` - Read temporary files (e.g., test artifacts)

## Recommended Workflow

1. Start development with `/context` to load project conventions
2. Make code changes
3. Run `/lint` to check style (fast feedback)
4. Run `/test <file>` for focused unit testing
5. Run `/verify` before committing
6. Create commits/PRs (hooks will auto-verify)

## Development Tips

- Use `npm run watch` for auto-rebuild during development
- Keep `/verify` passing before creating PRs
- Hooks provide automatic reminders but don't block work
- All slash commands map to npm scripts documented in CLAUDE.md
