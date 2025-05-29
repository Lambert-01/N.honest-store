// Global Variables
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentPage = 1;
const productsPerPage = 15; // 5 rows of 3 products each
let totalProducts = 0;
let currentCategory = '';
let currentSort = '';
let currentSearchTerm = '';

// DOM Elements
const productsContainer = document.getElementById('products-container');
const loadingProducts = document.getElementById('loading-products');
const emptyProducts = document.getElementById('empty-products');
const paginationContainer = document.getElementById('pagination-container');
const cartCountBadge = document.getElementById('cart-count');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartSummary = document.getElementById('cart-summary');
const emptyCartMessage = document.getElementById('empty-cart-message');
const cartSubtotal = document.getElementById('cart-subtotal');
const cartTax = document.getElementById('cart-tax');
const cartTotal = document.getElementById('cart-total');
const toastContainer = document.getElementById('toast-container');

// Global variables
let products = [];
let filteredProducts = [];
let currentProducts = [];

// DOM Content Loaded  
document.addEventListener('DOMContentLoaded', async () => {
  console.log("DOM Content Loaded - Initializing cart");
  
  // Initialize cart from localStorage first
  cart = JSON.parse(localStorage.getItem('cart')) || [];
  
  // Initialize cart count
  updateCartCount();
  // Initialize Swiper for category carousel
  initCategoryCarousel();
  // Remove preloader
  removePreloader();
  // Load categories from the database
  await loadCategories();
  // Set up all event listeners
  setupEventListeners();
  // Load initial products
  await loadProducts();
  // Initialize checkout process
  setupCheckoutProcess();
  // Update cart display
  updateCartDisplay();
  // Setup cart specific event listeners
  setupCartEventListeners();
  // Initialize profile UI
  initProfileUI();
  // Other initializations...
});

/**
 * Initialize profile popup if user is logged in
 */
function updateProfileUI() {
  // Get profile elements
  const profileImage = document.getElementById('profileImage');
  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  const profileMenu = document.getElementById('profileMenu');
  const ordersMenu = document.getElementById('ordersMenu');
  const wishlistMenu = document.getElementById('wishlistMenu');
  const addressesMenu = document.getElementById('addressesMenu');
  const logoutMenu = document.getElementById('logoutMenu');

  // Check if user is logged in
  const customerToken = localStorage.getItem('customerToken');
  const customerDataStr = localStorage.getItem('customer');
  
  if (customerToken && customerDataStr) {
    try {
      const customerData = JSON.parse(customerDataStr);
      
      // Update profile information
      profileImage.src = customerData.picture || customerData.profilePicture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(customerData.firstName + ' ' + customerData.lastName);
      profileName.textContent = `${customerData.firstName} ${customerData.lastName}`;
      profileEmail.textContent = customerData.email;
      
      // Show logged-in menu items and hide login button
      profileMenu.style.display = 'none';
      ordersMenu.style.display = 'block';
      wishlistMenu.style.display = 'block';
      addressesMenu.style.display = 'block';
      logoutMenu.style.display = 'block';
      
      // Add event listener to logout button
      document.querySelector('#logoutMenu a').addEventListener('click', function(e) {
        e.preventDefault();
        handleLogout();
      });
      
    } catch (error) {
      console.error('Error updating profile UI:', error);
    }
  } else {
    // Show login button and hide logged-in menu items
    profileImage.src = 'https://ui-avatars.com/api/?name=Guest';
    profileName.textContent = 'Guest';
    profileEmail.textContent = 'Not logged in';
    profileMenu.style.display = 'block';
    ordersMenu.style.display = 'none';
    wishlistMenu.style.display = 'none';
    addressesMenu.style.display = 'none';
    logoutMenu.style.display = 'none';
  }
}

function handleLogout() {
  // Clear authentication data
  localStorage.removeItem('customerToken');
  localStorage.removeItem('customer');
  
  // Update profile UI
  updateProfileUI();
  
  // Redirect to home or login page
  window.location.href = '/';
}

// Call updateProfileUI when the page loads
window.addEventListener('load', updateProfileUI);

// Add event listener to profile dropdown
const profileDropdown = document.getElementById('profileDropdown');
if (profileDropdown) {
  profileDropdown.addEventListener('click', function() {
    // Update profile UI when dropdown is opened
    updateProfileUI();
  });
}

// Initialize profile UI when DOM is loaded
function initProfileUI() {
  // Update profile UI immediately
  updateProfileUI();
  
  // Watch for changes in localStorage
  window.addEventListener('storage', function(e) {
    if (e.key === 'customerToken' || e.key === 'customer') {
      updateProfileUI();
    }
  });
}

// Initialize Category Carousel
function initCategoryCarousel() {
  const categorySwiper = new Swiper('.category-carousel', {
    slidesPerView: 4,
    spaceBetween: 16,
    navigation: {
      nextEl: '.category-carousel-next',
      prevEl: '.category-carousel-prev',
    },
    breakpoints: {
      320: { slidesPerView: 1 },
      768: { slidesPerView: 2 },
      992: { slidesPerView: 3 },
      1200: { slidesPerView: 4 },
    },
  });
}

// Remove Preloader
function removePreloader() {
  const preloader = document.querySelector('.preloader-wrapper');
  if (preloader) {
    preloader.style.display = 'none';
  }
}

// Set Up Event Listeners
function setupEventListeners() {
  // Event delegation for product container
  document.getElementById('products-container').addEventListener('click', function(e) {
    const target = e.target;
    
    // Handle add to cart button
    if (target.classList.contains('add-to-cart-btn') || target.closest('.add-to-cart-btn')) {
      e.preventDefault();
      const button = target.classList.contains('add-to-cart-btn') ? target : target.closest('.add-to-cart-btn');
      const productId = button.dataset.productId;
      const productCard = button.closest('.product-card');
      const quantityInput = productCard.querySelector('.product-quantity');
      
      const quantity = parseInt(quantityInput ? quantityInput.value : 1);
      
      // Find the product in our loaded products array
      const product = currentProducts.find(p => p._id === productId || p.id === productId);
      if (product) {
        addToCart(product, null, quantity);
        
        // Show a brief animation on the button
        button.classList.add('btn-success');
        button.innerHTML = '<i class="fas fa-check me-1"></i> Added';
        
        setTimeout(() => {
          button.classList.remove('btn-success');
          button.innerHTML = '<i class="fas fa-shopping-cart me-1"></i> Add to Cart';
        }, 1500);
      }
    }
    
    // Handle quantity decrease button
    if (target.classList.contains('btn-quantity') && target.dataset.action === 'decrease') {
      const quantityInput = target.nextElementSibling;
      let quantity = parseInt(quantityInput.value);
      if (quantity > 1) {
        quantityInput.value = --quantity;
      }
    }
    
    // Handle quantity increase button
    if (target.classList.contains('btn-quantity') && target.dataset.action === 'increase') {
      const quantityInput = target.previousElementSibling;
      let quantity = parseInt(quantityInput.value);
      const max = parseInt(quantityInput.max);
      if (quantity < max) {
        quantityInput.value = ++quantity;
      }
    }
    
    // Handle wishlist button
    if (target.classList.contains('wishlist-btn') || target.closest('.wishlist-btn')) {
      e.preventDefault();
      const button = target.classList.contains('wishlist-btn') ? target : target.closest('.wishlist-btn');
      const icon = button.querySelector('i');
      
      // Toggle wishlist state
      if (icon.classList.contains('far')) {
        icon.classList.remove('far');
        icon.classList.add('fas');
        button.classList.add('active');
        showToast('Product added to wishlist!');
      } else {
        icon.classList.remove('fas');
        icon.classList.add('far');
        button.classList.remove('active');
        showToast('Product removed from wishlist!');
      }
    }
    
    // Handle product link for quick view
    if (target.classList.contains('product-link') || target.closest('.product-link')) {
      e.preventDefault();
      const link = target.classList.contains('product-link') ? target : target.closest('.product-link');
      const productId = link.dataset.productId;
      
      // Find the product in our loaded products array
      const product = currentProducts.find(p => p._id === productId || p.id === productId);
      if (product) {
        showQuickView(product);
      }
    }
  });
  
  // Use event delegation for category filters since they're dynamically loaded
  document.addEventListener('click', function(e) {
    // Handle category clicks from any source (sidebar, dropdown, carousel)
    if (e.target.closest('[data-category]')) {
      e.preventDefault();
      const categoryLink = e.target.closest('[data-category]');
      handleCategoryClick.call(categoryLink, e);
      
      // Close offcanvas/dropdown if open
      const offcanvas = document.getElementById('offcanvasNavbar');
      if (offcanvas) {
        const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvas);
        if (bsOffcanvas) bsOffcanvas.hide();
      }
      
      // Close dropdown if open
      const dropdown = document.querySelector('.dropdown.show');
      if (dropdown) {
        const bsDropdown = bootstrap.Dropdown.getInstance(dropdown);
        if (bsDropdown) bsDropdown.hide();
      }
    }
  });
  
  // Sort options
  document.querySelectorAll('.sort-option').forEach(option => {
    option.addEventListener('click', handleSortClick);
  });
  
  // Search functionality
  setupSearch();
  
  // Reset filters
  document.getElementById('reset-filters')?.addEventListener('click', resetFilters);
  
  // Pagination
  document.addEventListener('click', handlePaginationClick);
  
  // Cart functionality
  document.addEventListener('click', handleCartClick);
  
  // Category filter in search bar
  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', function() {
      currentCategory = this.value;
      currentPage = 1;
      loadProducts();
    });
  }
  
  // Add event listener for clear cart button
  const clearCartBtn = document.getElementById('clear-cart');
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', function() {
      clearCart();
    });
  }
  
  // Add event listener for proceed to checkout button
  const proceedToCheckoutBtn = document.getElementById('proceed-to-checkout');
  if (proceedToCheckoutBtn) {
    proceedToCheckoutBtn.addEventListener('click', function() {
      updateCheckoutModal();
    });
  }
}

// Handle Category Click
async function handleCategoryClick(e) {
  // Prevent default link behavior
  e.preventDefault();
  e.stopPropagation(); // Stop event propagation to prevent multiple handlers
  
  // Get category ID from data attribute
  const clickedCategory = this.getAttribute('data-category');
  console.log(`Category click detected on: ${clickedCategory}`);
  
  // Set the current category (no toggling behavior)
  currentCategory = clickedCategory;
  console.log(`Set current category to: ${currentCategory}`);
  
  // Reset to first page
  currentPage = 1;
  
  // Update UI to show active category - first remove all active classes
  document.querySelectorAll('[data-category]').forEach(el => {
    el.classList.remove('active');
    
    // Also remove any active classes from parent elements
    const parentListItem = el.closest('li');
    if (parentListItem) {
      parentListItem.classList.remove('active');
    }
  });
  
  // Add active class to all elements with matching category ID
  if (currentCategory) {
    document.querySelectorAll(`[data-category="${currentCategory}"]`).forEach(el => {
      el.classList.add('active');
      console.log(`Added 'active' class to element:`, el);
    });
  }
  
  // Update dropdown text
  const dropdownButton = document.getElementById('categoryDropdown');
  if (dropdownButton) {
    if (currentCategory) {
      const categoryName = getCategoryNameById(currentCategory);
      dropdownButton.innerHTML = `<i class="fas fa-filter me-2"></i>${categoryName}`;
      console.log(`Updated dropdown button text to: ${categoryName}`);
    } else {
      dropdownButton.innerHTML = `<i class="fas fa-filter me-2"></i>Categories`;
      console.log('Reset dropdown button text to: Categories');
    }
  }
  
  // Update category filter in search bar if it exists
  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.value = currentCategory;
    console.log(`Updated category filter dropdown value to: ${currentCategory}`);
  }
  
  // Load products with the selected category
  console.log(`Loading products with category ID: ${currentCategory}`);
  await loadProducts();
  
  // Show feedback toast
  if (currentCategory) {
    const categoryName = getCategoryNameById(currentCategory);
    showToast(`Showing ${categoryName} products`);
  } else {
    showToast('Showing all products');
  }
  
  // Scroll to products section
  document.getElementById('products-section').scrollIntoView({ behavior: 'smooth' });
}

