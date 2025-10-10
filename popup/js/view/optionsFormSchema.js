export const optionSections = [
  {
    id: 'general',
    title: 'General',
    description:
      'Basic behaviour that affects diagnostics and how the extension behaves when it starts.',
    properties: {
      debug: {
        type: 'boolean',
        title: 'Enable debug logging',
        description:
          'When enabled, the extension logs additional information that can help with troubleshooting and performance measurements.',
      },
    },
  },
  {
    id: 'search',
    title: 'Search',
    description: 'Configure how search behaves and how aggressively it matches results.',
    properties: {
      searchStrategy: {
        type: 'string',
        enum: ['precise', 'fuzzy'],
        title: 'Search strategy',
        description:
          'Choose between “precise” for exact matches or “fuzzy” to allow approximate matches powered by uFuzzy.',
      },
      searchMaxResults: {
        type: 'integer',
        minimum: 1,
        maximum: 200,
        title: 'Maximum search results',
        description: 'Limit how many matches are displayed. Lower numbers improve performance.',
      },
      searchMinMatchCharLength: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        title: 'Minimum match length',
        description: 'Minimum amount of characters a search term must have to be considered a match.',
      },
      searchFuzzyness: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        multipleOf: 0.05,
        title: 'Fuzzyness',
        description: 'Only used with the fuzzy search strategy. Values closer to 1 make matches more tolerant.',
      },
      searchDebounceMs: {
        type: 'integer',
        minimum: 0,
        maximum: 1000,
        title: 'Search debounce (ms)',
        description: 'Delay in milliseconds before a search is executed after typing.',
      },
    },
  },
  {
    id: 'colors',
    title: 'Colors & Style',
    description: 'Customise the colour coding of results.',
    properties: {
      colorStripeWidth: {
        type: 'integer',
        minimum: 0,
        maximum: 20,
        title: 'Result stripe width (px)',
        description: 'Width in pixels of the colour marker shown next to results.',
      },
      bookmarkColor: {
        type: 'string',
        format: 'color',
        title: 'Bookmark colour',
      },
      tabColor: {
        type: 'string',
        format: 'color',
        title: 'Tab colour',
      },
      historyColor: {
        type: 'string',
        format: 'color',
        title: 'History colour',
      },
      searchColor: {
        type: 'string',
        format: 'color',
        title: 'Search colour',
      },
      customSearchColor: {
        type: 'string',
        format: 'color',
        title: 'Custom search colour',
      },
      directColor: {
        type: 'string',
        format: 'color',
        title: 'Direct URL colour',
      },
    },
  },
  {
    id: 'sources',
    title: 'Search sources',
    description: 'Control which data sources are indexed and returned in the results.',
    properties: {
      enableTabs: {
        type: 'boolean',
        title: 'Include open tabs',
      },
      enableBookmarks: {
        type: 'boolean',
        title: 'Include bookmarks',
      },
      enableHistory: {
        type: 'boolean',
        title: 'Include browsing history',
        description:
          'History lookups can be slow on very large profiles. Consider reducing the history range if performance is an issue.',
      },
      enableSearchEngines: {
        type: 'boolean',
        title: 'Offer fallback search engines',
      },
      enableHelp: {
        type: 'boolean',
        title: 'Show help hints on startup',
      },
      enableDirectUrl: {
        type: 'boolean',
        title: 'Enable direct URL navigation',
        description: 'Treats URL-like search terms as navigable addresses.',
      },
    },
  },
  {
    id: 'display',
    title: 'Display',
    description: 'Configure which metadata is visible in the results.',
    properties: {
      displayTags: {
        type: 'boolean',
        title: 'Show tag badges',
        description: 'Disabling also hides the tag overview and tag search mode.',
      },
      displayFolderName: {
        type: 'boolean',
        title: 'Show bookmark folders',
        description: 'Disabling also hides the folder overview and folder search mode.',
      },
      displaySearchMatchHighlight: {
        type: 'boolean',
        title: 'Highlight matches',
        description: 'Highlights matched terms in results. Disable if rendering performance is critical.',
      },
      displayLastVisit: {
        type: 'boolean',
        title: 'Show last visit time',
      },
      displayVisitCounter: {
        type: 'boolean',
        title: 'Show visit counter',
      },
      displayDateAdded: {
        type: 'boolean',
        title: 'Show bookmark creation date',
      },
      displayScore: {
        type: 'boolean',
        title: 'Show score',
        description: 'Shows the calculated relevance score used for ordering results.',
      },
    },
  },
  {
    id: 'bookmarks',
    title: 'Bookmarks',
    description: 'Exclude certain bookmark folders from the index.',
    properties: {
      bookmarksIgnoreFolderList: {
        type: 'array',
        items: { type: 'string' },
        title: 'Ignore folders',
        description: 'One folder path per line. Matching folders (and their subfolders) are excluded.',
        ui: { widget: 'multiline' },
      },
    },
  },
  {
    id: 'tabs',
    title: 'Tabs',
    description: 'Optimise the tab experience.',
    properties: {
      tabsOnlyCurrentWindow: {
        type: 'boolean',
        title: 'Only use current window',
      },
      maxRecentTabsToShow: {
        type: 'integer',
        minimum: 0,
        maximum: 50,
        title: 'Recent tabs to display',
        description: 'Number of recent tabs listed when the popup opens with an empty search. Set to 0 to disable.',
      },
    },
  },
  {
    id: 'history',
    title: 'History',
    description: 'Tune how much browsing history is considered.',
    properties: {
      historyDaysAgo: {
        type: 'integer',
        minimum: 0,
        maximum: 365,
        title: 'History range (days)',
      },
      historyMaxItems: {
        type: 'integer',
        minimum: 0,
        maximum: 5000,
        title: 'Maximum history items',
        description: 'Higher limits may impact startup and search performance.',
      },
      historyIgnoreList: {
        type: 'array',
        items: { type: 'string' },
        title: 'Ignore URLs containing',
        description: 'Skip history entries that include any of these substrings. One entry per line.',
        ui: { widget: 'multiline' },
      },
    },
  },
  {
    id: 'search-engines',
    title: 'Search engines',
    description: 'Manage fallback and custom search engines.',
    properties: {
      searchEngineChoices: {
        type: 'array',
        title: 'Fallback search engines',
        description: 'Engines that appear at the bottom of the result list as external search suggestions.',
        items: {
          type: 'object',
          title: 'Search engine',
          properties: {
            name: {
              type: 'string',
              title: 'Name',
            },
            urlPrefix: {
              type: 'string',
              title: 'Search URL prefix',
              description: 'Use $s as placeholder for the search term. If omitted, the term is appended to the URL.',
            },
          },
          required: ['name', 'urlPrefix'],
        },
        ui: { widget: 'arrayObject', addButtonLabel: 'Add search engine' },
      },
      customSearchEngines: {
        type: 'array',
        title: 'Custom search engines',
        description:
          'Define quick aliases that trigger dedicated search engines. Use the alias followed by a space to run them.',
        items: {
          type: 'object',
          title: 'Custom search engine',
          properties: {
            alias: {
              type: 'array',
              items: { type: 'string' },
              title: 'Aliases',
              description: 'Comma separated list of triggers (for example: g, google).',
              ui: { widget: 'tags' },
            },
            name: {
              type: 'string',
              title: 'Name',
            },
            urlPrefix: {
              type: 'string',
              title: 'Search URL prefix',
              description: 'Use $s as placeholder for the search term. If omitted, the term is appended to the URL.',
            },
            blank: {
              type: 'string',
              title: 'Optional default URL',
              description: 'Visited when the alias is used without a search term.',
            },
          },
          required: ['alias', 'name', 'urlPrefix'],
        },
        ui: { widget: 'arrayObject', addButtonLabel: 'Add custom search engine' },
      },
    },
  },
  {
    id: 'scores',
    title: 'Score calculation',
    description: 'Fine-tune how relevance scores are calculated.',
    properties: {
      scoreMinScore: {
        type: 'integer',
        minimum: 0,
        maximum: 1000,
        title: 'Minimum score threshold',
      },
      scoreMinSearchTermMatchRatio: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        title: 'Minimum match ratio',
        description: 'Only applies to precise search. Values closer to 1 require more exact matches.',
      },
      scoreBookmarkBaseScore: {
        type: 'integer',
        minimum: 0,
        title: 'Bookmark base score',
      },
      scoreTabBaseScore: {
        type: 'integer',
        minimum: 0,
        title: 'Tab base score',
      },
      scoreHistoryBaseScore: {
        type: 'integer',
        minimum: 0,
        title: 'History base score',
      },
      scoreSearchEngineBaseScore: {
        type: 'integer',
        minimum: 0,
        title: 'Search engine base score',
      },
      scoreCustomSearchEngineBaseScore: {
        type: 'integer',
        minimum: 0,
        title: 'Custom search engine base score',
      },
      scoreDirectUrlScore: {
        type: 'integer',
        minimum: 0,
        title: 'Direct URL score',
      },
      scoreTitleWeight: {
        type: 'number',
        minimum: 0,
        maximum: 5,
        title: 'Title weight',
      },
      scoreTagWeight: {
        type: 'number',
        minimum: 0,
        maximum: 5,
        title: 'Tag weight',
      },
      scoreUrlWeight: {
        type: 'number',
        minimum: 0,
        maximum: 5,
        title: 'URL weight',
      },
      scoreFolderWeight: {
        type: 'number',
        minimum: 0,
        maximum: 5,
        title: 'Folder weight',
      },
      scoreCustomBonusScore: {
        type: 'boolean',
        title: 'Allow manual bonus scores',
        description: 'Enable to parse “ +<score>” annotations inside bookmark titles for bonus points.',
      },
      scoreExactIncludesBonus: {
        type: 'integer',
        title: 'Includes bonus',
      },
      scoreExactIncludesBonusMinChars: {
        type: 'integer',
        minimum: 1,
        title: 'Minimum characters for includes bonus',
      },
      scoreExactStartsWithBonus: {
        type: 'integer',
        title: 'Starts-with bonus',
      },
      scoreExactEqualsBonus: {
        type: 'integer',
        title: 'Exact match bonus',
      },
      scoreExactTagMatchBonus: {
        type: 'integer',
        title: 'Tag match bonus',
      },
      scoreExactFolderMatchBonus: {
        type: 'integer',
        title: 'Folder match bonus',
      },
      scoreVisitedBonusScore: {
        type: 'number',
        minimum: 0,
        title: 'Visited bonus per visit',
      },
      scoreVisitedBonusScoreMaximum: {
        type: 'integer',
        minimum: 0,
        title: 'Visited bonus cap',
      },
      scoreRecentBonusScoreMaximum: {
        type: 'integer',
        minimum: 0,
        title: 'Recent visit bonus cap',
      },
    },
  },
  {
    id: 'power',
    title: 'Power user',
    description: 'Advanced options for specialised use-cases.',
    properties: {
      titleLengthRestrictionForUrls: {
        type: 'integer',
        minimum: 0,
        title: 'URL title length limit',
        description:
          'If a bookmark title looks like a URL, shorten it to this many characters to keep entries readable.',
      },
      uFuzzyOptions: {
        type: 'object',
        title: 'Custom uFuzzy options',
        description:
          'Paste advanced uFuzzy configuration as JSON. Leave empty to use the defaults bundled with the extension.',
        ui: { widget: 'json' },
      },
    },
  },
]
