# Style and Conventions
- Use modern ESM JavaScript with explicit exports and minimal side effects.
- Follow eslint.config.mjs: two-space indentation, single quotes, no trailing semicolons.
- Name files by feature (e.g., `searchResultsView.js`) and mirror for tests (`*.test.js`).
- Keep concerns separated: helpers, models, search logic, and views under respective subdirectories.