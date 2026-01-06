# Demo Recording Script

This document provides a step-by-step guide for recording a demonstration video of the "Search Bookmarks, History and Tabs" browser extension using screen recording software.

## Prerequisites

1. **Screen Recording Software**: OBS Studio, Camtasia, or similar
2. **Browser**: Chrome or Edge with the extension installed
3. **Clean Browser Profile**: Optional but recommended for a professional look
4. **Microphone**: Optional for voiceover (can be added in post-production)

## Preparation

### Option A: Use Local Development Server (Recommended for Control)

Run the extension in development mode to use the enhanced mock data:

```bash
# Start the development server
npm run start

# Open in browser
open http://localhost:8080/popup/
```

This gives you full control over the data and allows you to use `window.ext.printInfo()` from the browser console to overlay explanatory text.

### Option B: Use Real Browser Extension

Install the extension in Chrome/Edge and use your actual bookmarks, history, and tabs.

---

## Recording Setup

### Recommended Screen Resolution
- **Popup window size**: 515×600 pixels
- **Recording area**: Slightly larger to show browser context (800×700)
- **Frame rate**: 30fps
- **Format**: MP4 (H.264) for maximum compatibility

### Browser Setup
1. Close unnecessary tabs
2. Disable other extension icons in the toolbar for a cleaner look
3. Set up a few tab groups with meaningful names:
   - "Code Repos" (blue)
   - "Documentation" (green)  
   - "News & Social" (orange)

---

## Demo Script Sections

### 1. Introduction (15-20 seconds)

**Action**: Show the extension icon in the browser toolbar, then click to open

**Info Overlay** (paste in browser console):
```javascript
window.ext.printInfo(
  'Welcome to Search Bookmarks, History & Tabs',
  'A powerful browser extension for quickly finding and navigating to your bookmarks, open tabs, and browsing history - all from one place.'
)
```

**Narration**: *"Let me show you how to quickly find anything in your browser..."*

---

### 2. Basic Search (20-30 seconds)

**Action**: 
1. Dismiss the info overlay (press Enter or click OK)
2. Type "github" in the search box
3. Show results appearing in real-time
4. Use arrow keys to navigate

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Real-time Search',
  'Just start typing! Results update instantly as you type. Use ↑/↓ arrow keys to navigate, Enter to open.'
)
```

**Narration**: *"Just start typing and results appear instantly. You can see bookmarks, open tabs, and history items all in one place."*

---

### 3. Result Types (20-25 seconds)

**Action**:
1. Dismiss overlay
2. Search for something that shows mixed results (e.g., "javascript")
3. Point out the different colored left borders

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Color-Coded Result Types',
  'Results are color-coded for quick identification:\n• Teal = Bookmarks\n• Purple = Open Tabs\n• Green = History\n• Yellow = Search Engines'
)
```

**Narration**: *"Each result type has a distinct color - teal for bookmarks, purple for open tabs, and green for history entries."*

---

### 4. Search Only Tabs (15-20 seconds)

**Action**:
1. Clear search
2. Type "t " (t followed by space)
3. Show only tab results

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Tab-Only Search',
  'Prefix your search with "t " to search only among open tabs. This is great when you have many tabs open!'
)
```

**Narration**: *"Prefix with 't' and a space to search only your open tabs."*

---

### 5. Search Only Bookmarks (15-20 seconds)

**Action**:
1. Clear search
2. Type "b docs" (b followed by space, then search term)
3. Show only bookmark results

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Bookmark-Only Search',
  'Prefix with "b " to search only bookmarks. Perfect for finding saved links quickly!'
)
```

**Narration**: *"Similarly, 'b' for bookmarks only..."*

---

### 6. Search Only History (15-20 seconds)

**Action**:
1. Clear search
2. Type "h google"
3. Show history results

**Info Overlay**:
```javascript
window.ext.printInfo(
  'History Search',
  'Prefix with "h " to search your browsing history. Includes recently visited pages from the past 14 days.'
)
```

---

### 7. Tag-Based Search (25-30 seconds)

**Action**:
1. Clear search
2. Type "#json"
3. Show bookmarks with the #json tag
4. Click on a tag badge to demonstrate filtering

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Search by Tags',
  'Use # to search by bookmark tags. Add tags to your bookmark titles like "#docs #javascript" to organize your collection.'
)
```

**Narration**: *"If you add hashtags to your bookmark titles, you can search by tags using the # prefix."*

---

### 8. Folder-Based Search (20-25 seconds)

**Action**:
1. Clear search
2. Type "~Tools"
3. Show bookmarks in the Tools folder
4. Click on a folder badge

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Search by Folder',
  'Use ~ to filter by bookmark folder. Great for quickly accessing all bookmarks in a specific folder.'
)
```