// Handle Sort Click
async function handleSortClick(e) {
  e.preventDefault();
  currentSort = this.getAttribute('data-sort');
  currentPage = 1;
  await loadProducts();
}

// Setup Search Functionality
function setupSearch() {
  const searchButton = document.getElementById('search-button');
  const searchInput = document.getElementById('search-input');
  if (searchButton && searchInput) {
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
  }
}

// Handle Search
async function handleSearch() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;
  
  currentSearchTerm = searchInput.value.trim();
  console.log(`Searching for: "${currentSearchTerm}"`);
  
  // Reset to first page
  currentPage = 1;
  
  // Load products with search term
  await loadProducts();
  
  // Scroll to products section
  document.getElementById('products-section').scrollIntoView({ behavior: 'smooth' });
  
  // Show feedback toast if search term is provided
  if (currentSearchTerm) {
    showToast(`Search results for "${currentSearchTerm}"`);
  }
}

// Reset Filters
async function resetFilters() {
  // Reset all filter variables
  currentCategory = '';
  currentSort = '';
  currentSearchTerm = '';
  currentPage = 1;
  
  // Reset search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = '';
  }
  
  // Reset category filter in search bar
  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.value = '';
  }
  
  // Reset category classes in all navigation
  document.querySelectorAll('[data-category]').forEach(el => {
    el.classList.remove('active');
    
    // Also remove active class from parent elements
    const parentListItem = el.closest('li');
    if (parentListItem) {
      parentListItem.classList.remove('active');
    }
  });
  
  // Reset category dropdown text
  const categoryDropdown = document.getElementById('categoryDropdown');
  if (categoryDropdown) {
    categoryDropdown.innerHTML = '<i class="fas fa-filter me-2"></i>Categories';
  }
  
  // Load products with reset filters
  await loadProducts();
  
  // Show confirmation toast
  showToast('All filters have been reset');
}

// Add event listener for clear all filters button
document.addEventListener('DOMContentLoaded', () => {
  const clearAllFiltersButton = document.getElementById('clear-all-filters');
  if (clearAllFiltersButton) {
    clearAllFiltersButton.addEventListener('click', resetFilters);
  }
});

// Handle Pagination Click
async function handlePaginationClick(e) {
  const target = e.target.closest('.page-link');
  if (!target) return;
  
    e.preventDefault();
  
  const pageValue = target.getAttribute('data-page');
  if (!pageValue) return;
  
  const newPage = parseInt(pageValue);
  
  // Don't reload if clicking on the current page
  if (newPage === currentPage) return;
  
  // Don't proceed if the link is disabled
  if (target.parentElement.classList.contains('disabled')) return;
  
  currentPage = newPage;
  
      await loadProducts();
  
  // Scroll to products section with a slight offset to show the top of products
  const productsSection = document.getElementById('products-section');
  if (productsSection) {
    const yOffset = -100; // 100px offset from the top
    const y = productsSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
}

// Handle Cart Click
function handleCartClick(e) {
  if (e.target.matches('.add-to-cart')) {
    const productId = e.target.getAttribute('data-product-id');
    const productName = e.target.getAttribute('data-product-name');
    const productPrice = parseFloat(e.target.getAttribute('data-product-price'));
    const productImg = e.target.getAttribute('data-product-img');
    addToCart({
      id: productId,
      name: productName,
      price: productPrice,
      image: productImg,
      quantity: 1
    });
    showToast(`${productName} added to cart`);
  }
}

// Load Products from API
async function loadProducts() {
  try {
    console.log('=== LOADING PRODUCTS ===');
    toggleProductStates(false, false, true);
    
    // Build the API URL with query parameters for filtering
    let apiUrl = '/api/products';
    
    // Add query parameters array
    const queryParams = [];
    
    // If a category is selected, use the category-specific endpoint
    if (currentCategory) {
      console.log(`Category filter active with ID: "${currentCategory}"`);
      apiUrl = `/api/products/category/${currentCategory}`;
      console.log(`Using category-specific endpoint: ${apiUrl}`);
      
      // Add pagination to category endpoint
      queryParams.push(`page=${currentPage}`);
      queryParams.push(`limit=${productsPerPage}`);
      
      // Add sort option if selected
      if (currentSort) {
        queryParams.push(`sort=${currentSort}`);
      }
    } else {
      console.log('No category filter active, showing all products');
      // Add search term if provided
      if (currentSearchTerm) {
        queryParams.push(`search=${encodeURIComponent(currentSearchTerm)}`);
      }
      
      // Add sort option if selected
      if (currentSort) {
        queryParams.push(`sort=${currentSort}`);
      }
      
      // Add pagination
      queryParams.push(`page=${currentPage}`);
      queryParams.push(`limit=${productsPerPage}`);
    }
    
    // Append query parameters to URL if there are any
    if (queryParams.length > 0) {
      apiUrl += (apiUrl.includes('?') ? '&' : '?') + queryParams.join('&');
    }
    
    console.log('Final API URL:', apiUrl);
    
    console.log('Sending fetch request...');
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`API request failed with status: ${response.status} ${response.statusText}`);
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('API Response received:', data);
    
    // If the API returns a structured response with products and metadata
    let products = Array.isArray(data) ? data : (data.products || []);
    totalProducts = data.total || products.length;
    
    console.log(`Successfully loaded ${products.length} products`);
    
    // Debug product data to see if categories are properly included
    if (products.length > 0) {
      console.log('Sample product data:');
      const sampleProduct = products[0];
      console.log('- Product name:', sampleProduct.name);
      console.log('- Product category:', sampleProduct.category ? 
        `${sampleProduct.category.name} (${sampleProduct.category._id})` : 'No category');
      console.log('- Product price:', sampleProduct.price);
      console.log('- Other properties:', Object.keys(sampleProduct).join(', '));
    }
    
    // Store products globally so we can access them in event handlers
    currentProducts = products;
    
    if (products.length === 0) {
      console.log('No products found matching criteria');
      toggleProductStates(false, true, false);
      document.getElementById('empty-products').innerHTML = `
        <div class="col-12 text-center py-5 bg-white rounded-4 shadow-sm">
          <div class="empty-state-icon mb-4">
            <i class="fas fa-search fa-4x text-muted"></i>
          </div>
          <h5>No Products Found</h5>
          <p class="text-muted">We couldn't find any products that match your criteria.</p>
          <button class="btn btn-primary mt-3" id="clear-all-filters" onclick="resetFilters()">
            <i class="fas fa-filter-circle-xmark me-2"></i>Clear All Filters
          </button>
        </div>
      `;
      return;
    }
    
    // Display products and update pagination
    console.log('Displaying products and updating pagination');
    displayProducts(products);
    generatePagination(totalProducts);
    
    // Update active filters display
    updateActiveFilters();
    console.log('=== PRODUCTS LOADED SUCCESSFULLY ===');
    
  } catch (error) {
    console.error('=== ERROR LOADING PRODUCTS ===');
    console.error('Error details:', error);
    toggleProductStates(false, true, false);
    
    // Show error message to the user
    const emptyProductsElement = document.getElementById('empty-products');
    if (emptyProductsElement) {
      emptyProductsElement.innerHTML = `
        <div class="col-12 text-center py-5 bg-white rounded-4 shadow-sm">
          <div class="empty-state-icon mb-4">
            <i class="fas fa-exclamation-triangle fa-4x text-warning"></i>
          </div>
          <h5>Error Loading Products</h5>
          <p class="text-muted">${error.message}</p>
          <button class="btn btn-primary mt-3" id="retry-load-products">
            <i class="fas fa-sync-alt me-2"></i>Retry
          </button>
        </div>
      `;
      
      // Add event listener to retry button
      const retryButton = document.getElementById('retry-load-products');
      if (retryButton) {
        retryButton.addEventListener('click', loadProducts);
      }
    }
  }
}

// Toggle Product States
function toggleProductStates(showProducts, showEmpty, showLoading) {
  const productsContainer = document.getElementById('products-container');
  const emptyProductsElement = document.getElementById('empty-products');
  const productsLoadingElement = document.getElementById('loading-products');
  
  // Show or hide products
  if (productsContainer) {
    productsContainer.style.display = showProducts ? 'flex' : 'none';
  }
  
  // Show or hide empty products message
  if (emptyProductsElement) {
    emptyProductsElement.style.display = showEmpty ? 'block' : 'none';
  }
  
  // Show or hide loading indicator
  if (productsLoadingElement) {
    productsLoadingElement.style.display = showLoading ? 'block' : 'none';
  }
}

// Display Products
function displayProducts(products) {
  const productsContainer = document.getElementById('products-container');
  
  // Clear the container first
  productsContainer.innerHTML = '';
  
  // Add each product to the container
  if (products.length === 0) {
    toggleProductStates(false, true, false);
  } else {
  products.forEach(product => {
      // Convert the HTML string to a DOM element before appending
      const productHTML = createProductCard(product);
      productsContainer.innerHTML += productHTML;
    });
    
    // Add event listeners to buttons after adding products to DOM
    setupProductEventListeners();
    
    toggleProductStates(true, false, false);
  }
}

