// Global state for categories
let categories = []; // cached categories
let showCategoriesInPlot = false; // toggle between food and category view

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
      updateFoodCheckboxes(cat.foods || []);
      modal.style.display = 'flex';
    });
  } else {
    // New category mode
    delete form.dataset.categoryKey;
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryColor').value = '#FF6B6B';
    updateFoodCheckboxes([]);
    modal.style.display = 'flex';
  }
}

function updateFoodCheckboxes(assignedFoods = []) {
  console.log('[updateFoodCheckboxes] called with foods:', assignedFoods);
  
  const container = document.getElementById('categoryFoodsCheckboxes');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Get unique food names from processedTable
  const uniqueFoods = [...new Set(processedTable.map(e => e.text))].sort();
  
  uniqueFoods.forEach(food => {
    const label = document.createElement('label');
    label.className = 'food-checkbox';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = food;
    checkbox.checked = assignedFoods.includes(food);
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(food));
    container.appendChild(label);
  });
}

function saveCategoryForm() {
  console.log('[saveCategoryForm] called');
  
  const name = document.getElementById('categoryName').value.trim();
  const color = document.getElementById('categoryColor').value;
  
  if (!name) {
    alert('Category name is required');
    return;
  }
  
  // Get selected foods
  const foods = Array.from(document.querySelectorAll('#categoryFoodsCheckboxes input[type="checkbox"]:checked'))
    .map(cb => cb.value);
  
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
  
  updateCategoriesList();
}