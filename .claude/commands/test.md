---
description: Run Jest unit tests with optional file path
---

Run the Jest unit test suite for this project.

Usage:
- `/test` - Run all unit tests
- `/test <path/to/file.test.js>` - Run specific test file
- Add `-- --coverage` for coverage report

Before testing:
1. Ensure `npm install` has been run
2. Check for lint errors first with `/lint`

After running tests, report:
- Number of test suites passed/failed
- Any failing tests with error messages
- Suggestions for fixes if tests fail