// Create Product Card
function createProductCard(product) {
  // Create discount tag HTML if there's a discount
  const discountHTML = calculateDiscountHTML(product);
  
  // Stock status label
  const stockStatus = getStockStatus(product.stock);
  
  // Default image if product image is missing
  const productImage = product.image || product.featuredImage || 'images/placeholder.png';
  
  // Determine if item is out of stock
  const isOutOfStock = (product.stock <= 0);
  
  return `
    <div class="col-lg-4 col-md-6 col-sm-12 mb-4">
      <div class="product-card h-100 position-relative overflow-hidden shadow-sm rounded-4 border">
        ${discountHTML}
        <div class="position-absolute top-0 end-0 p-2">
          <button class="btn btn-sm btn-light rounded-circle shadow-sm wishlist-btn" data-product-id="${product._id}">
            <i class="far fa-heart"></i>
          </button>
        </div>

        <div class="product-img text-center p-4">
          <a href="#" class="product-link" data-product-id="${product._id}">
            <img src="${productImage}" alt="${product.name}" class="img-fluid product-thumbnail" style="height: 180px; object-fit: contain;">
          </a>
        </div>
        
        <div class="product-details p-3">
          <div class="product-category small text-muted mb-1">${product.category ? product.category.name : 'Uncategorized'}</div>
          <h3 class="product-title fs-6 mb-1 text-truncate">
            <a href="#" class="text-dark product-link" data-product-id="${product._id}">${product.name}</a>
          </h3>
          
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="product-price">
              <span class="fw-bold fs-5">RWF ${product.price.toLocaleString()}</span>
              ${product.originalPrice ? `<span class="text-decoration-line-through text-muted ms-2 small">RWF ${product.originalPrice.toLocaleString()}</span>` : ''}
            </div>
            ${stockStatus}
          </div>
          
          <div class="product-rating mb-2">
            <div class="stars-outer">
              <div class="stars-inner" style="width: ${(product.rating || 4) * 20}%"></div>
            </div>
            <span class="rating-count small text-muted">(${product.reviews || Math.floor(Math.random() * 50) + 5})</span>
          </div>
          
          ${product.variants && product.variants.length > 0 ? `
          <div class="product-variants mb-2">
            <div class="small text-muted mb-1">Available Options:</div>
            <div class="variants-container d-flex flex-wrap gap-1">
              ${product.variants.slice(0, 3).map(variant => `
                <span class="badge bg-light text-dark border">${variant.name}</span>
              `).join('')}
              ${product.variants.length > 3 ? `<span class="badge bg-secondary">+${product.variants.length - 3} more</span>` : ''}
            </div>
          </div>` : ''}
          
          <div class="product-actions d-flex justify-content-between align-items-center">
            <div class="quantity-selector d-flex align-items-center border rounded">
              <button class="btn btn-sm btn-quantity" data-action="decrease" ${isOutOfStock ? 'disabled' : ''}>-</button>
              <input type="number" class="form-control form-control-sm text-center border-0 product-quantity" value="1" min="1" max="${product.stock || 10}" style="width: 40px" ${isOutOfStock ? 'disabled' : ''}>
              <button class="btn btn-sm btn-quantity" data-action="increase" ${isOutOfStock ? 'disabled' : ''}>+</button>
            </div>
            <button class="btn ${isOutOfStock ? 'btn-secondary' : 'btn-primary'} btn-sm add-to-cart-btn" data-product-id="${product._id}" ${isOutOfStock ? 'disabled' : ''}>
              <i class="fas ${isOutOfStock ? 'fa-ban' : 'fa-shopping-cart'} me-1"></i> ${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Helper function to get stock status HTML
function getStockStatus(stock) {
  if (stock <= 0) {
    return `<span class="badge bg-danger">Out of Stock</span>`;
  } else if (stock <= 5) {
    return `<span class="badge bg-warning text-dark">Low Stock: ${stock}</span>`;
  } else {
    return `<span class="badge bg-success">In Stock</span>`;
  }
}

// Helper function to calculate discount HTML
function calculateDiscountHTML(product) {
  if (product.originalPrice && product.originalPrice > product.price) {
    const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    return `<div class="position-absolute top-0 start-0 p-2">
              <span class="badge bg-danger">-${discount}%</span>
            </div>`;
  }
  return '';
}

// Show Error Loading Products
function showErrorLoadingProducts(error) {
  const emptyContainer = document.getElementById('empty-products');
  if (emptyContainer) {
    emptyContainer.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="fas fa-exclamation-triangle fa-4x text-danger mb-3"></i>
        <h5>Failed to load products</h5>
        <p class="text-muted">${error.message}</p>
        <button class="btn btn-primary mt-3" onclick="window.location.reload()">
          <i class="fas fa-sync-alt me-2"></i>Try Again
        </button>
      </div>
    `;
  }
}

// Generate Pagination
function generatePagination(totalItems) {
  const paginationContainer = document.getElementById('pagination-container');
  if (!paginationContainer) return;
  
  // Calculate total pages
  const totalPages = Math.ceil(totalItems / productsPerPage);
  
  if (totalPages <= 1) {
    paginationContainer.style.display = 'none';
    return;
  }
  
  // Create pagination HTML
  let paginationHTML = `<ul class="pagination justify-content-center">`;
  
  // Previous button
  paginationHTML += `
    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
        <span aria-hidden="true">&laquo;</span>
      </a>
    </li>
  `;
  
  // Determine which page numbers to show
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  
  // Adjust start page if we're near the end
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }
  
  // First page link if not in range
  if (startPage > 1) {
    paginationHTML += `
      <li class="page-item">
        <a class="page-link" href="#" data-page="1">1</a>
      </li>
    `;
    
    if (startPage > 2) {
      paginationHTML += `
        <li class="page-item disabled">
          <span class="page-link">...</span>
        </li>
      `;
    }
  }
  
  // Generate page numbers
  for (let i = startPage; i <= endPage; i++) {
    paginationHTML += `
      <li class="page-item ${i === currentPage ? 'active' : ''}">
        <a class="page-link" href="#" data-page="${i}">${i}</a>
      </li>
    `;
  }
  
  // Last page link if not in range
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += `
        <li class="page-item disabled">
          <span class="page-link">...</span>
        </li>
      `;
    }
    
    paginationHTML += `
      <li class="page-item">
        <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
      </li>
  `;
  }
  
  // Next button
  paginationHTML += `
    <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
        <span aria-hidden="true">&raquo;</span>
      </a>
    </li>
  `;
  
  paginationHTML += `</ul>`;
  
  // Set pagination HTML
  paginationContainer.innerHTML = paginationHTML;
  paginationContainer.style.display = 'block';
}

// Cart Functions
function addToCart(product, variant = null, quantity = 1) {
  // Determine which price and SKU to use
  const price = variant ? variant.price : product.price;
  const sku = variant ? variant.sku : product.sku;
  
  // Create a cart item object with consistent id property
  const cartItem = {
    id: variant ? `${product._id || product.id}-${variant._id}` : (product._id || product.id),
    productId: product._id || product.id,
    name: product.name,
    price: price,
    sku: sku,
    image: product.featuredImage || product.image || 'images/placeholder.png',
    quantity: quantity,
    category: product.category ? product.category.name : '',
    variant: variant ? {
      _id: variant._id,
      name: variant.name,
      sku: variant.sku
    } : null
  };
  
  // Check if product (or product+variant) is already in cart
  const existingItemIndex = cart.findIndex(item => item.id === cartItem.id);
  
  if (existingItemIndex !== -1) {
    // Increase quantity if already in cart
    cart[existingItemIndex].quantity += quantity;
  } else {
    // Add new item to cart
    cart.push(cartItem);
  }
  
  // Update cart in localStorage
  saveCart();
  
  // Update cart UI
  updateCartCount();
  updateCartDisplay();
  
  // Show success toast
  showToast(`${product.name} added to cart!`, 'success');
}

function removeFromCart(productId) {
  console.log(`Removing product ${productId} from cart`);
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  updateCartCount();
  updateCartDisplay();
  showToast('Item removed from cart');
}

function updateCartCount() {
  const cartCount = document.getElementById('cart-count');
  if (cartCount) {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    cartCount.textContent = totalItems;
    cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
  }
}

// Update the cart functions in script.js
function updateCartDisplay() {
  console.log("Updating cart display with", cart.length, "items");
  
  const cartItemsContainer = document.getElementById('cart-items-container');
  const cartSummary = document.getElementById('cart-summary');
  
  // Check if cart items container and summary exist
  if (!cartItemsContainer) {
    console.error("Cart items container missing in DOM");
    return;
  }
  
  if (!cartSummary) {
    console.error("Cart summary missing in DOM");
    return;
  }
  
  // If cart is empty, show empty message
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-shopping-basket fa-3x text-muted mb-3"></i>
        <p class="text-muted">Your cart is empty.</p>
        <button class="btn btn-outline-primary" data-bs-dismiss="offcanvas">Continue Shopping</button>
      </div>
    `;
    cartSummary.style.display = 'none';
    return;
  }
  
  // Show cart summary
  cartSummary.style.display = 'block';
  
  // Generate cart HTML
  let cartHTML = '';
  let subtotal = 0;

  cart.forEach((item) => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    cartHTML += `
      <div class="cart-item d-flex align-items-center mb-3 pb-3 border-bottom">
        <img src="${item.image || 'images/product-placeholder.jpg'}" 
             class="img-fluid rounded me-3" 
             style="width: 80px; height: 80px; object-fit: cover;" 
             alt="${item.name}">
        <div class="flex-grow-1">
          <h6 class="mb-1">${item.name}</h6>
          <p class="text-muted small mb-2">${item.category || 'General'}</p>
          <div class="d-flex justify-content-between align-items-center">
            <div class="quantity-control d-flex align-items-center">
              <button class="btn btn-sm btn-outline-secondary quantity-btn" data-product-id="${item.id}" data-change="-1">
                <i class="fas fa-minus"></i>
              </button>
              <span class="mx-2">${item.quantity}</span>
              <button class="btn btn-sm btn-outline-secondary quantity-btn" data-product-id="${item.id}" data-change="1">
                <i class="fas fa-plus"></i>
              </button>
            </div>
            <div class="text-end">
              <span class="fw-bold d-block">RWF ${itemTotal.toFixed(0)}</span>
              <small class="text-muted">RWF ${item.price.toFixed(0)} each</small>
            </div>
          </div>
        </div>
        <button class="btn btn-sm text-danger ms-2 remove-item-btn" data-product-id="${item.id}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  });

  cartItemsContainer.innerHTML = cartHTML;
  
  // Add event listeners to the newly created buttons
  document.querySelectorAll('.quantity-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const productId = this.dataset.productId;
      const change = parseInt(this.dataset.change);
      updateQuantity(productId, change);
    });
  });
  
  document.querySelectorAll('.remove-item-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const productId = this.dataset.productId;
      removeFromCart(productId);
    });
  });
  
  updateCartSummary(subtotal);
}

function updateQuantity(productId, change) {
  console.log(`Updating quantity for product ${productId} with change ${change}`);
  const item = cart.find(item => item.id === productId);
  if (item) {
    console.log(`Found item in cart:`, item);
    item.quantity += change;
    if (item.quantity <= 0) {
      removeFromCart(productId);
    } else {
      saveCart();
      updateCartCount();
      updateCartDisplay();
    }
  } else {
    console.error(`Item with ID ${productId} not found in cart`);
  }
}

