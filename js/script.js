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

  setupConnectivityCheck();
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
  const productsContainer = document.getElementById('products-container');
  if (!productsContainer) {
    console.error('Products container not found in DOM');
    return;
  }

  productsContainer.addEventListener('click', function(e) {
    const target = e.target;
    
    // Handle add to cart button
    if (target.classList.contains('add-to-cart-btn') || target.closest('.add-to-cart-btn')) {
      console.log('=== ADD TO CART BUTTON CLICKED ===');
      e.preventDefault();
      
      const button = target.classList.contains('add-to-cart-btn') ? target : target.closest('.add-to-cart-btn');
      console.log('Add to cart button:', button);
      
      const productId = button.dataset.productId;
      console.log('Product ID:', productId);
      
      const productCard = button.closest('.product-card');
      console.log('Product card:', productCard);
      
      const quantityInput = productCard.querySelector('.product-quantity');
      console.log('Quantity input:', quantityInput);
      
      const quantity = parseInt(quantityInput ? quantityInput.value : 1);
      console.log('Quantity to add:', quantity);
      
      // Find the product in our loaded products array
      console.log('Searching in currentProducts:', currentProducts);
      const product = currentProducts.find(p => {
        const pId = p._id || p.id;
        console.log(`Comparing product ID ${pId} with clicked ID ${productId}`);
        return pId === productId;
      });
      console.log('Found product:', product);
      
      if (product) {
        addToCart(product, null, quantity);
        
        // Show a brief animation on the button
        button.classList.add('btn-success');
        button.innerHTML = '<i class="fas fa-check me-1"></i> Added';
        
        setTimeout(() => {
          button.classList.remove('btn-success');
          button.innerHTML = '<i class="fas fa-shopping-cart me-1"></i> Add to Cart';
        }, 1500);
      } else {
        console.error('Product not found in currentProducts array');
        console.error('Current products:', currentProducts);
        console.error('Looking for product ID:', productId);
        showToast('Error adding product to cart', 'error');
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
  
  // Initialize quick view modal
  const quickViewModal = document.getElementById('quickViewModal');
  if (quickViewModal) {
    quickViewModal.addEventListener('hidden.bs.modal', function () {
      // Reset modal content when hidden
      const mainImage = document.getElementById('quickview-main-image');
      const thumbnails = document.querySelector('.product-thumbnails');
      const title = document.getElementById('quickview-title');
      const category = document.getElementById('quickview-category');
      const price = document.getElementById('quickview-price');
      const description = document.getElementById('quickview-description');
      const variantsContainer = document.getElementById('quickview-variants');
      const quantity = document.getElementById('quickview-quantity');
      
      if (mainImage) mainImage.src = '';
      if (thumbnails) thumbnails.innerHTML = '';
      if (title) title.textContent = '';
      if (category) category.textContent = '';
      if (price) price.textContent = '';
      if (description) description.textContent = '';
      if (variantsContainer) {
        variantsContainer.style.display = 'none';
        const variantsWrapper = variantsContainer.querySelector('.variants-container');
        if (variantsWrapper) variantsWrapper.innerHTML = '';
      }
      if (quantity) quantity.value = 1;
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
  const searchInput = document.getElementById('search-input');
    const mobileSearchInput = document.getElementById('mobile-search-input');
    const productsSearchInput = document.getElementById('products-search-input');
    
    // Function to handle search
    const handleSearchAction = async (searchTerm) => {
        try {
            currentSearchTerm = searchTerm.trim();
  console.log(`Searching for: "${currentSearchTerm}"`);
  
  // Reset to first page
  currentPage = 1;
  
            // Show loading state
            toggleProductStates(false, false, true);
            
            if (!currentSearchTerm) {
                // If no search term, load all products
                await loadProducts();
                return;
            }
            
            // Use the search endpoint
            const response = await fetch(`/api/products/search?search=${encodeURIComponent(currentSearchTerm)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
  
            if (!data.success) {
                throw new Error(data.message || 'Failed to search products');
            }
            
            // Update products with search results
            currentProducts = data.products;
            
            // Display products and update pagination
            displayProducts(currentProducts);
            generatePagination(data.total);
            
            // Update active filters display
            updateActiveFilters();
            
            // Show products container
            toggleProductStates(true, false, false);
  
            // Show feedback toast
            showToast(`Found ${data.total} products matching "${currentSearchTerm}"`);
            
        } catch (error) {
            console.log('=== ERROR LOADING PRODUCTS ===');
            console.log('Error details:', error);
            showErrorLoadingProducts(error);
            toggleProductStates(false, true, false);
        }
    };
    
    // Sync search inputs and handle search
    const syncSearchInputs = (value, sourceInput) => {
        if (searchInput && searchInput !== sourceInput) searchInput.value = value;
        if (mobileSearchInput && mobileSearchInput !== sourceInput) mobileSearchInput.value = value;
        if (productsSearchInput && productsSearchInput !== sourceInput) productsSearchInput.value = value;
    };
    
    // Add event listeners to search inputs
    [searchInput, mobileSearchInput, productsSearchInput].forEach(input => {
        if (!input) return;
        
        // Handle input changes with debounce
        let debounceTimer;
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            syncSearchInputs(value, input);
            
            // Clear previous timer
            clearTimeout(debounceTimer);
            
            // Set new timer
            debounceTimer = setTimeout(() => {
                handleSearchAction(value);
            }, 300); // 300ms delay
        });
        
        // Handle enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchAction(e.target.value);
            }
        });
    });
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

// Get authentication token from localStorage
function getAuthToken() {
    // Try to get admin token first
    const adminToken = localStorage.getItem('token');
    if (adminToken) {
        return adminToken;
    }
    
    // Try to get customer token if admin token not found
    const customerToken = localStorage.getItem('customerToken');
    if (customerToken) {
        return customerToken;
    }
    
    return null;
}

// Get authentication headers
function getAuthHeaders() {
    const token = getAuthToken();
    return {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
    };
}

// Handle authentication errors
function handleAuthError(error) {
    if (error.message.includes('Authentication required') || error.message.includes('401')) {
        // Redirect to login page
        window.location.href = '/login.html';
    }
    throw error;
}

// Load Products from API
async function loadProducts() {
  try {
    console.log('=== LOADING PRODUCTS ===');
    toggleProductStates(false, false, true);
    
    // Build the API URL with query parameters for filtering
    let apiUrl = '/api/products';
    let needsAuth = true;
    
    // Add query parameters array
    const queryParams = [];
    
    // If search term is provided, use search endpoint
    if (currentSearchTerm) {
      apiUrl = '/api/products/search';
      needsAuth = false; // Search endpoint is public
      queryParams.push(`search=${encodeURIComponent(currentSearchTerm)}`);
    }
    // If a category is selected, use the category-specific endpoint
    else if (currentCategory) {
      console.log(`Category filter active with ID: "${currentCategory}"`);
      apiUrl = `/api/products/category/${currentCategory}`;
      console.log(`Using category-specific endpoint: ${apiUrl}`);
    }
      
    // Add pagination parameters
    queryParams.push(`page=${currentPage}`);
    queryParams.push(`limit=${productsPerPage}`);
      
    // Add query parameters to URL if any exist
    if (queryParams.length > 0) {
      apiUrl += `?${queryParams.join('&')}`;
    }
        
    console.log('Final API URL:', apiUrl);
        
    // Prepare fetch options
    const options = {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };
        
    // Add auth headers only if needed
    if (needsAuth) {
      const token = getAuthToken();
      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }
    }
        
    // Fetch products
    const response = await fetch(apiUrl, options);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Received products data:', data);
        
    // Handle the response data
    if (currentSearchTerm) {
      // Search response includes pagination data
      currentProducts = Array.isArray(data.products) ? data.products : [];
      console.log('Updated currentProducts array with search results:', currentProducts);
      console.log('First product ID:', currentProducts[0]?._id || currentProducts[0]?.id);
      displayProducts(currentProducts);
      generatePagination(data.total);
    } else {
      // Regular response is just an array of products
      currentProducts = Array.isArray(data) ? data : [];
      console.log('Updated currentProducts array with regular results:', currentProducts);
      console.log('First product ID:', currentProducts[0]?._id || currentProducts[0]?.id);
      displayProducts(currentProducts);
      generatePagination(currentProducts.length);
    }
        
    console.log('=== PRODUCTS LOADED SUCCESSFULLY ===');
    console.log('Total products in currentProducts:', currentProducts.length);
    toggleProductStates(true, false, false);
    
  } catch (error) {
    console.log('=== ERROR LOADING PRODUCTS ===');
    console.log('Error details:', error);
    showErrorLoadingProducts(error);
    toggleProductStates(false, true, false);
    currentProducts = []; // Reset currentProducts on error
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
    console.log('Displaying products:', products);
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
  console.log('Creating product card for:', product);
  
  // Create discount tag HTML if there's a discount
  const discountHTML = calculateDiscountHTML(product);
  
  // Stock status label
  const stockStatus = getStockStatus(product.stock);
  
  // Default image if product image is missing
  const productImage = product.image || product.featuredImage || 'images/placeholder.png';
  
  // Determine if item is out of stock
  const isOutOfStock = (product.stock <= 0);
  
  // Get the correct product ID
  const productId = product._id || product.id;
  console.log('Using product ID:', productId);
  
  return `
    <div class="col-lg-4 col-md-6 col-sm-12 mb-4">
      <div class="product-card h-100 position-relative overflow-hidden shadow-sm rounded-4 border">
        ${discountHTML}
        <div class="position-absolute top-0 end-0 p-2">
          <button class="btn btn-sm btn-light rounded-circle shadow-sm wishlist-btn" data-product-id="${productId}">
            <i class="far fa-heart"></i>
          </button>
        </div>

        <div class="product-img text-center p-4">
          <a href="#" class="product-link" data-product-id="${productId}">
            <img src="${productImage}" alt="${product.name}" class="img-fluid product-thumbnail" style="height: 180px; object-fit: contain;">
          </a>
        </div>
        
        <div class="product-details p-3">
          <div class="product-category small text-muted mb-1">${product.category ? product.category.name : 'Uncategorized'}</div>
          <h3 class="product-title fs-6 mb-1 text-truncate">
            <a href="#" class="text-dark product-link" data-product-id="${productId}">${product.name}</a>
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
            <button class="btn ${isOutOfStock ? 'btn-secondary' : 'btn-primary'} btn-sm add-to-cart-btn" data-product-id="${productId}" ${isOutOfStock ? 'disabled' : ''}>
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
  // Determine which price to use - ALWAYS use variant price if a variant is selected
  const price = variant ? variant.price : product.price;
  
  // Create a cart item object with consistent id property
  const cartItem = {
    id: variant ? `${product._id || product.id}-${variant.name}` : (product._id || product.id),
    productId: product._id || product.id,
    name: product.name,
    price: price,
    image: product.featuredImage || product.image || 'images/placeholder.png',
    quantity: quantity,
    category: product.category ? product.category.name : '',
    variant: variant ? {
      name: variant.name,
      combination: variant.combination,
      price: variant.price
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
  const variantText = variant ? ` (${variant.name})` : '';
  showToast(`${product.name}${variantText} added to cart!`, 'success');
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
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-shopping-basket fa-3x text-muted mb-3"></i>
        <h5>Your cart is empty</h5>
        <p class="text-muted">Add some products to your cart</p>
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
          ${item.variant ? `<p class="text-muted small mb-1">Variant: ${item.variant.name}</p>` : ''}
          <p class="text-muted small mb-2">${item.category || 'General'}</p>
          <div class="d-flex justify-content-between align-items-center">
            <div class="quantity-control d-flex align-items-center">
              <button class="btn btn-sm btn-outline-secondary quantity-btn" 
                      data-product-id="${item.id}" 
                      data-change="-1"
                      ${item.quantity <= 1 ? 'disabled' : ''}>
                <i class="fas fa-minus"></i>
              </button>
              <span class="mx-2">${item.quantity}</span>
              <button class="btn btn-sm btn-outline-secondary quantity-btn" 
                      data-product-id="${item.id}" 
                      data-change="1">
                <i class="fas fa-plus"></i>
              </button>
            </div>
            <div class="text-end">
              <div class="fw-bold">${formatPrice(itemTotal)}</div>
              <div class="small text-muted">${formatPrice(item.price)} each</div>
            </div>
          </div>
        </div>
        <button class="btn btn-link text-danger ms-2 remove-item" data-product-id="${item.id}">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  });

  cartItemsContainer.innerHTML = cartHTML;
  updateCartSummary(subtotal);

  // Add event listeners for quantity buttons
  document.querySelectorAll('.quantity-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const productId = e.currentTarget.dataset.productId;
      const change = parseInt(e.currentTarget.dataset.change);
      updateQuantity(productId, change);
    });
  });

  // Add event listeners for remove buttons
  document.querySelectorAll('.remove-item').forEach(button => {
    button.addEventListener('click', (e) => {
      const productId = e.currentTarget.dataset.productId;
      removeFromCart(productId);
    });
  });
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
  const total = subtotal;
  
  // Format with thousand separators
  const formatPrice = (value) => {
    return value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  };
  
  document.getElementById('cart-subtotal').textContent = `RWF ${formatPrice(subtotal)}`;
  document.getElementById('cart-total').textContent = `RWF ${formatPrice(total)}`;
  
  // Update modal summary if exists
  const modalSubtotal = document.getElementById('modal-subtotal');
  const modalTotal = document.getElementById('modal-total');
  const modalDelivery = document.getElementById('modal-delivery');
  
  if (modalSubtotal && modalTotal) {
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
    }, 3000);
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
    
    // Create order object
    const order = {
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

        console.log('Sending order to server:', order);

        // Send order to server with increased timeout
      const response = await fetch('/api/orders', {
        method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(order),
            keepalive: true // Keep the request alive even if the page is unloaded
        });
      
      if (!response.ok) {
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
        const result = await response.json();
      console.log('Order saved successfully:', result);
      
        if (!result.success) {
            throw new Error(result.message || 'Failed to create order');
        }

        // Update UI with order reference
        document.getElementById('order-reference').textContent = result.order.reference;
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
    console.error('Error placing order:', error);
        
        let errorMessage = 'Failed to place order. ';
        if (error.name === 'AbortError') {
            errorMessage += 'Please try again - your order was not lost.';
        } else {
            errorMessage += error.message || 'Please try again.';
        }
        
        showToast(errorMessage, 'error');
    } finally {
    // Reset button state
    placeOrderBtn.disabled = false;
    placeOrderBtn.innerHTML = originalBtnText;
  }
}

// Function to save order to database
async function saveOrderToDatabase(order) {
  try {
        // Send order to server with increased timeout
    const response = await fetch('/api/orders', {
      method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(order),
            keepalive: true // Keep the request alive even if the page is unloaded
    });
    
    if (!response.ok) {
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    
        const result = await response.json();
        console.log('Order saved successfully:', result);
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to create order');
        }
        
        return result;
  } catch (error) {
    console.error('Error saving order:', error);
        handleAuthError(error);
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
  
  // Get modal elements
  const modal = document.getElementById('quickViewModal');
  if (!modal) {
    console.error('Quick view modal not found in DOM');
    return;
  }

  // Initialize modal
  const modalInstance = new bootstrap.Modal(modal);
  
  // Get other modal elements
  const mainImage = document.getElementById('quickview-main-image');
  const thumbnails = document.querySelector('.product-thumbnails');
  const title = document.getElementById('quickview-title');
  const category = document.getElementById('quickview-category');
  const price = document.getElementById('quickview-price');
  const description = document.getElementById('quickview-description');
  const variantsContainer = document.getElementById('quickview-variants');
  const stockStatus = document.getElementById('quickview-stock-status');
  const quantity = document.getElementById('quickview-quantity');
  const addToCartBtn = document.getElementById('quickview-add-to-cart');

  // Verify all required elements exist
  if (!mainImage || !title || !price || !quantity || !addToCartBtn) {
    console.error('Required quick view elements not found');
    return;
  }
  
  // Set basic product info
  title.textContent = product.name;
  if (category) category.textContent = product.category ? product.category.name : '';
  price.textContent = formatPrice(product.price);
  if (description) description.textContent = product.description || 'No description available';
  if (stockStatus) stockStatus.textContent = product.stock > 0 ? 'In Stock' : 'Out of Stock';
  
  // Reset quantity
  quantity.value = 1;
  
  // Track selected variant
  let selectedVariant = null;
  
  // Set main image and thumbnails
  if (product.images && product.images.length > 0) {
    mainImage.src = product.images[0];
    mainImage.alt = product.name;
    
    if (thumbnails) {
      // Clear existing thumbnails
      thumbnails.innerHTML = '';
      
      // Add thumbnails
      product.images.forEach((image, index) => {
        const thumbnail = document.createElement('div');
        thumbnail.className = `thumbnail-item ${index === 0 ? 'active' : ''}`;
        thumbnail.innerHTML = `<img src="${image}" alt="${product.name} - Image ${index + 1}">`;
        
        // Add click handler to switch main image
        thumbnail.addEventListener('click', () => {
          mainImage.src = image;
          mainImage.alt = `${product.name} - Image ${index + 1}`;
          document.querySelectorAll('.thumbnail-item').forEach(t => t.classList.remove('active'));
          thumbnail.classList.add('active');
        });
        
        thumbnails.appendChild(thumbnail);
      });
    }
  } else {
    mainImage.src = product.featuredImage || 'images/placeholder.jpg';
    mainImage.alt = product.name;
    if (thumbnails) thumbnails.innerHTML = '';
  }
  
  // Handle variants
  if (variantsContainer && product.variants && product.variants.length > 0) {
    variantsContainer.style.display = 'block';
    
    // Group variants by their combination attributes
    const variantGroups = {};
    product.variants.forEach(variant => {
      if (variant.combination && variant.combination.length > 0) {
        variant.combination.forEach(comb => {
          if (!variantGroups[comb.attribute]) {
            variantGroups[comb.attribute] = new Set();
          }
          variantGroups[comb.attribute].add(comb.value);
        });
      }
    });
    
    // Clear existing variants
    const variantsWrapper = variantsContainer.querySelector('.variants-container');
    if (variantsWrapper) {
      variantsWrapper.innerHTML = '';
      
      // Create variant selection groups
      Object.entries(variantGroups).forEach(([attribute, values]) => {
        const variantGroup = document.createElement('div');
        variantGroup.className = 'variant-group mb-3';
        variantGroup.innerHTML = `
          <label class="d-block mb-2">${attribute}</label>
          <div class="btn-group flex-wrap" role="group" aria-label="${attribute} variants">
            ${Array.from(values).map(value => `
              <button type="button" class="btn btn-outline-secondary m-1" 
                      data-attribute="${attribute}"
                      data-value="${value}">
                ${value}
              </button>
            `).join('')}
          </div>
        `;
        
        variantsWrapper.appendChild(variantGroup);
      });
      
      // Add variant price table
      const priceTable = document.createElement('div');
      priceTable.className = 'variant-price-table mt-4';
      priceTable.innerHTML = `
        <h6 class="fw-bold mb-3">Available Variants</h6>
        <div class="table-responsive">
          <table class="table table-sm table-bordered">
            <thead class="table-light">
              <tr>
                <th>Variant</th>
                <th class="text-end">Price</th>
              </tr>
            </thead>
            <tbody>
              ${product.variants.map(variant => `
                <tr>
                  <td>${variant.name}</td>
                  <td class="text-end">${formatPrice(variant.price)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      variantsWrapper.appendChild(priceTable);
      
      // Handle variant selection
      const variantButtons = variantsWrapper.querySelectorAll('.btn-group .btn');
      const selectedVariants = new Map();
      
      variantButtons.forEach(button => {
        button.addEventListener('click', () => {
          const attribute = button.dataset.attribute;
          const value = button.dataset.value;
          
          // Toggle active state in this group
          button.closest('.btn-group').querySelectorAll('.btn').forEach(b => {
            b.classList.remove('active');
          });
          button.classList.add('active');
          
          // Update selected variants
          selectedVariants.set(attribute, value);
          
          // Find matching variant
          const matchingVariant = product.variants.find(variant => {
            return variant.combination.every(comb => {
              const selectedValue = selectedVariants.get(comb.attribute);
              return selectedValue === comb.value;
            });
          });
          
          // Update price and selected variant
          if (matchingVariant) {
            price.textContent = formatPrice(matchingVariant.price);
            selectedVariant = matchingVariant;
            addToCartBtn.disabled = false;
          } else {
            price.textContent = formatPrice(product.price);
            selectedVariant = null;
            // Only disable add to cart if we have variants but none selected
            addToCartBtn.disabled = selectedVariants.size > 0;
          }
        });
      });
    }
  } else if (variantsContainer) {
    variantsContainer.style.display = 'none';
    selectedVariant = null;
    addToCartBtn.disabled = false;
  }
  
  // Handle quantity changes
  const decreaseBtn = document.getElementById('quickview-decrease-quantity');
  const increaseBtn = document.getElementById('quickview-increase-quantity');
  
  if (decreaseBtn) {
    decreaseBtn.onclick = () => {
      const currentValue = parseInt(quantity.value) || 1;
      if (currentValue > 1) {
        quantity.value = currentValue - 1;
      }
    };
  }
  
  if (increaseBtn) {
    increaseBtn.onclick = () => {
      const currentValue = parseInt(quantity.value) || 1;
      quantity.value = currentValue + 1;
    };
  }
  
  // Handle add to cart
  const handleAddToCart = () => {
    const quantityValue = parseInt(quantity.value) || 1;
    addToCart(product, selectedVariant, quantityValue);
    modalInstance.hide();
  };

  // Remove old event listener and add new one
  addToCartBtn.removeEventListener('click', handleAddToCart);
  addToCartBtn.addEventListener('click', handleAddToCart);
  
  // Show the modal
  try {
    modalInstance.show();
  } catch (error) {
    console.error('Error showing modal:', error);
    // Try alternative method
    modal.classList.add('show');
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
  }
}

// Helper function to format price
function formatPrice(price) {
    return new Intl.NumberFormat('rw-RW', {
        style: 'currency',
        currency: 'RWF',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

// Load Categories from API
async function loadCategories() {
  try {
    console.log('=== LOADING CATEGORIES ===');
        
        const response = await fetch('/api/categories', {
            headers: getAuthHeaders()
        });
        
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
    }
    
    const categories = await response.json();
        console.log(`Successfully loaded ${categories.length} categories`);
    
        // Update UI with categories
    updateSidebarCategories(categories);
    updateCategoryDropdown(categories);
    updateCategoryCarousel(categories);
    
    console.log('=== CATEGORIES LOADED SUCCESSFULLY ===');
  } catch (error) {
    console.error('=== ERROR LOADING CATEGORIES ===');
    console.error('Error details:', error);
        handleAuthError(error);
        // Handle error appropriately
    showToast('Error loading categories. Please try again later.', 'error');
  }
}

// Update sidebar categories
function updateSidebarCategories(categories) {
  const sidebarMenu = document.querySelector('.offcanvas-body .navbar-nav');
  if (!sidebarMenu) return;
  
  // Clear existing categories first
  sidebarMenu.innerHTML = '';
  
  // Add "All Categories" option first
  const allCategoriesLi = document.createElement('li');
  allCategoriesLi.className = 'nav-item border-dashed';
  allCategoriesLi.innerHTML = `
    <a href="#" class="nav-link d-flex align-items-center gap-3 text-dark p-2" data-category="">
      <i class="fas fa-th-large fa-fw"></i>
      <span>All Categories</span>
    </a>
  `;
  sidebarMenu.appendChild(allCategoriesLi);
  
  // Add each category to the menu
  categories.forEach(category => {
    const li = document.createElement('li');
    li.className = 'nav-item border-dashed';
    
    // Get FontAwesome icon class based on category name
    const iconClass = getCategoryIcon(category.name);
    
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
      e.stopPropagation();
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
            <span class="badge rounded-pill bg-primary d-flex align-items-center me-2 mb-2" data-filter-type="category">
        <i class="fas fa-tag me-1"></i> ${categoryName}
                <button class="btn-close btn-close-white ms-2" aria-label="Remove category filter" 
                onclick="removeFilter('category')"></button>
      </span>
    `;
  }
  
  // Add search term filter if active
  if (currentSearchTerm) {
    hasActiveFilters = true;
    console.log(`Adding search filter badge for: "${currentSearchTerm}"`);
    activeFiltersDiv.innerHTML += `
            <span class="badge rounded-pill bg-info d-flex align-items-center me-2 mb-2" data-filter-type="search">
        <i class="fas fa-search me-1"></i> "${currentSearchTerm}"
                <button class="btn-close btn-close-white ms-2" aria-label="Remove search filter" 
                onclick="removeFilter('search')"></button>
      </span>
    `;
  }
  
  // Add sort filter if active
  if (currentSort) {
    hasActiveFilters = true;
        const sortText = currentSort === 'price-asc' ? 'Price: Low to High' :
                        currentSort === 'price-desc' ? 'Price: High to Low' :
                        currentSort === 'name-asc' ? 'Name: A to Z' :
                        currentSort === 'name-desc' ? 'Name: Z to A' :
                        'Sort';
        
    activeFiltersDiv.innerHTML += `
            <span class="badge rounded-pill bg-secondary d-flex align-items-center me-2 mb-2" data-filter-type="sort">
                <i class="fas fa-sort me-1"></i> ${sortText}
                <button class="btn-close btn-close-white ms-2" aria-label="Remove sort filter" 
                onclick="removeFilter('sort')"></button>
      </span>
    `;
  }
  
    // Show/hide the container based on whether there are active filters
  activeFiltersContainer.style.display = hasActiveFilters ? 'block' : 'none';
    
    // If there are active filters, ensure the container is visible
    if (hasActiveFilters) {
        activeFiltersContainer.classList.remove('d-none');
    }
}

// Remove specific filter
function removeFilter(filterType) {
  switch(filterType) {
    case 'category':
      currentCategory = '';
            // Reset category filter in search bar if it exists
            const categoryFilter = document.getElementById('category-filter');
            if (categoryFilter) {
                categoryFilter.value = '';
            }
            // Reset category dropdown text if it exists
            const categoryDropdown = document.getElementById('categoryDropdown');
            if (categoryDropdown) {
                categoryDropdown.innerHTML = '<i class="fas fa-filter me-2"></i>Categories';
            }
            // Remove active class from all category items
            document.querySelectorAll('[data-category]').forEach(el => {
                el.classList.remove('active');
                const parentListItem = el.closest('li');
                if (parentListItem) {
                    parentListItem.classList.remove('active');
                }
            });
      break;
            
    case 'search':
      currentSearchTerm = '';
            // Clear all search inputs
            ['search-input', 'mobile-search-input', 'products-search-input'].forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    input.value = '';
                }
            });
      break;
            
    case 'sort':
      currentSort = '';
            // Reset sort buttons if they exist
            document.querySelectorAll('.sort-option').forEach(option => {
                option.classList.remove('active');
            });
      break;
  }
  
    // Reset to first page
  currentPage = 1;
    
    // Remove the filter badge from UI
    const filterBadge = document.querySelector(`[data-filter-type="${filterType}"]`);
    if (filterBadge) {
        filterBadge.remove();
    }
    
    // Check if there are any remaining filters
    const activeFiltersDiv = document.getElementById('active-filters');
    if (activeFiltersDiv && !activeFiltersDiv.hasChildNodes()) {
        const container = document.getElementById('active-filters-container');
        if (container) {
            container.style.display = 'none';
        }
    }
    
    // Reload products with updated filters
  loadProducts();
    
    // Show feedback toast
  showToast(`${filterType.charAt(0).toUpperCase() + filterType.slice(1)} filter removed`);
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

function setupConnectivityCheck() {
    const networkIndicator = document.getElementById('network-indicator');
    if (!networkIndicator) return;

    function updateNetworkStatus() {
        if (navigator.onLine) {
            networkIndicator.textContent = '✓ Connected';
            networkIndicator.style.backgroundColor = '#28a745';
            networkIndicator.style.display = 'block';
            setTimeout(() => {
                networkIndicator.style.display = 'none';
            }, 3000);
        } else {
            networkIndicator.textContent = '✕ Offline';
            networkIndicator.style.backgroundColor = '#dc3545';
            networkIndicator.style.display = 'block';
        }
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();

    setInterval(async () => {
        try {
            const response = await fetch(`/api/ping?_=${Date.now()}`, {
                method: 'HEAD',
                cache: 'no-store',
                headers: {
                    ...getAuthHeaders(),
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok && navigator.onLine) {
                networkIndicator.textContent = '! Limited Connectivity';
                networkIndicator.style.backgroundColor = '#ffc107';
                networkIndicator.style.display = 'block';
            } else if (navigator.onLine) {
                updateNetworkStatus();
            }
        } catch (error) {
            if (navigator.onLine) {
                networkIndicator.textContent = '! Limited Connectivity';
                networkIndicator.style.backgroundColor = '#ffc107';
                networkIndicator.style.display = 'block';
            }
        }
    }, 30000);
}

// Add network indicator to the page
document.addEventListener('DOMContentLoaded', function() {
    // Create network indicator
    const networkIndicator = document.createElement('div');
    networkIndicator.id = 'network-indicator';
    networkIndicator.style.cssText = 'position: fixed; bottom: 20px; right: 20px; padding: 8px 16px; border-radius: 4px; z-index: 9999; display: none; transition: all 0.3s ease;';
    document.body.appendChild(networkIndicator);
});
