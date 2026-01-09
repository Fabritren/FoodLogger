// Global state for categories
let categories = []; // cached categories
let showCategoriesInPlot = false; // toggle between food and category view

// Tracks checked foods in the modal across filtering
let categoryModalSelectedFoods = new Set();

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
            <div class="category-foods">${(cat.foods || []).join(', ') || 'No foods assigned'}</div>
          </div>
          <button onclick="editCategory(${cat.key})" title="Edit">✏️</button>
          <button onclick="deleteCategory(${cat.key}); updateCategoriesList(); refresh();" title="Delete">🗑️</button>
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
      // Initialize selected foods set so selections persist across filters
      categoryModalSelectedFoods = new Set((cat.foods || []));
      // Clear search and populate checkboxes
      const search = document.getElementById('categoryFoodSearch');
      if (search) search.value = '';
      updateFoodCheckboxes(Array.from(categoryModalSelectedFoods), '');

      // Update color visual (input background + small preview)
      setCategoryColorVisual(cat.color);

      modal.style.display = 'flex';
    });
  } else {
    // New category mode
    delete form.dataset.categoryKey;
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryColor').value = '#FF6B6B';
    // Reset selected foods
    categoryModalSelectedFoods = new Set();
    const search = document.getElementById('categoryFoodSearch');
    if (search) search.value = '';
    updateFoodCheckboxes([], '');

    // Update color visual (input background + small preview)
    setCategoryColorVisual('#FF6B6B');

    modal.style.display = 'flex';
  }
}

function updateFoodCheckboxes(assignedFoods = [], filter = '') {
  console.log('[updateFoodCheckboxes] called with foods:', assignedFoods, 'filter:', filter);
  
  const container = document.getElementById('categoryFoodsCheckboxes');
  if (!container) return;
  
  // If a caller supplied assignedFoods, seed the selection set
  if (assignedFoods && assignedFoods.length) {
    categoryModalSelectedFoods = new Set(assignedFoods);
  }

  container.innerHTML = '';
  
  // Get unique food names from processedTable
  let uniqueFoods = [...new Set(processedTable.map(e => e.text))].sort();

  // Apply filter using NFD normalization
  const filterNorm = normalizeText(filter);
  if (filterNorm) {
    uniqueFoods = uniqueFoods.filter(f => normalizeText(f).includes(filterNorm));
  }
  
  uniqueFoods.forEach(food => {
    const label = document.createElement('label');
    label.className = 'food-checkbox';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = food;
    checkbox.checked = categoryModalSelectedFoods.has(food);

    // Update the selection set when user toggles a checkbox so selection persists
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) categoryModalSelectedFoods.add(food);
      else categoryModalSelectedFoods.delete(food);
    });
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(food));
    container.appendChild(label);
  });
}

function filterCategoryFoods() {
  const filter = document.getElementById('categoryFoodSearch') ? document.getElementById('categoryFoodSearch').value : '';
  // Preserve currently selected foods so checks are not lost when filtering
  const checked = Array.from(document.querySelectorAll('#categoryFoodsCheckboxes input[type="checkbox"]:checked')).map(cb=>cb.value);
  updateFoodCheckboxes(checked, filter);
}

function saveCategoryForm() {
  console.log('[saveCategoryForm] called');
  
  const name = document.getElementById('categoryName').value.trim();
  const color = document.getElementById('categoryColor').value;
  
  if (!name) {
    alert('Category name is required');
    return;
  }
  
  // Get selected foods (persisted across filtering)
  const foods = Array.from(categoryModalSelectedFoods);
  
  const categoryKey = document.getElementById('categoryForm').dataset.categoryKey;
  const category = { name, color, foods };
  
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
  
  if (viewType === 'foods') {
    showCategoriesInPlot = false;
    document.getElementById('btnViewFoods').classList.add('active');
    document.getElementById('btnViewCategories').classList.remove('active');
  } else if (viewType === 'categories') {
    showCategoriesInPlot = true;
    document.getElementById('btnViewFoods').classList.remove('active');
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
  const searchInput = document.getElementById('categoryFoodSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => filterCategoryFoods());
  }
  
  updateCategoriesList();
}