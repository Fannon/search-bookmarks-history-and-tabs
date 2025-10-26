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

## Git Hooks

Pre-commit hooks automatically run via **simple-git-hooks + lint-staged**:

### What happens on commit:
1. **JS/MJS files**: Biome check with auto-fix (lint + format)
2. **CSS/HTML/JSON/MD**: Biome format
3. Files are auto-fixed and re-staged
4. Commit proceeds with clean code

### Bypass hooks (emergency only):
```bash
git commit --no-verify -m "message"
# or
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "message"
```

### Manual lint staged files:
```bash
npm run lint:staged
```

## Recommended Workflow

1. Start development with `/context` to load project conventions
2. Make code changes
3. Run `/lint` to check style (fast feedback)
4. Run `/test <file>` for focused unit testing
5. Run `/verify` before committing
6. Commit changes (hooks auto-fix style issues)

## Development Tips

- Use `npm run watch` for auto-rebuild during development
- Keep `/verify` passing before creating PRs
- Pre-commit hooks auto-fix style issues
- All slash commands map to npm scripts documented in CLAUDE.md
- Hooks use `simple-git-hooks` (~10KB, zero deps) for speed
