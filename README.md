# Food Logger

A **Progressive Web App (PWA)** for tracking food entries with offline-first local storage and data visualization.

## 📊 Features

- **Scatter Plot Visualization**: View your food entries across time with interactive zoom/pan controls
- **Categories & Tagging**: Organize items into custom categories with color coding
- **Correlation Analysis**: Discover patterns in your food data (e.g., which items appear together)
- **Data Table & Search**: Browse and search your entries with powerful filtering
- **Offline-First**: Works completely offline with no internet connection required
- **Import/Export**: Manually backup your data or transfer between devices
- **Mobile-Friendly**: Responsive design works on phones, tablets, and desktops

## 🔒 Data Privacy & Storage

### Important: Your Data Stays on Your Device

**Food Logger stores 100% of your data locally on your device using IndexedDB.** 

- ✅ No data is sent to any server
- ✅ No data is stored in the cloud
- ✅ No accounts or login required
- ✅ No tracking or analytics
- ✅ No third-party access to your information

All your food entries, categories, and settings are stored exclusively in your browser's local database. You have complete control and ownership of your data.

### Data Persistence

- Data persists across browser sessions
- Clearing browser cache **will delete your data** — use Export to backup before clearing
- Each browser/device maintains its own separate database
- Data is **not** shared between browsers or devices automatically

### Manual Backup & Transfer

Use the **Settings** panel (⚙️) to:
- **Export to File**: Download your data as a JSON file for safekeeping
- **Import from File**: Restore data from a previously exported file
- **Reset All Data**: Permanently delete all entries and categories

## 🚀 Getting Started

1. Open `index.html` in your web browser
2. Optionally, add the app to your home screen (Install PWA)
3. Start adding food entries:
   - Enter date/time
   - Type items (comma-separated for multiple items)
   - Click Save
4. View patterns in the **📊 Plot**, organize in **🏷️ Categories**, or analyze **🔗 Correlations**

## 📝 Usage Guide

### Adding Entries
- Entries can contain multiple comma-separated items (e.g., "apple, banana, yogurt")
- Items are normalized for consistent searching (accents are ignored)
- Each comma-separated value becomes a separate tracked item

### Categories
- Create custom categories to group items together
- Assign items to categories for better organization
- Categories appear in the scatter plot as color-coded regions

### Scatter Plot
- **X-axis**: Days relative to first entry
- **Y-axis**: Hours of the day (0-24)
- **Rectangles**: Each entry shown as a colored box
- **Controls**:
  - Zoom/Pan: Scroll wheel or pinch gesture
  - Toggle visibility: Click legend item
  - Rectangle click: Enable "DB Search" toggle to click rectangles
  - Switch views: Toggle between Items and Categories

### Data Table
- Search entries by text (accent-insensitive)
- Edit or delete individual entries
- Identify improveable items (compound entries that could be split)

### Correlation Analysis
- Identify which items appear together or around specific items
- Configure lookback timeframe (1-720 hours)
- Adjust correlation weights to find patterns relevant to you

## 🛠️ Technical Details

### Architecture
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Storage**: IndexedDB (browser's local database)
- **Visualization**: Chart.js with custom plugins
- **Platform**: Progressive Web App (works offline, installable)

### Browser Requirements
- Modern browser with IndexedDB support (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- ~5-10 MB local storage (sufficient for thousands of entries)

### Object Stores
- `raw`: Stores food entries (time, comma-separated text)
- `categories`: Stores category definitions (name, color, assigned items)

## 📖 Keyboard & Touch

- **Mobile**: Full touch support including swipe, pinch-to-zoom
- **Desktop**: Keyboard input, mouse scroll, right-click context menus
- **Install**: "Add to Home Screen" on mobile browsers to install as PWA

## 🔄 Import/Export Format

### Export Structure
```json
{
  "entries": [
    { "time": "2025-01-08T14:30:00", "text": "apple, banana" }
  ],
  "categories": [
    { "name": "Breakfast", "color": "#FF6B6B", "items": ["Apple", "Banana"] }
  ]
}
```

## 📱 Progressive Web App (PWA)

This app can be installed on your device:

- **Desktop (Chrome/Edge)**: Click the install icon in the address bar
- **Mobile (iOS)**: Safari → Share → Add to Home Screen
- **Mobile (Android)**: Chrome → Menu → Install app

Once installed, the app:
- Runs fullscreen without address bar
- Works completely offline
- Receives app updates automatically
- Can be added to home screen

## 🐛 Troubleshooting

### Data disappeared after clearing browser cache
- Your browser cache includes IndexedDB storage
- Always export your data before clearing cache
- Restore from a previously exported JSON file using Import

### Data not syncing between devices
- This app stores data **locally only**
- To transfer data: Export on device A, Import on device B
- Cloud sync is not supported by design (privacy-first approach)

### "Not enough storage" error
- IndexedDB quota varies by browser (~50MB on most browsers)
- Export and delete old entries to free up space
- Contact browser support to increase quota

## 📄 License

See [LICENSE](LICENSE) file for details.

---

**Your data is yours.** Food Logger is designed with privacy as the primary principle. No data leaves your device unless you choose to export it.
