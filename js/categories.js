// Global state for categories
let categories = []; // cached categories
let showCategoriesInPlot = false; // toggle between item and category view

// Tracks checked items in the modal across filtering
let categoryModalSelectedItems = new Set();

// Helper to normalize text for accent-insensitive search
function normalizeText(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Set the color visual for the color input
function setCategoryColorVisual(color) {
  const input = document.getElementById('categoryColor');
  if (input) {
    input.style.background = color;
    // Set contrasting foreground color for readability
    try {
      const c = (color || '#000').replace('#', '');
      const r = parseInt(c.substr(0,2), 16);
      const g = parseInt(c.substr(2,2), 16);
      const b = parseInt(c.substr(4,2), 16);
      const lum = 0.2126*r + 0.7152*g + 0.0722*b;
      input.style.color = lum < 128 ? '#ffffff' : '#000000';
    } catch (err) {
      input.style.color = '#000000';
    }
  }
}

// --- Compact color utilities for suggestions ---
// Return hue (0-360) for a hex color string like '#RRGGBB', or null on failure
function hexToHue(hex) {
  if (!hex) return null;
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  const r = parseInt(h.substr(0,2), 16) / 255;
  const g = parseInt(h.substr(2,2), 16) / 255;
  const b = parseInt(h.substr(4,2), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0; // achromatic
  const d = max - min;
  let hue;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = ((b - r) / d) + 2;
  else hue = ((r - g) / d) + 4;
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;
  return hue;
}

// Convert HSL to hex (kept small and self-contained)
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1);
  const r = Math.round(255 * f(0));
  const g = Math.round(255 * f(8));
  const b = Math.round(255 * f(4));
  const toHex = v => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function suggestCategoryColor() {
  // Avoid colors that are too close in hue to existing categories
  const used = categories.map(c => hexToHue(c.color)).filter(h => h !== null && !isNaN(h));
  const golden = 137.508; // golden angle for pleasing distribution
  for (let i = 0; i < 36; i++) {
    const hue = (i * golden) % 360;
    let ok = true;
    for (const uh of used) {
      const d = Math.abs(hue - uh);
      const dd = Math.min(d, 360 - d);
      if (dd < 25) { ok = false; break; } // too close
    }
    if (ok) return hslToHex(Math.round(hue), 70, 55);
  }
  // fallback
  const fallbackHue = (categories.length * 47) % 360;
  return hslToHex(fallbackHue, 70, 55);
}

function updateCategoriesList() {
  console.log('[updateCategoriesList] called');
  getAllCategories(cats => {
    categories = cats || [];
    console.log('[updateCategoriesList] loaded', categories.length, 'categories');
    
    // Update categories list UI
    const container = document.getElementById('categoriesList');
    if (container) {
      container.innerHTML = '';
      categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'category-item';
        div.innerHTML = `
          <div class="category-color-box" style="background-color: ${cat.color}"></div>
          <div class="category-info">
            <div class="category-name">${cat.name}</div>
            <div class="category-items">${(cat.items || []).join(', ') || 'No items assigned'}</div>
          </div>
          <button class="action-btn" onclick="editCategory(${cat.key})" title="Edit">✏️</button>
          <button class="action-btn" onclick="deleteCategory(${cat.key}); updateCategoriesList(); refresh();" title="Delete">🗑️</button>
        `;
        container.appendChild(div);
      });
    }
  });
}

function showCategoryModal(categoryKey = null) {
  console.log('[showCategoryModal] called with key', categoryKey);
  
  // Create modal
  const modal = document.getElementById('categoryModal');
  const form = document.getElementById('categoryForm');
  
  if (categoryKey !== null) {
    // Edit mode
    getCategory(categoryKey, cat => {
      if (!cat) return;
      form.dataset.categoryKey = categoryKey;
      document.getElementById('categoryName').value = cat.name;
      document.getElementById('categoryColor').value = cat.color;
      // Initialize selected items set so selections persist across filters
      categoryModalSelectedItems = new Set((cat.items || []));
      // Clear search and populate checkboxes
      const search = document.getElementById('categoryItemSearch');
      if (search) search.value = '';
      updateItemCheckboxes(Array.from(categoryModalSelectedItems), '');

      // Update color visual (input background + small preview)
      setCategoryColorVisual(cat.color);

      modal.style.display = 'flex';
    });
  } else {
    // New category mode
    delete form.dataset.categoryKey;
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryColor').value = '#FF6B6B';
    // Reset selected items
    categoryModalSelectedItems = new Set();
    const search = document.getElementById('categoryItemSearch');
    if (search) search.value = '';
    updateItemCheckboxes([], '');

    // Suggest a color that doesn't clash with existing categories
    const suggested = suggestCategoryColor();
    setCategoryColorVisual(suggested);
    document.getElementById('categoryColor').value = suggested;

    modal.style.display = 'flex';
  }
}