function updateCartSummary(subtotal) {
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;
  
  // Format with thousand separators
  const formatPrice = (value) => {
    return value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  };
  
  document.getElementById('cart-subtotal').textContent = `RWF ${formatPrice(subtotal)}`;
  document.getElementById('cart-tax').textContent = `RWF ${formatPrice(tax)}`;
  document.getElementById('cart-total').textContent = `RWF ${formatPrice(total)}`;
  
  // Update modal summary if exists
  const modalSubtotal = document.getElementById('modal-subtotal');
  const modalTax = document.getElementById('modal-tax');
  const modalTotal = document.getElementById('modal-total');
  const modalDelivery = document.getElementById('modal-delivery');
  
  if (modalSubtotal && modalTax && modalTotal) {
    modalSubtotal.textContent = `RWF ${formatPrice(subtotal)}`;
    
    // Add delivery fee if total is below free shipping threshold
    let deliveryFee = 0;
    if (subtotal < 5000) {
      deliveryFee = 1000;
      if (modalDelivery) {
        modalDelivery.textContent = `RWF ${formatPrice(deliveryFee)}`;
      }
    } else {
      if (modalDelivery) {
        modalDelivery.textContent = 'FREE';
      }
    }
    
    modalTax.textContent = `RWF ${formatPrice(tax)}`;
    modalTotal.textContent = `RWF ${formatPrice(total + deliveryFee)}`;
    
    // Also update order total in complete step
    const orderTotal = document.getElementById('order-total');
    if (orderTotal) {
      orderTotal.textContent = `RWF ${formatPrice(total + deliveryFee)}`;
    }
  }
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function clearCart() {
  cart = [];
  saveCart();
  updateCartCount();
  updateCartDisplay();
  showToast('Cart cleared');
}

// Toast Notification
function showToast(message, type = 'success') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast-notification ${type}`;
  toast.innerHTML = `
    <div class="toast-message d-flex align-items-center">
      <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-2"></i>
      <span>${message}</span>
    </div>
  `;
  toastContainer.appendChild(toast);
  // Show toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toastContainer.removeChild(toast);
    }, 300);
  }, 3000);
}

// Make functions available globally
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.clearCart = clearCart;
window.loadProducts = loadProducts;

// Checkout Process Handling
function setupCheckoutProcess() {
  // Handle step navigation
  document.querySelectorAll('.next-step').forEach(button => {
    button.addEventListener('click', function () {
      const currentStep = this.closest('.checkout-step');
      const nextStepId = this.getAttribute('data-step');
      const currentStepId = currentStep.id.replace('step-', '');
      
      // Validate current step before proceeding
      if (!validateStep(currentStepId)) {
        return; // Don't proceed if validation fails
      }
      
      const nextStep = document.getElementById(`step-${nextStepId}`);
      
      // If moving to review step, update the summary information
      if (nextStepId === 'review') {
        updateOrderSummary();
      }
      
      // Clear any previous validation errors when moving to next step
      clearValidationErrors(currentStep);
      
      currentStep.classList.remove('active');
      currentStep.style.display = 'none';
      nextStep.classList.add('active');
      nextStep.style.display = 'block';
    });
  });
  
  // Function to validate each step
  function validateStep(stepId) {
    let isValid = true;
    
    if (stepId === 'customer-info') {
      // Validate customer information step
      const requiredFields = ['fullName', 'customerEmail', 'phoneNumber'];
      requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
          markFieldAsInvalid(field, `${field.previousElementSibling.textContent} is required`);
          isValid = false;
        } else {
          markFieldAsValid(field);
        }
      });
      
      // Validate email format
      const emailField = document.getElementById('customerEmail');
      if (emailField.value.trim() && !isValidEmail(emailField.value.trim())) {
        markFieldAsInvalid(emailField, 'Please enter a valid email address');
        isValid = false;
      }
      
    } else if (stepId === 'delivery') {
      // Validate delivery information step
      const requiredFields = ['address', 'city', 'sector'];
      requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
          markFieldAsInvalid(field, `${field.previousElementSibling.textContent} is required`);
          isValid = false;
        } else {
          markFieldAsValid(field);
        }
      });
    }
    
    if (!isValid) {
      showToast('Please fill in all required fields', 'error');
    }
    
    return isValid;
  }
  
  // Helper function to validate email format
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // Helper function to mark a field as invalid
  function markFieldAsInvalid(field, message) {
    field.classList.add('is-invalid');
    field.classList.remove('is-valid');
    
    // Add or update error message
    let errorDiv = field.nextElementSibling;
    if (!errorDiv || !errorDiv.classList.contains('invalid-feedback')) {
      errorDiv = document.createElement('div');
      errorDiv.classList.add('invalid-feedback');
      field.parentNode.insertBefore(errorDiv, field.nextSibling);
    }
    errorDiv.textContent = message;
  }
  
  // Helper function to mark a field as valid
  function markFieldAsValid(field) {
    field.classList.remove('is-invalid');
    field.classList.add('is-valid');
  }
  
  // Helper function to clear validation errors
  function clearValidationErrors(container) {
    container.querySelectorAll('.is-invalid').forEach(field => {
      field.classList.remove('is-invalid');
    });
    container.querySelectorAll('.invalid-feedback').forEach(feedback => {
      feedback.remove();
    });
  }

  document.querySelectorAll('.prev-step').forEach(button => {
    button.addEventListener('click', function () {
      const currentStep = this.closest('.checkout-step');
      const prevStepId = this.getAttribute('data-step');
      const prevStep = document.getElementById(`step-${prevStepId}`);

      currentStep.classList.remove('active');
      currentStep.style.display = 'none';
      prevStep.classList.add('active');
      prevStep.style.display = 'block';
    });
  });

  // Place order button
  document.getElementById('place-order-btn')?.addEventListener('click', placeOrder);
  
  // Function to update order summary in the review step
  function updateOrderSummary() {
    try {
      // Get customer information
      const fullName = document.getElementById('fullName').value;
      const email = document.getElementById('customerEmail').value;
      const phone = document.getElementById('phoneNumber').value;
      const address = document.getElementById('address').value;
      const city = document.getElementById('city').value;
      const sector = document.getElementById('sector').value;
      
      // Update customer information
      document.getElementById('summary-name').textContent = fullName;
      document.getElementById('summary-email').textContent = email;
      document.getElementById('summary-phone').textContent = `+250${phone}`;
      document.getElementById('summary-address').textContent = `${address}, ${sector}, ${city}`;
      document.getElementById('summary-date').textContent = new Date().toLocaleDateString();

      // Update order items
      const summaryItems = document.getElementById('summary-items');
      summaryItems.innerHTML = cart.map(item => `
        <tr>
          <td>
            <div class="d-flex align-items-center">
              <img src="${item.image}" alt="${item.name}" class="me-2" style="width: 40px; height: 40px; object-fit: cover;">
              <div>${item.name}</div>
            </div>
          </td>
          <td class="text-center">${item.quantity}</td>
          <td class="text-end">RWF ${item.price.toLocaleString()}</td>
          <td class="text-end">RWF ${(item.price * item.quantity).toLocaleString()}</td>
        </tr>
      `).join('');

      // Calculate and update totals
      const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
      const deliveryFee = 1500; // Fixed delivery fee
      const total = subtotal + deliveryFee;

      document.getElementById('summary-subtotal').textContent = `RWF ${subtotal.toLocaleString()}`;
      document.getElementById('summary-delivery').textContent = `RWF ${deliveryFee.toLocaleString()}`;
      document.getElementById('summary-total').textContent = `RWF ${total.toLocaleString()}`;

    } catch (error) {
      console.error('Error updating order summary:', error);
      showToast('Error updating order summary. Please try again.', 'error');
    }
  }
}

// Function to place order and send invoice
async function placeOrder() {
    // Show loading state
    const placeOrderBtn = document.getElementById('place-order-btn');
    const originalBtnText = placeOrderBtn.innerHTML;
    placeOrderBtn.disabled = true;
    placeOrderBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';
    
    try {
        // Check if user is logged in
        const customerToken = localStorage.getItem('customerToken');
        const customerDataStr = localStorage.getItem('customer');
        
        if (!customerToken || !customerDataStr) {
            // Show login required alert
            const loginAlert = document.getElementById('login-required-alert');
            if (loginAlert) {
                loginAlert.style.display = 'block';
            }
            
            // Reset button state
            placeOrderBtn.disabled = false;
            placeOrderBtn.innerHTML = originalBtnText;
            return;
        }
        
        // Get form data
        const customerData = {
            fullName: document.getElementById('fullName').value.trim(),
            email: document.getElementById('customerEmail').value.trim(),
            phone: document.getElementById('phoneNumber').value.trim(),
            address: document.getElementById('address').value.trim(),
            city: document.getElementById('city').value.trim(),
            sector: document.getElementById('sector').value.trim(),
            company: document.getElementById('companyName')?.value.trim() || ''
        };
        
        // Calculate order totals
        const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        const deliveryFee = 1500;
        const total = subtotal + deliveryFee;
        
        // Generate order reference
        const orderReference = 'INV-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        
        // Create order object
        const order = {
            reference: orderReference,
            customer: customerData,
            items: cart.map(item => ({
                productId: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                total: item.price * item.quantity,
                image: item.image
            })),
            subtotal: subtotal,
            deliveryFee: deliveryFee,
            tax: 0,
            total: total,
            paymentMethod: 'invoice',
            paymentStatus: 'pending',
            status: 'pending',
            date: new Date()
        };

        // Set timeout for the fetch request
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            // Send order to server
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${customerToken}`
                },
                body: JSON.stringify(order),
                signal: controller.signal
            });

            clearTimeout(timeout);

            // Check response status
            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Server error occurred');
                } else {
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }
            }

            // Parse response
            const result = await response.json();
            console.log('Order saved successfully:', result);

            // Update UI with order reference
            document.getElementById('order-reference').textContent = orderReference;
            document.getElementById('order-date').textContent = new Date().toLocaleDateString();
            document.getElementById('order-email').textContent = customerData.email;
            
            // Show complete step
            document.getElementById('step-confirm').classList.remove('active');
            document.getElementById('step-confirm').style.display = 'none';
            document.getElementById('step-complete').classList.add('active');
            document.getElementById('step-complete').style.display = 'block';
            
            // Clear cart
            clearCart();
            updateCartDisplay();
            
            // Show success message
            showToast('Order placed successfully! Check your email for invoice.', 'success');

        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Your order is being processed, but please check your email for confirmation.');
            }
            throw error;
        }
        
    } catch (error) {
        console.error('Error placing order:', error);
        showToast(error.message || 'Failed to place order. Please try again.', 'error');
        
        // Reset button state
        placeOrderBtn.disabled = false;
        placeOrderBtn.innerHTML = originalBtnText;
    }
}

// Function to save order to database
async function saveOrderToDatabase(order) {
  try {
    // Get customer token if logged in
    const customerToken = localStorage.getItem('customerToken');
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add authorization header if customer is logged in
    if (customerToken) {
      headers['Authorization'] = `Bearer ${customerToken}`;
    }
    
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(order)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save order');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error saving order:', error);
    throw error;
  }
}

