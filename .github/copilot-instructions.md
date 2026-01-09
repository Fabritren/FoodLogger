# Food Logger - AI Coding Agent Instructions

## Project Overview

Food Logger is a **Progressive Web App (PWA)** for tracking food entries with timestamps. It uses **IndexedDB for offline-first local storage**, a **three-panel UI** (add entries, view data table, view scatter plot visualization), and emphasizes **diacritical mark normalization** for international text search.

### Key Architecture Decision
The app separates concerns into **three data layers**: raw storage (`db.js`), UI coordination (`app.js`), and presentation (`plot.js`, `table.js`, `entry.js`). Data flows from raw IndexedDB → `buildProcessed()` transformation → UI components.

## Critical Data Structures

**Raw Entry** (IndexedDB storage):
```javascript
{ key: <auto-increment>, time: "2025-01-08T14:30:00", text: "apple, banana" }
```

**Processed Entry** (split comma-separated text into individual items):
```javascript
{ time: "2025-01-08T14:30:00", text: "Apple" }  // capitalized, split from comma list
```

**Category** (IndexedDB storage):
```javascript
{ key: <auto-increment>, name: "Breakfast", color: "#FF6B6B", foods: ["Apple", "Banana"] }
```

**Rect Object** (plot visualization):
```javascript
{ x: dayOffset, yStart: hourValue, yEnd: hourValue+1, label, color, hidden, _hitBox }
```

## Core Data Flow

1. **Add Entry** (`entry.js`): User enters time + comma-separated text → `addRaw(entry)` or `updateRaw(key, entry)`
2. **Retrieve & Process** (`app.js`): `getAllRaw()` → `buildProcessed()` splits text by commas, capitalizes
3. **Render** (`plot.js`, `table.js`, `entry.js`): `updateQuickButtons()`, `drawPlot()`, `updateTable()`
4. **Global State**: `processedTable[]` holds split items; `editingKey` tracks edit mode

## Project-Specific Patterns

### 1. Text Normalization (NFD Unicode)
Throughout the codebase (table.js, entry.js), text is normalized for international search:
```javascript
.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
```
This removes diacritical marks (é → e) for accent-insensitive matching. **Always apply this when implementing search or filtering.**

### 2. Comma-Separated Text Entry
Users enter `"apple, banana, carrot"` in a single field. The `buildProcessed()` function splits on commas and trims whitespace. When handling text, assume it may contain comma-separated values unless explicitly single-item.

### 3. IndexedDB with Cursor Iteration
The `getAllRaw()` callback uses `store.openCursor()` to fetch all entries. Results are **sorted newest-to-oldest** by default (line 106 in db.js). If order changes, update both the sort logic and any dependent UI.

### 4. Callback-Based Async (No Promises)
Most DB operations use callbacks (e.g., `getRaw(key, cb)`), though some return Promises (e.g., `clearRaw()`). **Maintain consistency**: new DB functions should support both callback and Promise patterns.

### 5. Global UI State Management
- `processedTable`: Array of split entries used by plot and quick buttons
- `editingKey`: Non-null during edit mode; triggers "Update" button display and discard button visibility
- `db`: Global IndexedDB connection (opened in `index.html` via script tag)

## UI Components

### Panel System (`app.js`)
Four mutually-exclusive panels: `panel-plot`, `panel-data`, `panel-categories`, `panel-add`. Use `showPanel(name)` to switch. Only one visible at a time.

