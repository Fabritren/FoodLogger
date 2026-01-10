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
{ key: <auto-increment>, name: "Breakfast", color: "#FF6B6B", items: ["Apple", "Banana"] }
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

### 1. Text Normalization (NFD Unicode) & Frequency-Based Deduplication
Throughout the codebase (table.js, entry.js, categories.js, app.js), text is normalized for international search:
```javascript
.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
```
This removes diacritical marks (é → e) for accent-insensitive matching. **Always apply this when implementing search or filtering.**

Additionally, `buildProcessed()` groups items by normalized text and tracks frequency of text variations. The most frequently used variation is displayed throughout the app (plot, quick buttons, category checkboxes). This ensures consistency when users enter the same item with different cases (e.g., "apple", "Apple", "APPLE" are treated as one item).

### 2. Comma-Separated Text Entry
Users enter `"apple, banana, carrot"` in a single field. The `buildProcessed()` function splits on commas and trims whitespace. When handling text, assume it may contain comma-separated values unless explicitly single-item.

### 3. IndexedDB with Cursor Iteration
The `getAllRaw()` callback uses `store.openCursor()` to fetch all entries. Results are **sorted newest-to-oldest** by default (line 106 in db.js). If order changes, update both the sort logic and any dependent UI.

### 4. Callback-Based Async (No Promises)
Most DB operations use callbacks (e.g., `getRaw(key, cb)`), though some return Promises (e.g., `clearRaw()`). **Maintain consistency**: new DB functions should support both callback and Promise patterns.

### 5. Global UI State Management
- `processedTable`: Array of split entries (with normalized frequency-based deduplication) used by plot and quick buttons
- `editingKey`: Non-null during edit mode; triggers "Update" button display and discard button visibility
- `rectangleClickEnabled`: Boolean flag controlling whether rectangle clicks search the database (default: false)
- `showCategoriesInPlot`: Boolean flag toggling between Items view and Categories view (default: true)
- `categoryModalSelectedItems`: Set tracking user selections in category modal, persists across filter changes
- `db`: Global IndexedDB connection (opened in `index.html` via script tag)

## UI Components

### Panel System (`app.js`)
Four mutually-exclusive panels: `panel-plot`, `panel-data`, `panel-categories`, `panel-add`. Use `showPanel(name)` to switch. Only one visible at a time.

### Plot Visualization (`plot.js`)
- **Canvas-based scatter plot** using Chart.js library with zoom/pan via mousewheel and pinch
- **X-axis**: days (origin is earliest entry's date at 00:00)
- **Y-axis**: hours (0-24)
- **Rectangles**: custom plugin draws colored boxes per entry, stacked horizontally if overlapping same hour
- **Legend**: dynamically generated from unique labels with HSL color assignment (or category colors if in category mode)
- **Toggle visibility**: dataset legend click toggles `hidden` flag
- **Rectangle click interaction**: Toggle "DB Search" button to enable/disable clicking rectangles to search the data table (default: disabled)
- **View modes**: Toggle between "Items" (individual item entries) and "Categories" (grouped by assigned categories) via `togglePlotView()` with automatic zoom/pan state preservation
- **Controls overlay**: Absolute-positioned buttons (Maximize, DB Search, Items/Categories toggle, Legend, Reset zoom) at top-left of canvas
- **State preservation**: Zoom/pan settings saved before redraw and restored after view toggle using `getPlotViewSettings()` and `setPlotViewSettings()`

### Categories Panel (`categories.js`)
- **Create/Edit/Delete categories** via modal form
- **Assign items to categories** using checkboxes (populated from `processedTable` unique values plus any legacy assigned items no longer in the data)
- **Color picker** for each category with automatic color suggestions avoiding hue clashes
- **Category list** shows name, assigned items, and color preview
- **Modal selection persistence**: Checkboxes maintain selection state across filter changes using `categoryModalSelectedItems` Set
- **Smart filtering**: Displays both current data items and legacy assigned items so users can remove obsolete entries
- **Quick action buttons**: "Select Filtered" (selects visible items), "Select Unused" (selects items not used in other categories), "Clear Selected" (unselects visible items)
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
2. `buildProcessed()` split (normalizes text, deduplicates by frequency, applies capitalization)
3. `drawPlot()` redraw (applies category mapping if `showCategoriesInPlot = true`)
4. `updateQuickButtons()` regenerate (filtered by `quickFilter`, sorted by frequency then alphabetically)
5. `updateTable()` refresh table (searches normalized text)

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
- **Create**: `showCategoryModal()` with no argument opens form for new category with auto-suggested color
- **Edit**: `showCategoryModal(categoryKey)` loads existing category; modal shows:
  - All current data items (from `processedTable`)
  - Legacy assigned items no longer in data (allows removal if needed)
  - Combined list sorted alphabetically
  - Selection persists across search filters via `categoryModalSelectedItems` Set
- **Save**: `saveCategoryForm()` calls `addCategory()` or `updateCategory()` and triggers `refresh()`
- **Delete**: `deleteCategory(key)` removes category and triggers `refresh()`
- **Refresh list**: `updateCategoriesList()` fetches and renders all categories
- **Quick actions**: `selectAllFilteredItems()`, `selectUnusedItems()`, `clearFilteredItems()` for bulk checkbox management

### Toggling Plot View (Items vs. Categories)
Call `togglePlotView('items')` or `togglePlotView('categories')` — this:
1. Saves current zoom/pan state with `getPlotViewSettings()`
2. Sets `showCategoriesInPlot` flag
3. Redraws plot with `drawPlot(processedTable)`
4. Restores zoom/pan after 100ms delay using `setPlotViewSettings()`

The `drawPlot()` function checks the flag and either:
- Maps each item entry to its assigned category name and color (if `showCategoriesInPlot = true`)
- Uses item names directly with generated HSL colors (if `showCategoriesInPlot = false`)

**Note**: The 100ms delay is required to allow Chart.js to initialize scales before applying custom limits.

### Fixing a Plot Bug
Check [plot.js](../js/plot.js) — specifically `drawPlot()` for data transformation (including category mapping) and `rectanglePlugin` for canvas rendering. X/Y calculations are in helper functions (`getDateX()`, `getHourValue()`).

### Extending Search Capability
Update `updateTable()` in [table.js](../js/table.js) or `updateQuickButtons()` in [entry.js](../js/entry.js). Remember to apply NFD normalization to both query and text being searched.

### Data Export/Import
`exportData()` and `importData()` in [app.js](../js/app.js) serialize/deserialize via JSON. The new export format produces an object with two top-level keys: `entries` (array of `{time, text}`) and `categories` (array of `{name, color, items}`). Import now **clears both** the `raw` and `categories` stores before importing new data to ensure a clean state. The importer accepts the legacy array-only format (an array of entries) for backward compatibility as well as the new object format with `entries` and `categories`.

## Notes for Agents

- **No build step**: This is client-side JS; open `index.html` directly in a browser
- **Testing**: Manual testing in browser; check DevTools console for debug logs
- **Mobile-first design**: CSS uses flexbox and responsive viewport; maintain on smaller screens
- **Keyboard date input**: Uses HTML5 `<input type="datetime-local">` — format is fixed to `YYYY-MM-DDTHH:mm`