// Function to send invoice email
async function sendInvoiceEmail(order) {
  try {
    // Create invoice HTML
    const invoiceHtml = generateInvoiceHtml(order);
    
    // Send email with invoice
    const emailData = {
      to: order.customer.email,
      subject: `N.honest Supermarket - Order #${order.reference}`,
      html: invoiceHtml
    };
    
    // Use EmailJS to send the email
    const emailJSParams = {
      to_email: order.customer.email,
      to_name: order.customer.fullName,
      subject: `N.honest Supermarket - Order #${order.reference}`,
      message: 'Thank you for your order! Please find your invoice attached.',
      order_ref: order.reference,
      order_date: new Date(order.date).toLocaleDateString(),
      order_total: `RWF ${order.total.toFixed(2)}`,
      invoice_html: invoiceHtml
    };
    
    // Send the email using EmailJS
    if (window.emailConfig && typeof window.emailConfig.sendEmail === 'function') {
      await window.emailConfig.sendEmail(emailJSParams);
    } else {
      console.warn('EmailJS configuration not found, falling back to server-side email');
      
      // Fallback to server-side email
      const response = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to send invoice email');
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error sending invoice email:', error);
    // Don't throw error here to allow order completion even if email fails
    return false;
  }
}

// Function to generate invoice HTML
function generateInvoiceHtml(order) {
  console.log('Generating invoice HTML for order:', order);
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #ddd;">${item.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">RWF ${item.price.toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">RWF ${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');
  
  const currentDate = new Date(order.date);
  const formattedDate = currentDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Generate a due date 7 days from now
  const dueDate = new Date(currentDate);
  dueDate.setDate(dueDate.getDate() + 7);
  const formattedDueDate = dueDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${order.reference}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        
        body { 
          font-family: 'Poppins', Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          background-color: #f9f9f9;
          margin: 0;
          padding: 0;
        }
        
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
          background-color: #fff;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
        }
        
        .invoice-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
          border-bottom: 2px solid #f0f0f0;
          padding-bottom: 20px;
        }
        
        .company-info {
          flex: 1;
        }
        
        .company-name {
          color: #e63946;
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 5px 0;
        }
        
        .company-details {
          font-size: 14px;
          color: #666;
        }
        
        .invoice-info {
          text-align: right;
        }
        
        .invoice-title {
          font-size: 40px;
          font-weight: 700;
          color: #e63946;
          margin: 0 0 15px 0;
          text-transform: uppercase;
        }
        
        .invoice-details {
          font-size: 14px;
        }
        
        .invoice-details p {
          margin: 5px 0;
        }
        
        .invoice-details strong {
          display: inline-block;
          width: 100px;
        }
        
        .customer-supplier-container {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        
        .customer-details, .supplier-details {
          flex: 1;
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 5px;
          margin: 0 10px;
        }
        
        .customer-details h3, .supplier-details h3 {
          margin-top: 0;
          color: #e63946;
          font-size: 18px;
          border-bottom: 1px solid #ddd;
          padding-bottom: 10px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          border: 1px solid #ddd;
        }
        
        th {
          background-color: #e63946;
          color: white;
          font-weight: 600;
          text-align: left;
          padding: 12px;
          font-size: 14px;
        }
        
        td {
          padding: 12px;
          border-bottom: 1px solid #ddd;
          font-size: 14px;
        }
        
        .text-right {
          text-align: right;
        }
        
        .text-center {
          text-align: center;
        }
        
        .totals-table {
          width: 350px;
          margin-left: auto;
          margin-right: 0;
          border: none;
        }
        
        .totals-table td {
          border: none;
          padding: 8px 12px;
        }
        
        .totals-table .total-row td {
          font-weight: 700;
          font-size: 16px;
          border-top: 2px solid #e63946;
          color: #e63946;
        }
        
        .payment-info {
          background-color: #f8f9fa;
          padding: 20px;
          border-radius: 5px;
          margin-top: 30px;
          border-left: 4px solid #e63946;
        }
        
        .payment-title {
          font-weight: 600;
          margin-bottom: 15px;
          color: #e63946;
          font-size: 18px;
        }
        
        .payment-method {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
        }
        
        .payment-method-item {
          flex: 1;
          padding: 15px;
          background-color: white;
          border-radius: 5px;
          margin: 0 10px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        
        .payment-method-title {
          font-weight: 600;
          margin-bottom: 10px;
          color: #333;
        }
        
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 14px;
          color: #666;
          border-top: 1px solid #eee;
          padding-top: 20px;
        }
        
        .thank-you {
          font-size: 20px;
          font-weight: 600;
          color: #e63946;
          margin-bottom: 10px;
        }
        
        .barcode {
          text-align: center;
          margin: 30px 0;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          letter-spacing: 2px;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Invoice Header with Logo -->
        <div class="invoice-header">
          <div class="company-info">
            <img src="/images/f.logo.png" alt="N.honest Supermarket Logo" style="height: 60px; margin-bottom: 15px;">
            <div class="company-details">
              <p>Kigali, Rwanda</p>
              <p>Tel: +250788633739</p>
              <p>Email: info@nhonest.com</p>
              <p>Web: www.nhonest.com</p>
            </div>
          </div>
          <div class="invoice-info">
            <h2 class="invoice-title">Invoice</h2>
            <div class="invoice-details">
              <p><strong>Invoice #:</strong> ${order.reference}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Due Date:</strong> ${formattedDueDate}</p>
              <p><strong>Status:</strong> Pending Payment</p>
            </div>
          </div>
        </div>
        
        <!-- Customer & Supplier Details -->
        <div class="customer-supplier-container">
          <div class="customer-details">
            <h3>Bill To:</h3>
            <p><strong>Name:</strong> ${order.customer.fullName}</p>
            <p><strong>Email:</strong> ${order.customer.email}</p>
            <p><strong>Phone:</strong> ${order.customer.phone}</p>
            <p><strong>Address:</strong> ${order.customer.address}, ${order.customer.sector}, ${order.customer.city}</p>
            ${order.customer.company ? `<p><strong>Company:</strong> ${order.customer.company}</p>` : ''}
          </div>
          <div class="supplier-details">
            <h3>From:</h3>
            <p><strong>N.honest Supermarket Ltd</strong></p>
            <p>KG 123 Street, Kigali</p>
            <p>Rwanda</p>
            <p>TIN: 123456789</p>
            <p>Registration #: RW12345</p>
          </div>
        </div>
        
        <!-- Order Items -->
        <table>
          <thead>
            <tr>
              <th style="width: 40%;">Item Description</th>
              <th style="width: 15%; text-align: center;">Quantity</th>
              <th style="width: 20%; text-align: right;">Unit Price</th>
              <th style="width: 25%; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <!-- Totals -->
        <table class="totals-table">
          <tr>
            <td>Subtotal:</td>
            <td class="text-right">RWF ${order.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Delivery Fee:</td>
            <td class="text-right">RWF ${order.deliveryFee.toFixed(2)}</td>
          </tr>

          <tr class="total-row">
            <td>Total Due:</td>
            <td class="text-right">RWF ${order.total.toFixed(2)}</td>
          </tr>
        </table>
        
        <!-- Payment Information -->
        <div class="payment-info">
          <h3 class="payment-title">Payment Instructions</h3>
          <p>Please make payment within 7 days using one of the following methods:</p>
          
          <div class="payment-method">
            <div class="payment-method-item">
              <h4 class="payment-method-title">
                <img src="/images/MoMo.jpg" alt="MTN MOMO" style="height: 30px; margin-right: 10px;">
                MTN Mobile Money
              </h4>
              <p><strong>MOMO Code:</strong> 430020</p>
              <p><strong>Phone:</strong> +250788633739</p>
              <p class="text-muted small">Send payment to this code and phone number</p>
            </div>
            
            <div class="payment-method-item">
              <h4 class="payment-method-title">Bank Transfer</h4>
              <p>Bank: Bank of Kigali</p>
              <p>Account #: 00012345678</p>
              <p>Account Name: N.honest Supermarket Ltd</p>
            </div>
          </div>
          
          <p><strong>Payment Reference:</strong> Please include your order number ${order.reference} as payment reference</p>
        </div>

        <!-- Barcode -->
        <div class="barcode">
          *${order.reference}*
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p class="thank-you">Thank you for shopping with N.honest Supermarket!</p>
          <p>If you have any questions about this invoice, please contact our customer service:</p>
          <p>Email: support@nhonest.com | Phone: +250788633739</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function processCardPayment() {
  // Validate card details
  const cardNumber = document.getElementById('cardNumber').value;
  const cardExpiry = document.getElementById('cardExpiry').value;
  const cardCvv = document.getElementById('cardCvv').value;
  const cardName = document.getElementById('cardName').value;

  if (!cardNumber || !cardExpiry || !cardCvv || !cardName) {
    showToast('Please fill all card details', 'error');
    return;
  }

  // Show processing step
  document.getElementById('step-confirm').classList.remove('active');
  document.getElementById('step-confirm').style.display = 'none';
  document.getElementById('step-processing').classList.add('active');
  document.getElementById('step-processing').style.display = 'block';

  try {
    // Simulate API call to payment processor
    await simulateCardPayment(cardNumber, cardExpiry, cardCvv, cardName);

    // On success, show completion step
    document.getElementById('step-processing').classList.remove('active');
    document.getElementById('step-processing').style.display = 'none';
    document.getElementById('step-complete').classList.add('active');
    document.getElementById('step-complete').style.display = 'block';

    // Update order details
    document.getElementById('order-total').textContent = document.getElementById('modal-total').textContent;
    document.getElementById('order-address').textContent = document.getElementById('address').value;

    // Save order to database
    await saveOrderToDatabase();

  } catch (error) {
    console.error('Payment error:', error);
    showToast('Payment failed. Please try again.', 'error');
    // Go back to payment step
    document.getElementById('step-processing').classList.remove('active');
    document.getElementById('step-processing').style.display = 'none';
    document.getElementById('step-confirm').classList.add('active');
    document.getElementById('step-confirm').style.display = 'block';
  }
}

// Simulate API calls (replace with real API calls in production)
function simulateCardPayment(cardNumber, cardExpiry, cardCvv, cardName) {
  return new Promise((resolve, reject) => {
    // Simulate network delay
    setTimeout(() => {
      // For demo purposes, we'll assume payment is always successful
      // In real app, you would call your payment gateway API here
      console.log(`Simulating card payment for ${cardName}`);
      resolve({ success: true });
    }, 2000);
  });
}

async function saveOrderToDatabase() {
  const order = {
    orderNumber: document.getElementById('order-reference').textContent,
    customerName: document.getElementById('fullName').value,
    phoneNumber: '+250' + document.getElementById('phoneNumber').value,
    deliveryAddress: document.getElementById('address').value,
    deliveryNotes: document.getElementById('deliveryNotes').value,
    items: cart.map(item => ({
      productId: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image
    })),
    subtotal: parseFloat(document.getElementById('modal-subtotal').textContent.replace('RWF ', '')),
    deliveryFee: document.getElementById('modal-delivery').textContent === 'FREE' ?
      0 :
      parseFloat(document.getElementById('modal-delivery').textContent.replace('RWF ', '')),
    total: parseFloat(document.getElementById('modal-total').textContent.replace('RWF ', '')),
    paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
    status: 'processing',
    createdAt: new Date()
  };

  try {
    // In a real app, you would send this to your backend API
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order)
    });

    if (!response.ok) {
      throw new Error('Failed to save order');
    }

    // Clear cart after successful order
    clearCart();

  } catch (error) {
    console.error('Error saving order:', error);
    // Even if saving fails, we still clear the cart to prevent duplicate orders
    clearCart();
  }
}

function completeOrder() {
  // Any cleanup after order completion
  console.log('Order completed');
}

