# Search Result Scoring Changelog

This log tracks user-visible changes to how popup search results are ranked across releases.

## v1.16.0

- **Higher bonuses for perfect matches.** Exact matches on titles, tags, and folders now receive +20, +15, and +10 points respectively (previously +15, +10, +5), so precise results appear ahead of partial matches by default.
- **Better handling of multi-term queries.** Search terms are evaluated individually in a case-insensitive way, ensuring multi-word queries and mixed-case text reliably trigger the configured substring bonuses.

## v1.15.0

- **Recency bonus applies to just-opened items.** Results you opened moments ago now receive the maximum recency bonus instead of being skipped.
- **Option names for base weights shortened.** Custom configuration keys for base bookmark, history, and tab weights no longer include the trailing "Score" word, so existing overrides must adopt the shorter names to keep working.
