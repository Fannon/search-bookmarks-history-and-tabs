# Contributing to Search Bookmarks, History & Tabs Extension

Thank you for your interest in contributing!
This project is a browser extension for searching and navigating bookmarks, history, and open tabs.
Please review the guidelines below before submitting changes.

## Getting Started

- **Read the [README.md](./README.md)** for project overview, setup instructions, and usage details.
- **Review [Copilot Instructions](.github/copilot-instructions.md)** for architecture, data flow, and coding conventions.

## How to Contribute

1. **Fork the repository** and create your branch from `main`.
2. **Install dependencies:**

```bash
npm install
```

3. **Build and run locally:**

- Build: `npm run build`
- Start (mock data): `npm run start`
- Manual browser install: Load unpacked extension from repo root (Chrome/Edge) or `dist/firefox` (Firefox).

4. **Testing:**

- Run end-to-end tests: `npm run test` (Cypress tests in `cypress/e2e/`).

5. **Code Style & Patterns:**

- Follow architecture and file conventions in [Copilot Instructions](.github/copilot-instructions.md).
- Place search logic in `popup/js/search/`, views in `popup/js/view/`, models in `popup/js/model/`, and helpers in `popup/js/helper/`.
- Use bundled libraries from `popup/lib/` (see README for details).

6. **Adding Features:**

- For new search modes, update query parsing in `popup/js/search/common.js` and relevant search files.
- Document changes in `README.md` and `popup/js/model/options.js` if user-configurable.

7. **Pull Requests:**

- Ensure your code is tested and documented.
- Reference related issues in your PR description.
- Keep PRs focused and concise.

## Reporting Issues

- Use GitHub Issues for bugs, feature requests, or questions.
- Include steps to reproduce, expected behavior, and relevant logs/screenshots.

---

For questions or feedback on these guidelines, open an issue or start a discussion.  
Happy coding!