---

### 9. Tab Groups (20-25 seconds)

**Action**:
1. Clear search  
2. Type "@Documentation"
3. Show tabs in that group

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Tab Group Search',
  'Use @ to filter by Chrome tab groups. If you organize tabs into groups, you can quickly find them here!'
)
```

**Narration**: *"And if you use Chrome's tab groups feature, search with @ to find tabs in a specific group."*

---

### 10. Hybrid Search with TAB Key (25-30 seconds)

**Action**:
1. Clear search
2. Type "#docs"
3. Press TAB key (adds two spaces)
4. Continue typing a search term like "react"

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Hybrid Search - TAB for Refinement',
  'After a tag/folder/group filter, press TAB to add a secondary text search. Example: "#docs" + TAB + "react" finds React docs.'
)
```

**Narration**: *"Here's a power-user tip: after filtering by tag, press TAB to add a text search on top of it."*

---

### 11. Tags Overview (15-20 seconds)

**Action**:
1. Click on "Tags" in the footer navigation
2. Show the tags overview page
3. Click on a tag to filter

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Tags Overview',
  'The Tags page shows all unique tags found in your bookmarks. Click any tag to instantly filter and see matching bookmarks.'
)
```

---

### 12. Folders Overview (15-20 seconds)

**Action**:
1. Navigate to Folders
2. Show folder hierarchy
3. Click on a folder

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Folders Overview',
  'Browse your bookmark folder structure. Click any folder to see all bookmarks contained within it.'
)
```

---

### 13. Tab Groups Overview (15-20 seconds)

**Action**:
1. Navigate to Tab Groups
2. Show groups with counts
3. Click on a group

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Tab Groups Overview',
  'See all your Chrome tab groups at a glance. The count shows how many tabs are in each group.'
)
```

---

### 14. Precise vs Fuzzy Search (25-30 seconds)

**Action**:
1. Return to Search
2. Click the PRECISE/FUZZY toggle on the right
3. Show how results differ with fuzzy search
4. Toggle back

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Search Modes: Precise vs Fuzzy',
  'Toggle between PRECISE (exact matches) and FUZZY (approximate matches). Fuzzy search is forgiving of typos! Shortcut: Ctrl+F'
)
```

**Narration**: *"Toggle between precise and fuzzy search. Fuzzy mode is great if you're not sure of the exact spelling."*

---

### 15. Options & Customization (20-25 seconds)

**Action**:
1. Navigate to Options
2. Scroll through some options
3. Show enabling favicons

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Customization Options',
  'Configure colors, enable/disable features, adjust search scoring, and much more. Changes are synced across your browsers!'
)
```

**Narration**: *"The extension is highly customizable through the Options page."*

---

### 16. Tips & Tricks (Closing) (25-30 seconds)

**Action**: Return to Search, show the empty state with recent tabs

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Pro Tips',
  '• Set a keyboard shortcut in chrome://extensions/shortcuts\n• Right-click results to copy URLs\n• Ctrl+Enter opens in background tab\n• Shift+Enter replaces current tab\n• Recently visited tabs show when search is empty'
)
```

**Narration**: *"A few pro tips to finish: Set a keyboard shortcut for lightning-fast access, and remember these modifier keys for different open behaviors..."*

---

### 17. Closing (10 seconds)

**Info Overlay**:
```javascript
window.ext.printInfo(
  'Thanks for Watching!',
  'Available for Chrome, Edge, and Firefox. Open source on GitHub.\n\ngithub.com/Fannon/search-bookmarks-history-and-tabs'
)
```

---

## Post-Production Tips

1. **Transitions**: Use simple fade or cut transitions between sections
2. **Speed**: Consider speeding up typing slightly (1.25x) to keep the demo moving
3. **Captions**: Add captions for accessibility
4. **Music**: Subtle background music can help (lower it when narrating)
5. **Thumbnail**: Capture a nice frame showing the search in action

## Total Estimated Runtime

- **With voiceover**: ~5-6 minutes
- **Sped up montage**: ~2-3 minutes
- **Quick feature highlight**: ~1.5 minutes

## Console Commands Quick Reference

```javascript
// Show info overlay
window.ext.printInfo('Title', 'Message with details')

// Dismiss info overlay
window.ext.closeInfo()

// You can also trigger from the overlay OK button or by pressing Enter/Escape
```