function updateItemCheckboxes(assignedItems = [], filter = '') {
  console.log('[updateItemCheckboxes] called with items:', assignedItems, 'filter:', filter);
  
  const container = document.getElementById('categoryItemsCheckboxes');
  if (!container) return;
  
  // If a caller supplied assignedItems, seed the selection set
  if (assignedItems && assignedItems.length) {
    categoryModalSelectedItems = new Set(assignedItems);
  }

  container.innerHTML = '';
  
  // Get unique item names from processedTable
  let uniqueItems = [...new Set(processedTable.map(e => e.text))].sort();

  // Apply filter using NFD normalization
  const filterNorm = normalizeText(filter);
  if (filterNorm) {
    uniqueItems = uniqueItems.filter(f => normalizeText(f).includes(filterNorm));
  }
  
  uniqueItems.forEach(item => {
    const label = document.createElement('label');
    label.className = 'item-checkbox';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = item;
    checkbox.checked = categoryModalSelectedItems.has(item);

    // Update the selection set when user toggles a checkbox so selection persists
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) categoryModalSelectedItems.add(item);
      else categoryModalSelectedItems.delete(item);
    });
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(item));
    container.appendChild(label);
  });
}

function filterCategoryItems() {
  const filter = document.getElementById('categoryItemSearch') ? document.getElementById('categoryItemSearch').value : '';
  // Preserve currently selected items so checks are not lost when filtering
  const checked = Array.from(document.querySelectorAll('#categoryItemsCheckboxes input[type="checkbox"]:checked')).map(cb=>cb.value);
  updateItemCheckboxes(checked, filter);
}

function saveCategoryForm() {
  console.log('[saveCategoryForm] called');
  
  const name = document.getElementById('categoryName').value.trim();
  const color = document.getElementById('categoryColor').value;
  
  if (!name) {
    alert('Category name is required');
    return;
  }
  
  // Get selected items (persisted across filtering)
  const items = Array.from(categoryModalSelectedItems);
  
  const categoryKey = document.getElementById('categoryForm').dataset.categoryKey;
  const category = { name, color, items };
  
  if (categoryKey) {
    // Update existing
    updateCategory(parseInt(categoryKey), category);
  } else {
    // Add new
    addCategory(category);
  }
  
  closeCategoryModal();
  updateCategoriesList();
  refresh();
}

function closeCategoryModal() {
  console.log('[closeCategoryModal] called');
  const modal = document.getElementById('categoryModal');
  modal.style.display = 'none';
}

function editCategory(key) {
  console.log('[editCategory] called with key', key);
  showCategoryModal(key);
}

function togglePlotView(viewType) {
  console.log('[togglePlotView] called with viewType', viewType);
  
  if (viewType === 'items') {
    showCategoriesInPlot = false;
    document.getElementById('btnViewItems').classList.add('active');
    document.getElementById('btnViewCategories').classList.remove('active');
  } else if (viewType === 'categories') {
    showCategoriesInPlot = true;
    document.getElementById('btnViewItems').classList.remove('active');
    document.getElementById('btnViewCategories').classList.add('active');
  }
  
  refresh();
}

// Initialize when page loads
function initCategories() {
  console.log('[initCategories] called');
  
  // Close modal on background click
  const modal = document.getElementById('categoryModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeCategoryModal();
    });
  }

  // Set up color display: make the color input show its color as full background
  const colorInput = document.getElementById('categoryColor');
  if (colorInput) {
    setCategoryColorVisual(colorInput.value);
    colorInput.addEventListener('input', (e) => {
      setCategoryColorVisual(e.target.value);
    });
  }

  // Ensure search input calls the filter function (also set by inline handler)
  const searchInput = document.getElementById('categoryItemSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => filterCategoryItems());
  }
  
  updateCategoriesList();
}