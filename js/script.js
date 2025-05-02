
// Global Variables
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentPage = 1;
const productsPerPage = 8;
let totalProducts = 0;
let currentCategory = '';
let currentSort = '';
let currentSearchTerm = '';


// DOM Content Loaded  
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize cart count
  updateCartCount();
  // Initialize Swiper for category carousel
  initCategoryCarousel();
  // Remove preloader
  removePreloader();
  // Set up all event listeners
  setupEventListeners();
  // Load initial products
  await loadProducts();
  // Initialize checkout process
  setupCheckoutProcess();
  // Initialize cart from localStorage
  cart = JSON.parse(localStorage.getItem('cart')) || [];
  updateCartCount();
  updateCartDisplay(); // Ensure the cart display is updated on load
  // Other initializations...
});


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
  // Category filter
  document.querySelectorAll('.category-option').forEach(option => {
    option.addEventListener('click', handleCategoryClick);
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
}

// Handle Category Click
async function handleCategoryClick(e) {
  e.preventDefault();
  currentCategory = this.getAttribute('data-category');
  currentPage = 1;
  await loadProducts();
  showToast(`Showing ${currentCategory || 'all'} products`);
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
  currentSearchTerm = searchInput.value.trim();
  currentPage = 1;
  await loadProducts();
}

// Reset Filters
async function resetFilters() {
  currentCategory = '';
  currentSort = '';
  currentSearchTerm = '';
  document.getElementById('search-input').value = '';
  currentPage = 1;
  await loadProducts();
  showToast('Filters reset');
}

// Handle Pagination Click
async function handlePaginationClick(e) {
  if (e.target.closest('.page-link')) {
    e.preventDefault();
    const pageLink = e.target.closest('.page-link');
    const targetPage = pageLink.getAttribute('data-page');
    if (targetPage) {
      currentPage = parseInt(targetPage);
      await loadProducts();
      document.getElementById('products-section').scrollIntoView({ behavior: 'smooth' });
    }
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
  // Show loading state
  toggleProductStates(false, false, true);
  try {
    // Build API URL with query parameters
    const url = new URL('/api/products', window.location.origin);
    url.searchParams.append('page', currentPage);
    url.searchParams.append('limit', productsPerPage);
    if (currentCategory) url.searchParams.append('category', currentCategory);
    if (currentSort) url.searchParams.append('sort', currentSort);
    if (currentSearchTerm) url.searchParams.append('search', currentSearchTerm);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    totalProducts = data.total;
    // Clear previous products
    const productsContainer = document.getElementById('products-container');
    if (productsContainer) productsContainer.innerHTML = '';
    if (data.products.length === 0) {
      // Show empty state
      toggleProductStates(false, true, false);
    } else {
      // Display products
      displayProducts(data.products);
      // Show products and pagination if needed
      toggleProductStates(true, false, false);
      generatePagination();
    }
  } catch (error) {
    console.error('Error loading products:', error);
    showErrorLoadingProducts(error);
    toggleProductStates(false, true, false);
  }
}

// Toggle Product States
function toggleProductStates(showProducts, showEmpty, showLoading) {
  const productsContainer = document.getElementById('products-container');
  const emptyContainer = document.getElementById('empty-products');
  const loadingContainer = document.getElementById('loading-products');
  const paginationContainer = document.getElementById('pagination-container');
  if (productsContainer) productsContainer.style.display = showProducts ? 'flex' : 'none';
  if (emptyContainer) emptyContainer.style.display = showEmpty ? 'flex' : 'none';
  if (loadingContainer) loadingContainer.style.display = showLoading ? 'flex' : 'none';
  if (paginationContainer) paginationContainer.style.display = (showProducts && totalProducts > productsPerPage) ? 'block' : 'none';
}

// Display Products
function displayProducts(products) {
  const productsContainer = document.getElementById('products-container');
  if (!productsContainer) return;
  products.forEach(product => {
    const productCard = createProductCard(product);
    productsContainer.appendChild(productCard);
  });
}

// Create Product Card
function createProductCard(product) {
  const productCard = document.createElement('div');
  productCard.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';
  // Format price
  const price = parseFloat(product.price).toFixed(2);
  // Calculate discount if applicable
  const discountHTML = calculateDiscountHTML(product);
  // Stock status
  const stockStatus = getStockStatus(product.stock);
  productCard.innerHTML = `
    <div class="card h-100 border-0 shadow-sm product-card">
      <div class="position-relative overflow-hidden" style="height: 200px;">
        <img src="${product.image || 'images/product-placeholder.jpg'}" 
             class="card-img-top h-100 w-100 object-fit-cover" 
             alt="${product.name}">
        ${discountHTML}
      </div>
      <div class="card-body d-flex flex-column">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge bg-secondary">${product.category}</span>
          ${stockStatus}
        </div>
        <h5 class="card-title">${product.name}</h5>
        <p class="card-text small text-muted mb-3">
          ${product.description?.substring(0, 60) || 'No description available'}${product.description?.length > 60 ? '...' : ''}
        </p>
        <div class="d-flex justify-content-between align-items-center mt-auto">
          <h6 class="fw-bold mb-0">RWF ${price}</h6>
          <button class="btn btn-primary add-to-cart" 
        data-product-id="${product._id}" 
        data-product-name="${product.name}" 
        data-product-price="${product.price}" 
        data-product-img="${product.image || 'images/product-placeholder.jpg'}">
        <i class="fas fa-cart-plus me-1"></i> Add
        </button>
        </div>
      </div>
    </div>
  `;
  return productCard;
}

// Calculate Discount HTML
function calculateDiscountHTML(product) {
  if (product.oldPrice && product.oldPrice > product.price) {
    const oldPrice = parseFloat(product.oldPrice).toFixed(2);
    const discountPercentage = Math.round((1 - product.price / product.oldPrice) * 100);
    return `
      <div class="discount-badge bg-danger text-white position-absolute top-0 end-0 m-2 px-2 py-1 rounded-pill">
        -${discountPercentage}%
      </div>
      <span class="text-decoration-line-through text-muted me-2">$${oldPrice}</span>
    `;
  }
  return '';
}

// Get Stock Status
function getStockStatus(stock) {
  if (stock <= 0) {
    return '<span class="badge bg-danger">Out of Stock</span>';
  } else if (stock < 5) {
    return '<span class="badge bg-warning text-dark">Low Stock</span>';
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
function generatePagination() {
  const paginationContainer = document.getElementById('pagination-container');
  if (!paginationContainer) return;
  const totalPages = Math.ceil(totalProducts / productsPerPage);
  if (totalPages <= 1) {
    paginationContainer.style.display = 'none';
    return;
  }
  let paginationHTML = '';
  // Previous button
  paginationHTML += `
    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
        <span aria-hidden="true">&laquo;</span>
      </a>
    </li>
  `;
  // Page numbers
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  // Adjust if we're near the end
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  // First page and ellipsis
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
  // Pages
  for (let i = startPage; i <= endPage; i++) {
    paginationHTML += `
      <li class="page-item ${i === currentPage ? 'active' : ''}">
        <a class="page-link" href="#" data-page="${i}">${i}</a>
      </li>
    `;
  }
  // Last page and ellipsis
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
  paginationContainer.innerHTML = paginationHTML;
  paginationContainer.style.display = 'block';
}

// Cart Functions
function addToCart(product) {
  const existingItem = cart.find(item => item.id === product.id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push(product);
  }
  saveCart();
  updateCartCount();
  updateCartDisplay();
}

function removeFromCart(productId) {
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
  const cartItemsContainer = document.getElementById('cart-items-container');
  const cartSummary = document.getElementById('cart-summary');
  const emptyCartMessage = document.getElementById('empty-cart-message');

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '';
    emptyCartMessage.style.display = 'block';
    cartSummary.style.display = 'none';
    return;
  }

 
  cartSummary.style.display = 'block';
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
              <button class="btn btn-sm btn-outline-secondary" onclick="updateQuantity('${item.id}', -1)">
                <i class="fas fa-minus"></i>
              </button>
              <span class="mx-2">${item.quantity}</span>
              <button class="btn btn-sm btn-outline-secondary" onclick="updateQuantity('${item.id}', 1)">
                <i class="fas fa-plus"></i>
              </button>
            </div>
            <div class="text-end">
              <span class="fw-bold d-block">RWF ${itemTotal.toFixed(0)}</span>
             
            </div>
          </div>
        </div>
        <button class="btn btn-sm text-danger ms-2" onclick="removeFromCart('${item.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  });

  cartItemsContainer.innerHTML = cartHTML;
  updateCartSummary(subtotal);
}
  



function updateCartSummary(subtotal) {
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;
  document.getElementById('cart-subtotal').textContent = `RWF ${subtotal.toFixed(2)}`;
  document.getElementById('cart-tax').textContent = `RWF ${tax.toFixed(2)}`;
  document.getElementById('cart-total').textContent = `RWF ${total.toFixed(2)}`;
  
  
  // Update modal summary if exists
  const modalSubtotal = document.getElementById('modal-subtotal');
  const modalTax = document.getElementById('modal-tax');
  const modalTotal = document.getElementById('modal-total');
  if (modalSubtotal && modalTax && modalTotal) {
    modalSubtotal.textContent = `RWF ${subtotal.toFixed(2)}`;
    modalTax.textContent = `RWF ${tax.toFixed(2)}`;
    modalTotal.textContent = `RWF ${total.toFixed(2)}`;
  }
}

function updateQuantity(productId, change) {
  const item = cart.find(item => item.id === productId);
  if (item) {
    item.quantity += change;
    if (item.quantity <= 0) {
      removeFromCart(productId);
    } else {
      saveCart();
      updateCartCount();
      updateCartDisplay();
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
      const nextStep = document.getElementById(`step-${nextStepId}`);

      if (this.getAttribute('data-step') === 'confirm') {
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
        document.getElementById('mobile-money-payment').style.display = paymentMethod === 'mobileMoney' ? 'block' : 'none';
        document.getElementById('card-payment').style.display = paymentMethod === 'visaCard' ? 'block' : 'none';
      }

      currentStep.classList.remove('active');
      currentStep.style.display = 'none';
      nextStep.classList.add('active');
      nextStep.style.display = 'block';
    });
  });

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

  // Process payment buttons
  document.getElementById('process-payment-btn')?.addEventListener('click', processMobileMoneyPayment);
  document.getElementById('process-card-payment')?.addEventListener('click', processCardPayment);
  document.getElementById('complete-order-btn')?.addEventListener('click', completeOrder);
}

async function processMobileMoneyPayment() {
  const phoneNumber = document.getElementById('momoPhoneNumber').value;
  
  // Validate phone number format (Rwandan numbers)
  if (!phoneNumber || !/^(78|79|72|73)\d{7}$/.test(phoneNumber)) {
    showToast('Please enter a valid Rwandan phone number (e.g., 78XXXXXXX)', 'error');
    return;
  }

  // Show processing step
  document.getElementById('step-confirm').classList.remove('active');
  document.getElementById('step-confirm').style.display = 'none';
  document.getElementById('step-processing').classList.add('active');
  document.getElementById('step-processing').style.display = 'block';

 try {
  // Send payment request to backend
  const response = await fetch('/api/payments/create-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId: 'user123', // Replace with actual user ID or generate dynamically
      amount: parseFloat(document.getElementById('modal-total').textContent.replace('RWF ', '')),
      phoneNumber: `+250${phoneNumber}`,
      email: 'user@example.com', // Replace with actual user email
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const paymentData = await response.json();
  
  

  // Update order details
  document.getElementById('order-reference').textContent = paymentData.referenceId;
  document.getElementById('order-total').textContent = document.getElementById('modal-total').textContent;
  document.getElementById('order-address').textContent = document.getElementById('address').value;

  try {
    // Save order to database
    await saveOrderToDatabase(paymentData.referenceId);
  } catch (error) {
    console.error('Payment error:', error);

    // Show error message to the user
    showToast(error.message || 'Payment failed. Please try again.', 'error');

    // Go back to the payment step
    document.getElementById('step-processing').classList.remove('active');
    document.getElementById('step-processing').style.display = 'none';
    document.getElementById('step-confirm').classList.add('active');
    document.getElementById('step-confirm').style.display = 'block';
  }
} catch (error) {
  console.error('Error during payment processing:', error);
  showToast('Payment failed. Please try again.', 'error');
}
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

// Initialize checkout process when DOM is loaded
document.addEventListener('DOMContentLoaded', setupCheckoutProcess);