// Show Quick View Modal
function showQuickView(product) {
  console.log('Quick view for product:', product);
  
  // Create modal if it doesn't exist
  let quickViewModal = document.getElementById('quickViewModal');
  if (!quickViewModal) {
    const modalHTML = `
      <div class="modal fade" id="quickViewModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Product Details</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="quickViewContent"></div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    quickViewModal = document.getElementById('quickViewModal');
  }
  
  // Get modal content container
  const quickViewContent = document.getElementById('quickViewContent');
  
  // Default image if product image is missing
  const productImage = product.image || product.featuredImage || 'images/placeholder.png';
  
  // Determine if item is out of stock
  const isOutOfStock = (product.stock <= 0);
  
  // Create discount tag HTML if there's a discount
  const discountHTML = calculateDiscountHTML(product);
  
  // Generate variants HTML
  let variantsHTML = '';
  if (product.variants && product.variants.length > 0) {
    variantsHTML = `
      <div class="product-variants mb-3">
        <h6 class="fw-bold mb-2">Available Options</h6>
        <div class="variants-container">
          <div class="row g-2">
            ${product.variants.map(variant => `
              <div class="col-md-6">
                <div class="variant-item p-2 border rounded d-flex justify-content-between align-items-center">
                  <div>
                    <span class="variant-name">${variant.name}</span>
                    ${variant.combination && variant.combination.length > 0 ? 
                      `<small class="d-block text-muted">${variant.combination.join(' / ')}</small>` : ''}
                  </div>
                  <div class="variant-price fw-bold">RWF ${variant.price.toLocaleString()}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }
  
  // Populate modal content
  quickViewContent.innerHTML = `
    <div class="row">
      <div class="col-md-6">
        <div class="product-image-container position-relative">
          ${discountHTML}
          <img src="${productImage}" class="img-fluid rounded" alt="${product.name}">
        </div>
        ${product.images && product.images.length > 1 ? `
          <div class="product-thumbnails d-flex mt-2 gap-2 overflow-auto">
            ${product.images.map(img => `
              <div class="thumbnail-item">
                <img src="${img}" class="img-thumbnail" alt="${product.name}" style="width: 70px; height: 70px; object-fit: cover; cursor: pointer;">
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="col-md-6">
        <div class="product-category small text-muted mb-1">${product.category ? product.category.name : 'Uncategorized'}</div>
        <h3 class="product-title h4 mb-2">${product.name}</h3>
        
        <div class="product-rating mb-3">
          <div class="stars-outer">
            <div class="stars-inner" style="width: ${(product.rating || 4) * 20}%"></div>
          </div>
          <span class="rating-count small text-muted">(${product.reviews || Math.floor(Math.random() * 50) + 5} reviews)</span>
        </div>
        
        <div class="product-price mb-3">
          <span class="fw-bold fs-4">RWF ${product.price.toLocaleString()}</span>
          ${product.originalPrice ? `<span class="text-decoration-line-through text-muted ms-2">RWF ${product.originalPrice.toLocaleString()}</span>` : ''}
        </div>
        
        <div class="product-description mb-3">
          <p>${product.description || 'No description available.'}</p>
        </div>
        
        ${variantsHTML}
        
        <div class="product-actions">
          <div class="row g-2 align-items-center">
            <div class="col-auto">
              <div class="quantity-selector d-flex align-items-center border rounded">
                <button class="btn btn-sm btn-quantity" data-action="decrease" ${isOutOfStock ? 'disabled' : ''}>-</button>
                <input type="number" class="form-control form-control-sm text-center border-0 product-quantity" value="1" min="1" max="${product.stock || 10}" style="width: 50px" ${isOutOfStock ? 'disabled' : ''}>
                <button class="btn btn-sm btn-quantity" data-action="increase" ${isOutOfStock ? 'disabled' : ''}>+</button>
              </div>
            </div>
            <div class="col">
              <button class="btn ${isOutOfStock ? 'btn-secondary' : 'btn-primary'} w-100 add-to-cart-btn" data-product-id="${product._id}" ${isOutOfStock ? 'disabled' : ''}>
                <i class="fas ${isOutOfStock ? 'fa-ban' : 'fa-shopping-cart'} me-2"></i> ${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
          </div>
          
          <div class="d-flex justify-content-between mt-3">
            <button class="btn btn-outline-secondary btn-sm">
              <i class="far fa-heart me-1"></i> Add to Wishlist
            </button>
            <button class="btn btn-outline-secondary btn-sm">
              <i class="fas fa-share-alt me-1"></i> Share
            </button>
          </div>
        </div>
        
        <div class="product-meta mt-4 pt-3 border-top">
          <div class="row">
            <div class="col-6">
              <small class="text-muted">SKU: </small>
              <small>${product.sku || 'N/A'}</small>
            </div>
            <div class="col-6">
              <small class="text-muted">Stock: </small>
              <small>${product.stock || 0} units</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Initialize modal and show it
  const quickViewModalObj = new bootstrap.Modal(quickViewModal);
  quickViewModalObj.show();
  
  // Add event listeners for thumbnails
  const thumbnails = quickViewModal.querySelectorAll('.thumbnail-item img');
  const mainImage = quickViewModal.querySelector('.product-image-container img');
  
  thumbnails.forEach(thumb => {
    thumb.addEventListener('click', function() {
      mainImage.src = this.src;
    });
  });
  
  // Add event listeners for quantity buttons
  const decreaseBtn = quickViewModal.querySelector('[data-action="decrease"]');
  const increaseBtn = quickViewModal.querySelector('[data-action="increase"]');
  const quantityInput = quickViewModal.querySelector('.product-quantity');
  
  if (decreaseBtn && increaseBtn && quantityInput) {
    decreaseBtn.addEventListener('click', function() {
      let quantity = parseInt(quantityInput.value);
      if (quantity > 1) {
        quantityInput.value = --quantity;
      }
    });
    
    increaseBtn.addEventListener('click', function() {
      let quantity = parseInt(quantityInput.value);
      const max = parseInt(quantityInput.max);
      if (quantity < max) {
        quantityInput.value = ++quantity;
      }
    });
  }
  
  // Add event listener for add to cart button
  const addToCartBtn = quickViewModal.querySelector('.add-to-cart-btn');
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', function() {
      const quantity = parseInt(quantityInput.value);
      addToCart(product, null, quantity);
      showToast(`${product.name} added to cart`);
      
      // Close modal after adding to cart
      modal.hide();
    });
  }
  
  // Handle variants if any
  if (product.variants && product.variants.length > 0) {
    quickViewVariants.innerHTML = '<h6 class="fw-bold mb-3">Available Options:</h6>';
    
    // Group variants by their type (e.g., size, color)
    const variantGroups = {};
    
    product.variants.forEach(variant => {
      const variantName = variant.name.split(':')[0].trim();
      if (!variantGroups[variantName]) {
        variantGroups[variantName] = [];
      }
      variantGroups[variantName].push(variant);
    });
    
    // Create variant selectors
    for (const [groupName, variants] of Object.entries(variantGroups)) {
      const selectGroup = document.createElement('div');
      selectGroup.className = 'mb-3 variant-group';
      
      // Create label
      const label = document.createElement('label');
      label.className = 'form-label fw-medium';
      label.textContent = `${groupName}:`;
      selectGroup.appendChild(label);
      
      // If this is a color option, create color swatches
      if (groupName.toLowerCase() === 'color') {
        const colorContainer = document.createElement('div');
        colorContainer.className = 'd-flex flex-wrap gap-2 mb-2';
        
        variants.forEach(variant => {
          const colorValue = variant.name.split(':')[1].trim();
          const colorSwatch = document.createElement('div');
          colorSwatch.className = 'color-swatch';
          colorSwatch.dataset.variantId = variant._id;
          colorSwatch.dataset.price = variant.price;
          colorSwatch.dataset.stock = variant.stock;
          colorSwatch.dataset.sku = variant.sku;
          colorSwatch.title = colorValue;
          
          // Try to use the color value as the background color
          let backgroundColor = colorValue.toLowerCase();
          
          // For common color names that might not be CSS colors
          const colorMap = {
            'navy': '#000080',
            'burgundy': '#800020',
            'teal': '#008080',
            'olive': '#808000',
            'beige': '#F5F5DC',
            'cream': '#FFFDD0',
            'mauve': '#E0B0FF',
            'mint': '#98FB98',
            'salmon': '#FA8072',
            'mustard': '#FFDB58'
          };
          
          backgroundColor = colorMap[backgroundColor] || backgroundColor;
          
          colorSwatch.style.backgroundColor = backgroundColor;
          
          // Add a checkmark for the selected color
          const checkmark = document.createElement('i');
          checkmark.className = 'fas fa-check checkmark';
          colorSwatch.appendChild(checkmark);
          
          // Handle color selection
          colorSwatch.addEventListener('click', function() {
            document.querySelectorAll('.color-swatch').forEach(swatch => {
              swatch.classList.remove('selected');
            });
            colorSwatch.classList.add('selected');
            updateVariantPrice();
          });
          
          colorContainer.appendChild(colorSwatch);
        });
        
        selectGroup.appendChild(colorContainer);
      } 
      // For size or other options, create a select dropdown
      else {
        const select = document.createElement('select');
        select.className = 'form-select variant-select';
        select.id = `variant-${groupName.toLowerCase()}`;
        select.dataset.variantType = groupName.toLowerCase();
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = `Select ${groupName}`;
        select.appendChild(defaultOption);
        
        variants.forEach(variant => {
          const option = document.createElement('option');
          option.value = variant._id;
          option.dataset.sku = variant.sku;
          option.dataset.price = variant.price;
          option.dataset.stock = variant.stock;
          option.textContent = variant.name.split(':')[1].trim();
          select.appendChild(option);
        });
        
        select.addEventListener('change', updateVariantPrice);
        selectGroup.appendChild(select);
      }
      
      quickViewVariants.appendChild(selectGroup);
    }
  } else {
    quickViewVariants.innerHTML = '';
  }
  
  // Handle quantity buttons
  quickViewDecrease.addEventListener('click', function() {
    let quantity = parseInt(quickViewQuantity.value);
    if (quantity > 1) {
      quickViewQuantity.value = --quantity;
    }
  });
  
  quickViewIncrease.addEventListener('click', function() {
    let quantity = parseInt(quickViewQuantity.value);
    const max = parseInt(quickViewQuantity.max);
    if (quantity < max) {
      quickViewQuantity.value = ++quantity;
    }
  });
  
  // Handle add to cart button
  quickViewAddToCart.addEventListener('click', function() {
    const quantity = parseInt(quickViewQuantity.value);
    
    // Check if any variants are selected
    let selectedVariant = null;
    const variantSelects = quickViewVariants.querySelectorAll('.variant-select');
    const colorSwatches = quickViewVariants.querySelectorAll('.color-swatch.selected');
    
    // Check if all required variants are selected
    let allVariantsSelected = true;
    
    if (variantSelects.length > 0) {
      variantSelects.forEach(select => {
        if (!select.value) {
          allVariantsSelected = false;
          select.classList.add('is-invalid');
        } else {
          select.classList.remove('is-invalid');
          // Get the selected variant
          selectedVariant = {
            _id: select.value,
            price: parseFloat(select.options[select.selectedIndex].dataset.price),
            stock: parseInt(select.options[select.selectedIndex].dataset.stock),
            sku: select.options[select.selectedIndex].dataset.sku
          };
        }
      });
    }
    
    if (colorSwatches.length > 0) {
      if (colorSwatches.length !== 1) {
        allVariantsSelected = false;
        // Highlight that a color needs to be selected
        const colorGroup = quickViewVariants.querySelector('.variant-group:has(.color-swatch)');
        if (colorGroup) {
          colorGroup.classList.add('text-danger');
        }
      } else {
        const colorSwatch = colorSwatches[0];
        const colorGroup = quickViewVariants.querySelector('.variant-group:has(.color-swatch)');
        if (colorGroup) {
          colorGroup.classList.remove('text-danger');
      }
      
      // Get the selected variant
        selectedVariant = {
          _id: colorSwatch.dataset.variantId,
          price: parseFloat(colorSwatch.dataset.price),
          stock: parseInt(colorSwatch.dataset.stock),
          sku: colorSwatch.dataset.sku
        };
      }
    }
    
    if (allVariantsSelected) {
    addToCart(product, selectedVariant, quantity);
      
      // Show success message
      quickViewAddToCart.innerHTML = '<i class="fas fa-check me-2"></i> Added to Cart';
      quickViewAddToCart.classList.add('btn-success');
      
      // Reset button after 1.5 seconds
      setTimeout(() => {
        quickViewAddToCart.innerHTML = '<i class="fas fa-shopping-cart me-2"></i> Add to Cart';
        quickViewAddToCart.classList.remove('btn-success');
    
    // Close the modal
    const quickViewModalInstance = bootstrap.Modal.getInstance(quickViewModal);
    quickViewModalInstance.hide();
      }, 1500);
      } else {
      // Show error message
      showToast('Please select all required options', 'error');
    }
  });
  
  // Show the modal
  const modal = new bootstrap.Modal(quickViewModal);
  modal.show();
}

// Load Categories from API
async function loadCategories() {
  try {
    console.log('=== LOADING CATEGORIES ===');
    const response = await fetch('/api/categories');
    if (!response.ok) {
      console.error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
    }
    
    const categories = await response.json();
    console.log(`Loaded ${categories.length} categories from database:`, categories);
    
    if (!Array.isArray(categories)) {
      console.error('API returned non-array response for categories:', categories);
      throw new Error('Invalid categories data: Expected an array');
    }
    
    // Check if categories have valid _id fields
    const hasValidIds = categories.every(cat => cat._id);
    if (!hasValidIds) {
      console.warn('Some categories are missing _id fields:', categories);
    }
    
    // Store categories globally for later reference
    window.appCategories = categories;
    console.log('Categories stored in window.appCategories:', window.appCategories);
    
    // Update sidebar categories
    updateSidebarCategories(categories);
    
    // Update dropdown filter categories
    updateCategoryDropdown(categories);
    
    // Update category carousel if needed
    updateCategoryCarousel(categories);
    
    // Make sure all category event listeners are added
    addCategoryEventListeners();
    
    console.log('=== CATEGORIES LOADED SUCCESSFULLY ===');
    return categories;
    
  } catch (error) {
    console.error('=== ERROR LOADING CATEGORIES ===');
    console.error('Error details:', error);
    showToast('Error loading categories. Using default categories instead.', 'error');
    
    // Use hardcoded categories as fallback
    const fallbackCategories = [
      { _id: 'beverages', name: 'Beverages', description: 'Drinks and beverages' },
      { _id: 'packaged-foods', name: 'Packaged Foods', description: 'Ready-to-eat foods' },
      { _id: 'dairy', name: 'Dairy Products', description: 'Milk, cheese, and more' },
      { _id: 'household', name: 'Household Supplies', description: 'Everyday essentials' },
      { _id: 'personal-care', name: 'Personal Care', description: 'Health and beauty' }
    ];
    
    console.log('Using fallback categories:', fallbackCategories);
    
    // Store fallback categories globally
    window.appCategories = fallbackCategories;
    
    // Update UI with fallback categories
    updateSidebarCategories(fallbackCategories);
    updateCategoryDropdown(fallbackCategories);
    updateCategoryCarousel(fallbackCategories);
    
    // Make sure all category event listeners are added
    addCategoryEventListeners();
    
    return fallbackCategories;
  }
}

// Update sidebar categories
function updateSidebarCategories(categories) {
  const sidebarMenu = document.querySelector('.offcanvas-body .navbar-nav');
  if (!sidebarMenu) return;
  
  // Clear existing categories first
  sidebarMenu.innerHTML = '';
  
  // Add each category to the menu
  categories.forEach(category => {
    const li = document.createElement('li');
    li.className = 'nav-item border-dashed';
    
    // Get FontAwesome icon class based on category name
    const iconClass = getCategoryIcon(category.name);
    
    // Make sure to use the _id field from the database as the data-category attribute value
    li.innerHTML = `
      <a href="#" class="nav-link d-flex align-items-center gap-3 text-dark p-2" data-category="${category._id}">
        <i class="${iconClass} fa-fw"></i>
        <span>${category.name}</span>
      </a>
    `;
    
    sidebarMenu.appendChild(li);
    console.log(`Added category to sidebar: ${category.name} with ID: ${category._id}`);
  });
  
  // Add event listeners after updating the DOM
  setTimeout(addCategoryEventListeners, 0);
}

// Update category dropdown in the filter
function updateCategoryDropdown(categories) {
  const categoryDropdown = document.querySelector('.dropdown-menu[aria-labelledby="categoryDropdown"]');
  if (!categoryDropdown) return;
  
  // Keep the "All Categories" option
  categoryDropdown.innerHTML = `
    <li><a class="dropdown-item category-option" href="#" data-category="">All Categories</a></li>
    <li><hr class="dropdown-divider"></li>
  `;
  
  // Add each category from the database
  categories.forEach(category => {
    const li = document.createElement('li');
    // Make sure to use the _id field from the database as the data-category attribute value
    li.innerHTML = `<a class="dropdown-item category-option" href="#" data-category="${category._id}">${category.name}</a>`;
    categoryDropdown.appendChild(li);
    console.log(`Added category to dropdown: ${category.name} with ID: ${category._id}`);
  });
  
  // Also update the search filter dropdown
  const searchCategoryFilter = document.getElementById('category-filter');
  if (searchCategoryFilter) {
    // Keep the "All Categories" option
    searchCategoryFilter.innerHTML = `<option value="">All Categories</option>`;
    
    // Add each category from the database
    categories.forEach(category => {
      const option = document.createElement('option');
      // Make sure to use the _id field from the database as the value
      option.value = category._id;
      option.textContent = category.name;
      searchCategoryFilter.appendChild(option);
      console.log(`Added category to search filter: ${category.name} with ID: ${category._id}`);
    });
  }
  
  // Add event listeners after updating the DOM
  setTimeout(addCategoryEventListeners, 0);
}

// Update category carousel with dynamic categories
function updateCategoryCarousel(categories) {
  const categoryCarousel = document.querySelector('.category-carousel .swiper-wrapper');
  if (!categoryCarousel) return;
  
  // Clear existing slides first
  categoryCarousel.innerHTML = '';
  
  // Add each category as a slide
  categories.forEach(category => {
    const slide = document.createElement('div');
    slide.className = 'swiper-slide';
    
    // Default image if none is provided
    const categoryImage = category.image || 'images/placeholder.png';
    
    // Make sure to use the _id field from the database as the data-category attribute value
    slide.innerHTML = `
      <div class="card h-100 border-0 shadow-sm rounded-3">
        <img src="${categoryImage}" class="card-img-top" alt="${category.name}" style="height: 180px; object-fit: cover;">
        <div class="card-body text-center">
          <h4 class="card-title fs-6 fw-normal text-uppercase">${category.name}</h4>
          <p class="card-text text-muted small">${category.description || 'Explore our products'}</p>
          <a href="#" class="btn btn-sm btn-outline-primary" data-category="${category._id}">Browse</a>
        </div>
      </div>
    `;
    
    categoryCarousel.appendChild(slide);
    console.log(`Added category to carousel: ${category.name} with ID: ${category._id}`);
  });
  
  // Add event listeners after updating the DOM
  setTimeout(addCategoryEventListeners, 0);
  
  // Reinitialize Swiper to update the slides
  if (window.Swiper) {
    new Swiper('.category-carousel', {
      slidesPerView: 4,
      spaceBetween: 16,
      navigation: {
        nextEl: '.category-carousel-next',
        prevEl: '.category-carousel-prev',
      },
      breakpoints: {
        320: { slidesPerView: 1 },
        768: { slidesPerView: 2 },
        992: { slidesPerView: 3 },
        1200: { slidesPerView: 4 },
      },
    });
  }
}

// Helper function to get FontAwesome icon class based on category name
function getCategoryIcon(categoryName) {
  const name = categoryName.toLowerCase();
  
  // Map common category names to FontAwesome icons
  if (name.includes('beverage')) return 'fas fa-glass-whiskey';
  if (name.includes('food') || name.includes('snack')) return 'fas fa-box-open';
  if (name.includes('dairy')) return 'fas fa-cheese';
  if (name.includes('household')) return 'fas fa-home';
  if (name.includes('personal') || name.includes('beauty')) return 'fas fa-pump-soap';
  if (name.includes('clean')) return 'fas fa-spray-can-sparkles';
  if (name.includes('baby')) return 'fas fa-baby';
  if (name.includes('pet')) return 'fas fa-paw';
  if (name.includes('health') || name.includes('wellness')) return 'fas fa-heart-pulse';
  if (name.includes('electronic')) return 'fas fa-plug';
  if (name.includes('clothing') || name.includes('fabric')) return 'fas fa-shirt';
  if (name.includes('stationery') || name.includes('office')) return 'fas fa-pen';
  
  // Default icon for unmatched categories
  return 'fas fa-box';
}

function updateVariantPrice() {
  const quickViewPrice = document.getElementById('quick-view-price');
  const quickViewStock = document.getElementById('quick-view-stock');
  const quickViewAddToCart = document.getElementById('quick-view-add-to-cart');
  const quickViewQuantity = document.getElementById('quick-view-quantity');
  
  // Check for selected variants (dropdowns and color swatches)
  const variantSelects = document.querySelectorAll('.variant-select');
  const colorSwatches = document.querySelectorAll('.color-swatch.selected');
  
  // Try to get selected variant price and stock
  let selectedVariantPrice = null;
  let selectedVariantStock = null;
  
  // Check dropdown selects
  variantSelects.forEach(select => {
    if (select.value) {
      const option = select.options[select.selectedIndex];
      selectedVariantPrice = parseFloat(option.dataset.price);
      selectedVariantStock = parseInt(option.dataset.stock);
    }
  });
  
  // Check color swatches
  if (colorSwatches.length === 1) {
    const colorSwatch = colorSwatches[0];
    selectedVariantPrice = parseFloat(colorSwatch.dataset.price);
    selectedVariantStock = parseInt(colorSwatch.dataset.stock);
  }
  
  // Update price and stock if a variant is selected
  if (selectedVariantPrice !== null) {
    quickViewPrice.textContent = `RWF ${selectedVariantPrice.toLocaleString()}`;
    
    // Update stock and max quantity
    if (selectedVariantStock !== null) {
      quickViewStock.innerHTML = getStockStatus(selectedVariantStock);
      quickViewQuantity.max = selectedVariantStock;
      
      // If current quantity is more than stock, adjust it
      if (parseInt(quickViewQuantity.value) > selectedVariantStock) {
        quickViewQuantity.value = selectedVariantStock;
      }
      
      // Disable add to cart if out of stock
      if (selectedVariantStock <= 0) {
        quickViewAddToCart.disabled = true;
        quickViewAddToCart.classList.add('btn-secondary');
        quickViewAddToCart.classList.remove('btn-primary');
      } else {
        quickViewAddToCart.disabled = false;
        quickViewAddToCart.classList.add('btn-primary');
        quickViewAddToCart.classList.remove('btn-secondary');
      }
    }
  }
}

function setupProductEventListeners() {
  // Add to cart buttons
  document.querySelectorAll('.add-to-cart-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Don't do anything if the button is disabled (out of stock)
      if (this.disabled) return;
      
      const productId = this.dataset.productId;
      const productCard = this.closest('.product-card');
      const quantityInput = productCard.querySelector('.product-quantity');
      
      const quantity = parseInt(quantityInput ? quantityInput.value : 1);
      
      // Find the product in our loaded products array
      const product = currentProducts.find(p => p._id === productId || p.id === productId);
      if (product) {
        addToCart(product, null, quantity);
        
        // Show a brief animation on the button
        this.classList.remove('btn-primary');
        this.classList.add('btn-success');
        this.innerHTML = '<i class="fas fa-check me-1"></i> Added';
        
        setTimeout(() => {
          this.classList.remove('btn-success');
          this.classList.add('btn-primary');
          this.innerHTML = '<i class="fas fa-shopping-cart me-1"></i> Add to Cart';
        }, 1500);
      }
    });
  });
  
  // Quantity decrease buttons
  document.querySelectorAll('.btn-quantity[data-action="decrease"]').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Don't do anything if the button is disabled
      if (this.disabled) return;
      
      const quantityInput = this.nextElementSibling;
      let quantity = parseInt(quantityInput.value);
      if (quantity > 1) {
        quantityInput.value = --quantity;
      }
    });
  });
  
  // Quantity increase buttons
  document.querySelectorAll('.btn-quantity[data-action="increase"]').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Don't do anything if the button is disabled
      if (this.disabled) return;
      
      const quantityInput = this.previousElementSibling;
      let quantity = parseInt(quantityInput.value);
      const max = parseInt(quantityInput.max || 99);
      if (quantity < max) {
        quantityInput.value = ++quantity;
      }
    });
  });
  
  // Wishlist buttons
  document.querySelectorAll('.wishlist-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const icon = this.querySelector('i');
      
      // Toggle wishlist state
      if (icon.classList.contains('far')) {
        icon.classList.remove('far');
        icon.classList.add('fas');
        this.classList.add('active');
        showToast('Product added to wishlist!');
      } else {
        icon.classList.remove('fas');
        icon.classList.add('far');
        this.classList.remove('active');
        showToast('Product removed from wishlist!');
      }
    });
  });
  
  // Product links for quick view
  document.querySelectorAll('.product-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const productId = this.dataset.productId;
      
      // Find the product in our loaded products array
      const product = currentProducts.find(p => p._id === productId || p.id === productId);
      if (product) {
        showQuickView(product);
      }
    });
  });
}