### Plot Visualization (`plot.js`)
- **Canvas-based scatter plot** using Chart.js library
- **X-axis**: days (origin is earliest entry's date at 00:00)
- **Y-axis**: hours (0-24)
- **Rectangles**: custom plugin draws colored boxes per entry, stacked horizontally if overlapping same hour
- **Legend**: dynamically generated from unique labels with HSL color assignment (or category colors if in category mode)
- **Toggle visibility**: dataset legend click toggles `hidden` flag
- **View modes**: Toggle between "Foods" (individual food entries) and "Categories" (grouped by assigned categories) via `togglePlotView()`

### Categories Panel (`categories.js`)
- **Create/Edit/Delete categories** via modal form
- **Assign foods to categories** using checkboxes (populated from `processedTable` unique values)
- **Color picker** for each category
- **Category list** shows name, assigned foods, and color preview
- Global state: `categories[]` (cached), `showCategoriesInPlot` (toggle flag)

### Quick Buttons (`entry.js`)
- Dynamic buttons from `processedTable`, sorted by frequency (descending), then alphabetically
- Filtered by `quickFilter` input with NFD normalization
- Clicking appends text to textarea with comma + space separator

### Search & Table (`table.js`)
- NFD-normalized substring matching
- Debounced input (250ms) to avoid excessive updates
- Edit/delete actions via buttons in action column

## Development Patterns

### Logging
Functions log entry/exit and key decision points using `console.log('[functionName]', ...)` format. Maintain this for debugging.

### Form Elements
Direct DOM access: `textNewEntry`, `dt`, `quickFilter`, `searchInput`. These are defined as global references in `index.html`. Assume they exist.

### Refresh Cycle
After any data modification (add, update, delete, import), always call `refresh()`. This triggers:
1. `getAllRaw()` fetch
2. `buildProcessed()` split
3. `drawPlot()` redraw
4. `updateQuickButtons()` regenerate
5. `updateTable()` refresh table

### Edit Mode Lifecycle
1. Click edit button → `editEntry(key)` loads entry, sets `editingKey`, shows "Update" button
2. User modifies and clicks "Update" → `addEntry()` calls `updateRaw()` instead of `addRaw()`
3. Click "Discard" → `discardEdit()` clears `editingKey` and resets form

## Integration Points

- **indexedDB API**: Standard browser API for offline persistence. Database name: `logger-db`; object stores: `raw` (entries) and `categories` (category metadata).
- **Chart.js Library**: Must be loaded before `plot.js`. Used for scatter plot rendering
- **localStorage**: Not used; all data persists via IndexedDB
- **Manifest**: Defines PWA metadata (name, theme color, display mode)

## Common Workflows

### Adding a Feature to the Quick Buttons
Modify `updateQuickButtons()` in [entry.js](../js/entry.js). Note: filtering and counting already handle normalization; maintain that pattern.

### Managing Categories
- Create/edit: `showCategoryModal(categoryKey?)` opens form with food checkboxes
- Save: `saveCategoryForm()` calls `addCategory()` or `updateCategory()` and triggers `refresh()`
- Delete: `deleteCategory(key)` removes category and triggers `refresh()`
- Refresh list: `updateCategoriesList()` fetches and renders all categories

### Toggling Plot View (Foods vs. Categories)
Call `togglePlotView('foods')` or `togglePlotView('categories')` — this sets `showCategoriesInPlot` and calls `refresh()`. The `drawPlot()` function checks this flag and either:
- Maps each food entry to its assigned category name (if `showCategoriesInPlot = true`)
- Uses food names directly with generated HSL colors (if `showCategoriesInPlot = false`)

### Fixing a Plot Bug
Check [plot.js](../js/plot.js) — specifically `drawPlot()` for data transformation (including category mapping) and `rectanglePlugin` for canvas rendering. X/Y calculations are in helper functions (`getDateX()`, `getHourValue()`).

### Extending Search Capability
Update `updateTable()` in [table.js](../js/table.js) or `updateQuickButtons()` in [entry.js](../js/entry.js). Remember to apply NFD normalization to both query and text being searched.

### Data Export/Import
`exportData()` and `importData()` in [app.js](../js/app.js) serialize/deserialize via JSON. The new export format produces an object with two top-level keys: `entries` (array of `{time, text}`) and `categories` (array of `{name, color, foods}`). Import now **clears both** the `raw` and `categories` stores before importing new data to ensure a clean state. The importer accepts the legacy array-only format (an array of entries) for backward compatibility as well as the new object format with `entries` and `categories`.

## Notes for Agents

- **No build step**: This is client-side JS; open `index.html` directly in a browser
- **Testing**: Manual testing in browser; check DevTools console for debug logs
- **Mobile-first design**: CSS uses flexbox and responsive viewport; maintain on smaller screens
- **Keyboard date input**: Uses HTML5 `<input type="datetime-local">` — format is fixed to `YYYY-MM-DDTHH:mm`