// Update Active Filters Display
function updateActiveFilters() {
  const activeFiltersContainer = document.getElementById('active-filters-container');
  const activeFiltersDiv = document.getElementById('active-filters');
  
  if (!activeFiltersContainer || !activeFiltersDiv) {
    console.error('Active filters container or div not found in the DOM');
    return;
  }
  
  // Clear current filters
  activeFiltersDiv.innerHTML = '';
  
  let hasActiveFilters = false;
  
  // Add category filter if active
  if (currentCategory) {
    hasActiveFilters = true;
    const categoryName = getCategoryNameById(currentCategory);
    console.log(`Adding category filter badge for: ${categoryName} (${currentCategory})`);
    
    activeFiltersDiv.innerHTML += `
      <span class="badge rounded-pill bg-primary d-flex align-items-center">
        <i class="fas fa-tag me-1"></i> ${categoryName}
        <button class="btn-close btn-close-white ms-2" aria-label="Remove filter" 
                onclick="removeFilter('category')"></button>
      </span>
    `;
  }
  
  // Add search term filter if active
  if (currentSearchTerm) {
    hasActiveFilters = true;
    console.log(`Adding search filter badge for: "${currentSearchTerm}"`);
    activeFiltersDiv.innerHTML += `
      <span class="badge rounded-pill bg-info d-flex align-items-center">
        <i class="fas fa-search me-1"></i> "${currentSearchTerm}"
        <button class="btn-close btn-close-white ms-2" aria-label="Remove filter" 
                onclick="removeFilter('search')"></button>
      </span>
    `;
  }
  
  // Add sort filter if active
  if (currentSort) {
    hasActiveFilters = true;
    let sortLabel = 'Sorted';
    
    switch(currentSort) {
      case 'price-asc':
        sortLabel = 'Price: Low to High';
        break;
      case 'price-desc':
        sortLabel = 'Price: High to Low';
        break;
      case 'name-asc':
        sortLabel = 'Name: A to Z';
        break;
      case 'name-desc':
        sortLabel = 'Name: Z to A';
        break;
    }
    
    console.log(`Adding sort filter badge for: ${sortLabel}`);
    activeFiltersDiv.innerHTML += `
      <span class="badge rounded-pill bg-secondary d-flex align-items-center">
        <i class="fas fa-sort me-1"></i> ${sortLabel}
        <button class="btn-close btn-close-white ms-2" aria-label="Remove filter" 
                onclick="removeFilter('sort')"></button>
      </span>
    `;
  }
  
  // Show or hide the filters container
  console.log(`Active filters: ${hasActiveFilters ? 'showing' : 'hiding'}`);
  activeFiltersContainer.style.display = hasActiveFilters ? 'block' : 'none';
}

// Remove specific filter
function removeFilter(filterType) {
  switch(filterType) {
    case 'category':
      currentCategory = '';
      break;
    case 'search':
      currentSearchTerm = '';
      document.getElementById('search-input').value = '';
      break;
    case 'sort':
      currentSort = '';
      break;
  }
  
  currentPage = 1;
  loadProducts();
}

// Make removeFilter available globally
window.removeFilter = removeFilter;

// Helper function to get category name by ID
function getCategoryNameById(categoryId) {
  console.log(`Looking up category name for ID: "${categoryId}"`);
  
  if (!categoryId) {
    console.log('No category ID provided, returning "All Categories"');
    return 'All Categories';
  }
  
  // Try to find category in global categories
  if (window.appCategories && Array.isArray(window.appCategories)) {
    console.log(`Searching in global appCategories array with ${window.appCategories.length} categories`);
    const category = window.appCategories.find(cat => cat._id === categoryId);
    if (category) {
      console.log(`Found category in global array: ${category.name}`);
      return category.name;
    } else {
      console.log(`Category with ID "${categoryId}" not found in global array`);
    }
  } else {
    console.log('Global appCategories array not available or not an array');
  }
  
  // Fallback: Try to find in DOM
  console.log(`Trying to find category in DOM elements with data-category="${categoryId}"`);
  const categoryElement = document.querySelector(`[data-category="${categoryId}"]`);
  if (categoryElement) {
    const spanElement = categoryElement.querySelector('span');
    if (spanElement) {
      console.log(`Found category in DOM with name: ${spanElement.textContent.trim()}`);
      return spanElement.textContent.trim();
    }
    console.log(`Found category element but no span child, using element text: ${categoryElement.textContent.trim()}`);
    return categoryElement.textContent.trim();
  }
  
  console.log(`Category with ID "${categoryId}" not found in DOM, returning default value`);
  return 'Selected Category';
}

// Make showQuickView function available globally
window.showQuickView = showQuickView;

// Add event listeners to the category options
function addCategoryEventListeners() {
  console.log('Adding event listeners to category elements');
  
  // Add event listeners to all category elements
  document.querySelectorAll('[data-category]').forEach(element => {
    // Remove any existing event listeners first
    element.removeEventListener('click', handleCategoryClick);
    
    // Add the event listener
    element.addEventListener('click', handleCategoryClick);
    console.log(`Added click listener to category element:`, element);
  });
  
  // Add special handler for "All Categories" option
  const allCategoriesOption = document.querySelector('[data-category=""]');
  if (allCategoriesOption) {
    // Remove existing listeners first
    allCategoriesOption.removeEventListener('click', handleAllCategoriesClick);
    
    // Add the special handler
    allCategoriesOption.addEventListener('click', handleAllCategoriesClick);
    console.log('Added special handler for "All Categories" option');
  }
}

// Special handler for "All Categories" option
async function handleAllCategoriesClick(e) {
  e.preventDefault();
  e.stopPropagation();
  
  console.log('All Categories option clicked');
  
  // Reset category filter
  currentCategory = '';
  currentPage = 1;
  
  // Update UI
  document.querySelectorAll('[data-category]').forEach(el => {
    el.classList.remove('active');
    
    // Also remove any active classes from parent elements
    const parentListItem = el.closest('li');
    if (parentListItem) {
      parentListItem.classList.remove('active');
    }
  });
  
  // Update dropdown text
  const dropdownButton = document.getElementById('categoryDropdown');
  if (dropdownButton) {
    dropdownButton.innerHTML = '<i class="fas fa-filter me-2"></i>Categories';
  }
  
  // Update category filter in search bar if it exists
  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.value = '';
  }
  
  // Load all products
  await loadProducts();
  
  // Show feedback toast
  showToast('Showing all products');
  
  // Scroll to products section
  document.getElementById('products-section').scrollIntoView({ behavior: 'smooth' });
}

// Back to Top Button
function setupBackToTopButton() {
  const backToTopButton = document.getElementById('back-to-top');
  if (!backToTopButton) return;
  
  // Show button when user scrolls down 300px
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      backToTopButton.classList.add('show');
    } else {
      backToTopButton.classList.remove('show');
    }
  });
  
  // Scroll to top when button is clicked
  backToTopButton.addEventListener('click', function(e) {
    e.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// Add back-to-top button setup to document ready
document.addEventListener('DOMContentLoaded', setupBackToTopButton);

// Set up cart specific event listeners
function setupCartEventListeners() {
  console.log("Setting up cart event listeners");
  
  // Clear cart button
  const clearCartBtn = document.getElementById('clear-cart');
  if (clearCartBtn) {
    console.log("Found clear cart button, adding event listener");
    clearCartBtn.addEventListener('click', function() {
      console.log("Clear cart button clicked");
      clearCart();
    });
  } else {
    console.error("Clear cart button not found");
  }
  
  // Proceed to checkout button
  const proceedToCheckoutBtn = document.getElementById('proceed-to-checkout');
  if (proceedToCheckoutBtn) {
    console.log("Found proceed to checkout button, adding event listener");
    proceedToCheckoutBtn.addEventListener('click', function() {
      console.log("Proceed to checkout button clicked");
      updateCheckoutModal();
    });
  } else {
    console.error("Proceed to checkout button not found");
  }
  
  // Add event listener to cart icon to update cart display when clicked
  const cartIcon = document.querySelector('[data-bs-target="#offcanvasCart"]');
  if (cartIcon) {
    console.log("Found cart icon, adding event listener");
    cartIcon.addEventListener('click', function() {
      console.log("Cart icon clicked, updating display");
      updateCartDisplay();
    });
  } else {
    console.error("Cart icon not found");
  }
}

// Update checkout modal with cart items
function updateCheckoutModal() {
  // Calculate subtotal
  const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  // Fixed delivery fee of 1500 RWF
  const deliveryFee = 1500;
  const total = subtotal + deliveryFee;
  
  // Format with thousand separators
  const formatPrice = (value) => {
    return value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  };
  
  // Update modal summary
  const modalSubtotal = document.getElementById('modal-subtotal');
  const modalTotal = document.getElementById('modal-total');
  const modalDelivery = document.getElementById('modal-delivery');
  
  if (modalSubtotal && modalTotal) {
    modalSubtotal.textContent = `RWF ${formatPrice(subtotal)}`;
    
    if (modalDelivery) {
      modalDelivery.textContent = `RWF ${formatPrice(deliveryFee)}`;
    }
    
    modalTotal.textContent = `RWF ${formatPrice(total)}`;
    
    // Also update order total in complete step
    const orderTotal = document.getElementById('order-total');
    if (orderTotal) {
      orderTotal.textContent = `RWF ${formatPrice(total)}`;
    }
  }
}
