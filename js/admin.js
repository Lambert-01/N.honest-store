// Image URL patching
(function() {
    // Fix all images function
    function fixAllImages() {
        // Fix all img elements
        document.querySelectorAll('img').forEach(img => {
            if (img.src && img.src.includes('localhost:3000')) {
                const oldSrc = img.src;
                img.src = window.fixImageUrl(img.src);
                console.log(`Fixed existing image: ${oldSrc} -> ${img.src}`);
            }
        });
        
        // Also fix background images in style attributes
        document.querySelectorAll('[style*="localhost:3000"]').forEach(el => {
            const style = el.getAttribute('style');
            if (style && style.includes('localhost:3000')) {
                const newStyle = style.replace(/localhost:3000/g, 'localhost:5000');
                el.setAttribute('style', newStyle);
                console.log(`Fixed style attribute: ${style} -> ${newStyle}`);
            }
        });
    }
    
    // Make fixAllImages globally accessible
    window.fixAllImages = fixAllImages;
    
    // Patch Image.prototype.src to intercept all image loading
    try {
        const originalSrcDescriptor = Object.getOwnPropertyDescriptor(Image.prototype, 'src');
        if (originalSrcDescriptor && originalSrcDescriptor.set) {
            Object.defineProperty(Image.prototype, 'src', {
                get: originalSrcDescriptor.get,
                set: function(url) {
                    if (url) {
                        const fixedUrl = window.fixImageUrl(url);
                        originalSrcDescriptor.set.call(this, fixedUrl);
                    } else {
                        originalSrcDescriptor.set.call(this, url);
                    }
                }
            });
            console.log('Successfully patched Image.prototype.src');
        }
    } catch (e) {
        console.error('Failed to patch Image.prototype.src:', e);
    }
    
    // Patch Element.prototype.innerHTML to fix URLs in HTML content
    try {
        const originalInnerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (originalInnerHTMLDescriptor && originalInnerHTMLDescriptor.set) {
            Object.defineProperty(Element.prototype, 'innerHTML', {
                get: originalInnerHTMLDescriptor.get,
                set: function(html) {
                    if (html && typeof html === 'string' && html.includes('localhost:3000')) {
                        const fixedHtml = html.replace(/https?:\/\/localhost:3000\//g, 'http://localhost:5000/');
                        originalInnerHTMLDescriptor.set.call(this, fixedHtml);
                    } else {
                        originalInnerHTMLDescriptor.set.call(this, html);
                    }
                }
            });
            console.log('Successfully patched Element.prototype.innerHTML');
        }
    } catch (e) {
        console.error('Failed to patch Element.prototype.innerHTML:', e);
    }
    
    // Fix images on page load and after AJAX requests
    window.addEventListener('load', fixAllImages);
    document.addEventListener('DOMContentLoaded', fixAllImages);
    
    // Also run periodically to catch any dynamically added content
    setInterval(fixAllImages, 2000);
    
    // Run immediately if document is already loaded
    if (document.readyState !== 'loading') {
        fixAllImages();
    }
})();

// Fix image URLs function with improved hosting compatibility
window.fixImageUrl = function(url) {
    if (!url) return 'images/placeholder.png'; // Return placeholder for null/undefined URLs
    
    // Handle non-string urls (shouldn't happen, but just in case)
    if (typeof url !== 'string') {
        console.warn('fixImageUrl received non-string URL:', url);
        return 'images/placeholder.png';
    }
    
    // Skip data URLs
    if (url.startsWith('data:')) {
        return url;
    }
    
    // Check for Cloudinary URLs and return them unchanged
    if (url.includes('cloudinary.com') || url.includes('res.cloudinary.com')) {
        console.log('Detected Cloudinary URL, returning as-is:', url);
        return url;
    }
    
    // If the URL is already absolute and valid, return it
    if (url.match(/^https?:\/\/.+/)) {
        return url;
    }
    
    // Get the base URL from environment or use the current origin
    const baseUrl = window.BASE_URL || window.location.origin;
    
    // Handle URLs that are paths without server prefix
    if (url.startsWith('/uploads/')) {
        return `${baseUrl}${url}`;
    }
    
    // Handle paths without leading slash
    if (url.startsWith('uploads/')) {
        return `${baseUrl}/${url}`;
    }
    
    // For any other relative paths, ensure they start with a slash
    if (!url.startsWith('/')) {
        url = `/${url}`;
    }
    
    // Add the base URL
    return `${baseUrl}${url}`;
};

// Add a global image error handler with improved hosting compatibility
document.addEventListener('DOMContentLoaded', function() {
    // Create a map to track failed image loads to prevent infinite retries
    const failedImages = new Map();
    
    // Try to set the BASE_URL from meta tag if available (useful for cPanel)
    const baseUrlMeta = document.querySelector('meta[name="base-url"]');
    if (baseUrlMeta) {
        window.BASE_URL = baseUrlMeta.getAttribute('content');
        console.log('Base URL set from meta tag:', window.BASE_URL);
    }
    
    // Add a global handler for image errors
    document.addEventListener('error', function(e) {
        if (e.target.tagName.toLowerCase() === 'img') {
            const src = e.target.src;
            
            // Skip if this is already the placeholder or if we've tried this image multiple times
            if (src.includes('placeholder.png') || failedImages.has(src)) {
                return;
            }
            
            console.warn('Image failed to load, trying alternative URLs:', src);
            
            // Add to failed images map to prevent retry loops
            failedImages.set(src, true);
            
            // Skip Cloudinary URLs - they should work as-is
            if (src.includes('cloudinary.com') || src.includes('res.cloudinary.com')) {
                console.log('Cloudinary image failed to load, using placeholder:', src);
                e.target.src = 'images/placeholder.png';
                e.target.classList.add('placeholder-image');
                return;
            }
            
            // For product/category images, try different URL formats
            if (src.includes('/uploads/')) {
                // Try with different base URLs
                const pathParts = src.split('/uploads/');
                if (pathParts.length > 1) {
                    const imagePath = pathParts[1];
                    
                    // Try with window.location.origin
                    const altUrl1 = `${window.location.origin}/uploads/${imagePath}`;
                    
                    // Try with BASE_URL if available
                    const altUrl2 = window.BASE_URL ? `${window.BASE_URL}/uploads/${imagePath}` : null;
                    
                    // Try with absolute path from root
                    const altUrl3 = `/uploads/${imagePath}`;
                    
                    console.log('Trying alternative URLs:', { altUrl1, altUrl2, altUrl3 });
                    
                    // Set a timeout to try the first alternative URL
                    setTimeout(() => {
                        if (!failedImages.has(altUrl1)) {
                            e.target.src = altUrl1;
                        }
                    }, 100);
                    
                    // If that fails, try the second alternative after a delay
                    setTimeout(() => {
                        if (altUrl2 && !failedImages.has(altUrl2)) {
                            e.target.src = altUrl2;
                        }
                    }, 300);
                    
                    // If that also fails, try the third alternative after another delay
                    setTimeout(() => {
                        if (!failedImages.has(altUrl3)) {
                            e.target.src = altUrl3;
                        }
                    }, 500);
                    
                    // Only use placeholder as a last resort after all alternatives fail
                    setTimeout(() => {
                        if (e.target.naturalWidth === 0) {
                            e.target.src = 'images/placeholder.png';
                            e.target.classList.add('placeholder-image');
                        }
                    }, 1000);
                    
                    return;
                }
            }
            
            // If all else fails, use placeholder
            e.target.src = 'images/placeholder.png';
            e.target.classList.add('placeholder-image');
        }
    }, true); // Use capture phase to catch all image errors
});

// Check if user is authenticated
function checkAuth() {
    const token = localStorage.getItem('token');
    console.log('Checking auth token:', token ? 'Token exists' : 'No token found');
    
    if (!token) {
        console.warn('No authentication token found. Redirecting to login page.');
        window.location.href = '/login.html';
        return false;
    }
    
    // Validate token expiration if available
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.exp && user.exp < Math.floor(Date.now() / 1000)) {
            console.warn('Token has expired. Redirecting to login page.');
            handleLogout();
            return false;
        }
        
        console.log('User authenticated:', user.username || 'Unknown user');
        return true;
    } catch (error) {
        console.error('Error parsing user data:', error);
        
        // Don't automatically redirect on data parsing errors
        // This prevents logout loops
        return true;
    }
}

// Session timeout management - Auto logout after inactivity
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
let sessionTimeoutId;

function resetSessionTimer() {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(() => {
        console.log('Session timeout: User inactive for too long');
        handleLogout();
    }, SESSION_TIMEOUT);
}

// Initialize session timer
function initSessionManager() {
    // Reset timer on user activity
    ['click', 'keypress', 'scroll', 'mousemove', 'touchstart'].forEach(eventType => {
        document.addEventListener(eventType, resetSessionTimer, false);
    });
    
    // Set initial timer
    resetSessionTimer();
    
    // Handle page visibility changes instead of beforeunload
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            // User switched away from the page, but don't automatically logout
            // Just mark the time they left
            localStorage.setItem('lastPageLeave', Date.now().toString());
        } else if (document.visibilityState === 'visible') {
            // User returned to the page - check if they were gone too long
            const lastLeave = parseInt(localStorage.getItem('lastPageLeave') || '0');
            const now = Date.now();
            const awayTime = now - lastLeave;
            
            // If away more than 30 minutes, logout
            if (lastLeave > 0 && awayTime > SESSION_TIMEOUT) {
                console.log(`User was away for ${Math.round(awayTime/1000/60)} minutes, logging out`);
                showAlert('Your session expired due to inactivity. Please log in again.', 'warning');
                
                // Delay logout to let user see the message
                setTimeout(() => {
                    handleLogout();
                }, 2000);
            } else {
                // They came back in time, reset the timer
                resetSessionTimer();
            }
        }
    });
    
    // Set session as active
    localStorage.setItem('sessionActive', 'true');
    localStorage.setItem('lastActivity', Date.now().toString());
    
    // Start periodic token validation
    startTokenValidation();
}

// Periodically validate token with the server
function startTokenValidation() {
    const TOKEN_VALIDATION_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    // Initial validation
    validateToken();
    
    // Set up interval for periodic validation
    setInterval(validateToken, TOKEN_VALIDATION_INTERVAL);
}

// Validate token with the server
async function validateToken() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('No token found during validation');
            handleLogout();
            return;
        }
        
        const response = await fetch('/api/auth/validate-token', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        // If we get a network error or server is down, don't logout automatically
        if (!response.ok) {
            if (response.status === 401) {
                // Only logout on explicit authentication failures
                console.warn('Token validation failed (401 Unauthorized)');
                handleLogout();
            } else {
                // For other errors (like 500), just log the error but don't logout
                console.warn(`Token validation server error: ${response.status}`);
            }
            return;
        }
        
        const data = await response.json();
        
        // If token is valid but close to expiry, we could refresh it
        if (data.isValid) {
            console.log('Token validated successfully');
            
            // If server sent a refreshed token, update it
            if (data.refreshedToken) {
                localStorage.setItem('token', data.refreshedToken);
                console.log('Token refreshed');
            }
        } else {
            console.warn('Server reported token as invalid');
            handleLogout();
        }
    } catch (error) {
        console.error('Error validating token:', error);
        // Don't auto-logout on network errors to prevent poor user experience
        // when connection drops temporarily
    }
}

// Get authentication headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('No token found when trying to get auth headers');
        return {};
    }
    
    // Log the authorization header being created (without showing the full token)
    const tokenPrefix = token.substring(0, 15) + '...';
    console.log(`Creating Authorization header with token prefix: ${tokenPrefix}`);
    
    return {
        'Authorization': `Bearer ${token}`
    };
}

// Handle logout
function handleLogout() {
    console.log('Handling logout - clearing localStorage');
    
    // Clear authentication data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sessionActive');
    localStorage.removeItem('lastPageLeave');
    
        console.log('Redirecting to login page due to logout');
        window.location.href = '/login.html';
}

// Global Chart instances
let salesChart = null;
let categoryChart = null;
let salesReportChart = null;
let revenueCategoryChart = null;
let inventoryValueChart = null;

// Function to load dashboard data
function loadDashboardData() {
    console.log('Loading dashboard data...');
    
    // Update dashboard statistics
    try {
        // For demonstration, we'll use placeholder data with dashes
        document.querySelector('.revenue h3').textContent = 'RWF ------';
        document.querySelector('.revenue p.card-text').innerHTML = '<i class="fas fa-arrow-up me-1"></i>--% <span class="text-muted">vs last month</span>';
        
        document.querySelector('.orders h3').textContent = '---';
        document.querySelector('.orders p.card-text').innerHTML = '<i class="fas fa-arrow-up me-1"></i>--% <span class="text-muted">vs last month</span>';
        
        document.querySelector('.customers h3').textContent = '----';
        document.querySelector('.customers p.card-text').innerHTML = '<i class="fas fa-arrow-up me-1"></i>--% <span class="text-muted">vs last month</span>';
        
        document.querySelector('.products h3').textContent = '---';
        document.querySelector('.products p.card-text').innerHTML = '<i class="fas fa-arrow-up me-1"></i>--% <span class="text-muted">vs last month</span>';
        
        // Update recent orders table
        const recentOrdersTable = document.getElementById('recent-orders-table');
        if (recentOrdersTable) {
            recentOrdersTable.innerHTML = `
                <tr>
                    <td>#ORD-----</td>
                    <td>------</td>
                    <td>--/--/----</td>
                    <td>RWF ------</td>
                    <td><span class="badge bg-success">Delivered</span></td>
                </tr>
                <tr>
                    <td>#ORD-----</td>
                    <td>------</td>
                    <td>--/--/----</td>
                    <td>RWF ------</td>
                    <td><span class="badge bg-warning">Processing</span></td>
                </tr>
                <tr>
                    <td>#ORD-----</td>
                    <td>------</td>
                    <td>--/--/----</td>
                    <td>RWF ------</td>
                    <td><span class="badge bg-info">Shipped</span></td>
                </tr>
                <tr>
                    <td>#ORD-----</td>
                    <td>------</td>
                    <td>--/--/----</td>
                    <td>RWF ------</td>
                    <td><span class="badge bg-success">Delivered</span></td>
                </tr>
            `;
        }
        
        // Update low stock table
        const lowStockTable = document.getElementById('low-stock-table');
        if (lowStockTable) {
            lowStockTable.innerHTML = `
                <tr>
                    <td>------</td>
                    <td>------</td>
                    <td>-</td>
                    <td><span class="badge bg-danger">Low Stock</span></td>
                </tr>
                <tr>
                    <td>------</td>
                    <td>------</td>
                    <td>-</td>
                    <td><span class="badge bg-warning">Running Low</span></td>
                </tr>
                <tr>
                    <td>------</td>
                    <td>------</td>
                    <td>-</td>
                    <td><span class="badge bg-warning">Running Low</span></td>
                </tr>
                <tr>
                    <td>------</td>
                    <td>------</td>
                    <td>-</td>
                    <td><span class="badge bg-warning">Running Low</span></td>
                </tr>
            `;
        }
        
        console.log('Dashboard data loaded successfully');
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Section Navigation
function initializeNavigation() {
    console.log('Initializing navigation...');
    const sectionLinks = document.querySelectorAll('.section-link');
    const sectionContents = document.querySelectorAll('.section-content');
    const sectionTitle = document.getElementById('section-title');
    const menuToggle = document.getElementById('menu-toggle');
    const wrapper = document.getElementById('wrapper');
    
    // Handle section navigation
    sectionLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get target section ID from data attribute
            const targetSectionId = this.getAttribute('data-section');
            
            // Update active class on links
            sectionLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Update section content visibility
            sectionContents.forEach(section => {
                section.classList.remove('active');
                section.style.display = 'none';
            });
            
            const targetSection = document.getElementById(targetSectionId);
            if (targetSection) {
                targetSection.classList.add('active');
                targetSection.style.display = 'block';
                
                // Update section title
                if (sectionTitle) {
                    sectionTitle.textContent = this.textContent.trim();
                }
                
                // Load section-specific data
                if (targetSectionId === 'dashboard-section') {
                    loadDashboardData();
                    // Re-initialize charts
                    setTimeout(() => {
                        initCharts();
                    }, 100);
                } else if (targetSectionId === 'products-section' && window.productManager) {
                    window.productManager.loadProducts();
                } else if (targetSectionId === 'categories-section' && window.categoryManager) {
                    window.categoryManager.loadCategories();
                } else if (targetSectionId === 'reports-section') {
                    // Re-initialize report charts
                    setTimeout(() => {
                        initCharts();
                    }, 100);
                }
            }
            
            // Close sidebar on mobile after clicking
            if (window.innerWidth < 768) {
                wrapper.classList.remove('toggled');
            }
        });
    });
    
    // Toggle sidebar
    if (menuToggle) {
        menuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            wrapper.classList.toggle('toggled');
        });
    }

    // Initialize sections (hide all except active)
    sectionContents.forEach(section => {
        if (!section.classList.contains('active')) {
            section.style.display = 'none';
        }
    });

    // Set active section based on URL hash if present
    const hash = window.location.hash;
    if (hash) {
        const targetLink = document.querySelector(`.section-link[href="${hash}"]`);
        if (targetLink) {
            targetLink.click();
        }
    }

    console.log('Navigation initialized successfully');
}

// Function to initialize sidebar toggle functionality
function initializeSidebar() {
    const menuToggle = document.getElementById('menu-toggle');
    const wrapper = document.getElementById('wrapper');
    
    if (menuToggle && wrapper) {
        console.log('Setting up sidebar toggle');
        menuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Menu toggle clicked');
            
            // Toggle the sidebar
            if (wrapper.classList.contains('toggled')) {
                wrapper.classList.remove('toggled');
                document.getElementById('sidebar-wrapper').style.marginLeft = '0';
            } else {
                wrapper.classList.add('toggled');
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar-wrapper').style.marginLeft = '-250px';
                }
            }
        });
        
        // Add media query listener for responsive sidebar
        const handleResize = () => {
            if (window.innerWidth <= 768) {
                wrapper.classList.remove('toggled');
                document.getElementById('sidebar-wrapper').style.marginLeft = '-250px';
            } else {
                wrapper.classList.add('toggled');
                document.getElementById('sidebar-wrapper').style.marginLeft = '0';
            }
        };
        
        // Set initial state based on window size
        handleResize();
        
        // Listen for window resize events
        window.addEventListener('resize', handleResize);
    } else {
        console.warn('Menu toggle or wrapper elements not found');
    }
}

// Initialize modals using Bootstrap 5
function initializeModals() {
    console.log('Initializing modals...');
    
    // List of modal IDs to initialize
    const modalIds = [
        'addCategoryModal',
        'editCategoryModal',
        'addProductModal',
        'editProductModal',
        'importProductsModal'
    ];
    
    // Initialize each modal
    modalIds.forEach(modalId => {
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            try {
                const modal = new bootstrap.Modal(modalElement);
                console.log(`Modal initialized: ${modalId}`);
                
                // Handle modal hidden event to reset forms
                modalElement.addEventListener('hidden.bs.modal', function () {
                    const formId = modalId.replace('Modal', '-form');
                    const form = document.getElementById(formId);
                    if (form) {
                        form.reset();
                        form.classList.remove('was-validated');
                        
                        // Reset image previews if applicable
                        if (modalId === 'addCategoryModal') {
                            resetImagePreview('preview-image');
                        } else if (modalId === 'editCategoryModal') {
                            resetImagePreview('edit-preview-image');
                        } else if (modalId === 'addProductModal' || modalId === 'editProductModal') {
                            resetImagePreviews();
                            window.variants = [];
                            updateVariantsTable();
                        }
                    }
                });
            } catch (error) {
                console.error(`Error initializing modal ${modalId}:`, error);
            }
        } else {
            console.warn(`Modal element not found: ${modalId}`);
        }
    });
}

// Use a single form submission handler
function setupProductFormHandler() {
    const productForm = document.getElementById('product-form');
    if (!productForm) {
        console.warn('Product form not found');
        return;
    }

    console.log('Setting up unified product form handler');
    
    // Remove any existing handlers to avoid duplicates
    const clonedForm = productForm.cloneNode(true);
    productForm.parentNode.replaceChild(clonedForm, productForm);
    
    // Set up the new handler
    clonedForm.addEventListener('submit', async function(e) {
            e.preventDefault();
        console.log('Product form submitted - using unified handler');

        // Validate form
        if (!this.checkValidity()) {
            this.classList.add('was-validated');
                return;
            }

        // Disable the submit button
        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
        }

        try {
            // Create FormData from the form
            const formData = new FormData(this);
            
            // Log all form fields for debugging
            console.log('Form data fields:');
            for (const [key, value] of formData.entries()) {
                const valueDisplay = value instanceof File ? 
                    `File: ${value.name} (${value.size} bytes)` : value;
                console.log(`${key}: ${valueDisplay}`);
            }
            
            // Ensure all required fields are present
            const requiredFields = ['name', 'category', 'price'];
            for (const field of requiredFields) {
                if (!formData.get(field) || formData.get(field).trim() === '') {
                    throw new Error(`${field} is required`);
                }
            }

            // Ensure we have the variants in the form data
            // Check for variants-json first (new format)
            const variantsJsonInput = document.getElementById('variants-json');
            if (variantsJsonInput && variantsJsonInput.value) {
                formData.set('variants', variantsJsonInput.value);
                console.log('Set variants from variants-json input:', variantsJsonInput.value.substring(0, 100) + '...');
            } 
            // Fallback to window.variants if available
            else if (window.variants && window.variants.length > 0) {
                console.log('Using window.variants:', window.variants.length, 'items');
                formData.set('variants', JSON.stringify(window.variants));
                console.log('Set variants from window.variants');
            }
            // Fallback to window.productVariants if available
            else if (window.productVariants && window.productVariants.length > 0) {
                console.log('Using window.productVariants:', window.productVariants.length, 'items');
                formData.set('variants', JSON.stringify(window.productVariants));
                console.log('Set variants from window.productVariants');
            }
            // Ensure at least an empty array is set
            else {
                console.log('No variants found, setting empty array');
                formData.set('variants', JSON.stringify([]));
            }
            
            // Log final form data for debugging
            console.log('Final form data before submission:');
            for (const [key, value] of formData.entries()) {
                const valueDisplay = value instanceof File ? 
                    `File: ${value.name} (${value.size} bytes)` : 
                    (key === 'variants' ? `${value.substring(0, 100)}...` : value);
                console.log(`${key}: ${valueDisplay}`);
            }
            
            // Get auth headers but DO NOT set Content-Type
            const headers = getAuthHeaders();
            delete headers['Content-Type']; 
            
            console.log('Sending product data to server...');
            
            // Send request to server
            const response = await fetch('/api/products', {
                        method: 'POST',
                headers: headers,
                body: formData
            });
            
            console.log('Response status:', response.status);
            
            // Parse response
            const data = await response.json();
            console.log('Server response:', data);
                
                if (!response.ok) {
                throw new Error(data.message || 'Error creating product');
                }

                // Show success message
            showAlert('Product added successfully', 'success');

                // Reset form
            this.reset();
            
            // Reset image preview
            resetImagePreviews();
            
            // Reset variants
            window.variants = [];
            if (window.productVariants) window.productVariants = [];
            updateVariantsTable();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addProductModal'));
                    if (modal) {
                        modal.hide();
            }
            
            // Reload products
                if (window.productManager) {
                window.productManager.loadProducts();
                }

            } catch (error) {
            console.error('Error creating product:', error);
            showAlert(error.message || 'Failed to create product', 'danger');
        } finally {
            // Re-enable submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Save Product';
            }
        }
    });
}

// DOM content loaded handler
document.addEventListener("DOMContentLoaded", function() {
    console.log('DOM fully loaded, initializing admin panel...');
    
    // Hide loader when page is fully loaded
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'none';
    }

    // Check authentication first
    if (!checkAuth()) return;
    
    // Initialize session management
    initSessionManager();
    
    // Initialize network status indicator
    initNetworkStatusMonitor();
    
    // Start token validation
    startTokenValidation();
    
    // Initialize navigation and sidebar
    initializeNavigation();
    initializeSidebar();
    
    // Initialize modals
    initializeModals();

    // Initialize Category Manager
    window.categoryManager = new CategoryManager();
    
    // Initialize Product Manager 
    window.productManager = new ProductManager();

    // Add auth status indicator for debugging
    addAuthDebugPanel();

    // Image preview functionality for category image upload
    const categoryImageInput = document.getElementById("category-image");
    if (categoryImageInput) {
        categoryImageInput.addEventListener("change", function() {
            previewImage(this, "preview-image");
        });
    }

    const editCategoryImageInput = document.getElementById("edit-category-image");
    if (editCategoryImageInput) {
        editCategoryImageInput.addEventListener("change", function() {
            previewImage(this, "edit-preview-image");
        });
    }

    // Set up the product form with a single handler
    setupProductFormHandler();
    
    // Set up the category forms
    setupCategoryFormHandler();
    setupEditCategoryFormHandler();

    // Load Categories for Dropdown
    async function loadCategories() {
        try {
            const response = await fetch('/api/categories');
            const categories = await response.json();
            
            const categorySelect = document.querySelector('select[name="category"]');
            categorySelect.innerHTML = '<option value="">Select Category</option>';
            
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category._id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });
        } catch (error) {
            showAlert('Failed to load categories', 'danger');
        }
    }

    // Load Products Table
    async function loadProducts() {
        try {
            const response = await fetch('/api/products');
            const products = await response.json();
            
            const tbody = document.getElementById('products-table-body');
            tbody.innerHTML = '';
            
            products.forEach(product => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <img src="${product.featuredImage || 'placeholder.jpg'}" 
                             class="product-image" alt="${product.name}">
                    </td>
                    <td>
                        <h6 class="mb-1">${product.name}</h6>
                        <small class="text-muted">SKU: ${product.sku}</small>
                        <p class="mb-0 small">${product.description}</p>
                    </td>
                    <td>${product.category?.name || 'Uncategorized'}</td>
                    <td>
                        <div>RWF ${product.price.toFixed(2)}</div>
                        <small class="text-muted">${product.variants?.length || 0} variants</small>
                    </td>
                    <td>
                        <span class="badge bg-${product.status === 'published' ? 'success' : 'warning'}">
                            ${product.status}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="editProduct('${product._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            showAlert('Failed to load products', 'danger');
        }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
        loadCategories();
        loadProducts();
    });

    // Setup logout handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
                handleLogout();
            } catch (error) {
                console.error('Logout error:', error);
                handleLogout(); // Logout anyway
            }
        });
    }

    // Update user profile in UI
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userDropdown = document.querySelector('#navbarDropdown');
    if (userDropdown) {
        if (user.username) {
            userDropdown.querySelector('.fw-bold').textContent = user.username;
        } else {
            userDropdown.querySelector('.fw-bold').textContent = '------';
        }
    }

    // Initialize charts
    initCharts();

    // Expose utility functions globally
    window.previewImage = previewImage;
    window.resetImagePreview = resetImagePreview;
    window.resetImagePreviews = resetImagePreviews;
    window.showAlert = showAlert;
    window.updateVariantsTable = updateVariantsTable;
    window.updateEditVariantsTable = updateEditVariantsTable;
    window.removeEditVariant = removeEditVariant;
    window.addEditVariant = addEditVariant;
    window.showEditVariantEditor = showEditVariantEditor;

    // Patch ProductManager.displayProducts method to fix image URLs
    if (window.ProductManager && ProductManager.prototype.displayProducts) {
        const originalDisplayProducts = ProductManager.prototype.displayProducts;
        ProductManager.prototype.displayProducts = function(products) {
            // Fix image URLs in products
            if (Array.isArray(products)) {
                products.forEach(product => {
                    if (product.featuredImage) {
                        product.featuredImage = window.fixImageUrl(product.featuredImage);
                    }
                    if (Array.isArray(product.images)) {
                        product.images = product.images.map(img => window.fixImageUrl(img));
                    }
                });
            }
            return originalDisplayProducts.call(this, products);
        };
        console.log('Successfully patched ProductManager.displayProducts');
    }

    // Fix form submissions
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            // Prevent default form submission which would cause page reload
            e.preventDefault();
            console.log(`Form submitted: ${form.id}`);
        });
    });

    // Sidebar toggle logic
    const menuToggle = document.getElementById('menu-toggle');
    const wrapper = document.getElementById('wrapper');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sectionLinks = document.querySelectorAll('.section-link');

    function openSidebar() {
        wrapper.classList.add('sidebar-open');
    }
    function closeSidebar() {
        wrapper.classList.remove('sidebar-open');
    }
    function toggleSidebar() {
        wrapper.classList.toggle('sidebar-open');
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            toggleSidebar();
        });
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            closeSidebar();
        });
    }
    // Close sidebar on nav link click (mobile)
    sectionLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth < 992) {
                closeSidebar();
            }
        });
    });

    // Optional: close sidebar on window resize if desktop
    window.addEventListener('resize', function() {
        if (window.innerWidth >= 992) {
            closeSidebar();
        }
    });

    // Profile/Settings dropdown navigation (single source of truth)
    const profileDropdown = document.getElementById('profile-dropdown-item');
    const settingsDropdown = document.getElementById('settings-dropdown-item');
    if (profileDropdown) {
        profileDropdown.addEventListener('click', function(e) {
            e.preventDefault();
            goToSettingsTab('profile');
        });
    }
    if (settingsDropdown) {
        settingsDropdown.addEventListener('click', function(e) {
            e.preventDefault();
            goToSettingsTab('general');
        });
    }
    function goToSettingsTab(tab) {
        // Show settings section
        document.querySelectorAll('.section-content').forEach(s => s.classList.remove('active'));
        const settingsSection = document.getElementById('settings-section');
        settingsSection.classList.add('active');
        // Use Bootstrap's tab API
        const tabBtn = document.getElementById(tab+'-tab');
        if (tabBtn) {
            if (window.bootstrap) {
                const tabInstance = window.bootstrap.Tab.getOrCreateInstance(tabBtn);
                tabInstance.show();
            } else {
                tabBtn.click();
            }
        }
        // Scroll to settings
        settingsSection.scrollIntoView({behavior:'smooth'});
        // Set sidebar active
        document.querySelectorAll('.section-link').forEach(l => l.classList.remove('active'));
        const sidebarLink = document.querySelector('[data-section="settings-section"]');
        if (sidebarLink) sidebarLink.classList.add('active');
        // Close dropdown (if open)
        document.body.click();
    }

    // Notification panel logic (single source of truth)
    const notificationBell = document.getElementById('notification-bell');
    const notificationPanel = document.getElementById('notification-panel');
    const closeNotificationPanel = document.getElementById('close-notification-panel');
    const notificationList = document.getElementById('notification-list');
    function openNotificationPanel() {
        notificationPanel.classList.add('open');
        setTimeout(() => { notificationPanel.focus?.(); }, 100);
    }
    function closeNotificationPanelFn() {
        notificationPanel.classList.remove('open');
    }
    if (notificationBell) {
        notificationBell.addEventListener('click', function(e) {
            e.preventDefault();
            if (notificationPanel.classList.contains('open')) {
                closeNotificationPanelFn();
            } else {
                openNotificationPanel();
            }
        });
    }
    if (closeNotificationPanel) {
        closeNotificationPanel.addEventListener('click', closeNotificationPanelFn);
    }
    // Close on outside click
    document.addEventListener('mousedown', function(e) {
        if (notificationPanel.classList.contains('open') && !notificationPanel.contains(e.target) && e.target.id !== 'notification-bell') {
            closeNotificationPanelFn();
        }
    });
    // Close on Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && notificationPanel.classList.contains('open')) {
            closeNotificationPanelFn();
        }
    });
    // Sample notifications
    if (notificationList) {
        const notifications = [
            {icon:'fa-shopping-cart text-primary', title:'New Order', desc:'Order #1234 placed', time:'2 min ago'},
            {icon:'fa-envelope text-success', title:'New Message', desc:'You have a new support message', time:'10 min ago'},
            {icon:'fa-user-plus text-info', title:'New Subscription', desc:'John Doe subscribed', time:'1 hour ago'},
            {icon:'fa-box-open text-warning', title:'Stock Alert', desc:'Product ABC is low on stock', time:'2 hours ago'},
            {icon:'fa-bell text-danger', title:'System Alert', desc:'Backup needed soon', time:'Yesterday'}
        ];
        notificationList.innerHTML = notifications.map(n => `
            <div class="notification-item">
                <span class="notification-icon"><i class="fas ${n.icon}"></i></span>
                <div class="notification-content">
                    <div class="notification-title">${n.title}</div>
                    <div class="notification-desc small">${n.desc}</div>
                    <div class="notification-time">${n.time}</div>
                </div>
            </div>
        `).join('');
    }
});

// Function to preview image before upload
function previewImage(input, previewId) {
    console.log(`Previewing image for ${previewId}`);
    
    // Check if input exists and has files
    if (!input || !input.files || input.files.length === 0) {
        console.warn('No file selected for preview');
        return;
    }
    
    const preview = document.getElementById(previewId);
    if (!preview) {
        console.error(`Preview element with ID '${previewId}' not found`);
        return;
    }
    
    // Get the preview container safely
    const previewContainer = preview.parentElement;
    
    try {
        const file = input.files[0];
        
        // Check if it's a valid image file
        if (!file.type.match('image.*')) {
            console.error('Not a valid image file');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            if (previewContainer) {
                previewContainer.classList.remove('d-none');
            }
        };
        
        reader.onerror = function(e) {
            console.error('Error reading file:', e);
            preview.src = '#';
            preview.style.display = 'none';
            if (previewContainer) {
                previewContainer.classList.add('d-none');
            }
        };
        
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error in previewImage:', error);
        if (preview) {
            preview.src = '#';
            preview.style.display = 'none';
        }
        if (previewContainer) {
            previewContainer.classList.add('d-none');
        }
    }
}

// Function to reset image preview
function resetImagePreview(previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) {
        console.warn(`Reset image preview: Element with ID '${previewId}' not found`);
        return;
    }
    
    preview.src = '#';
    preview.style.display = 'none';
    
    // Find container - could be direct parent or ancestor with specific class
    const previewContainer = preview.parentElement || 
                            preview.closest('.featured-image-preview, .edit-featured-image-preview');
    
    if (previewContainer) {
        previewContainer.classList.add('d-none');
    }
}

// Function to reset image previews
function resetImagePreviews() {
    console.log('Resetting all image previews');
    
    try {
        // Reset featured image preview
        const featuredPreview = document.querySelector('.featured-image-preview img');
        if (featuredPreview) {
            featuredPreview.src = '#';
            featuredPreview.style.display = 'none';
            const previewContainer = featuredPreview.closest('.featured-image-preview');
            if (previewContainer) {
                previewContainer.classList.add('d-none');
            }
        }
        
        // Reset any additional image previews
        const additionalPreviews = document.querySelectorAll('.additional-images-preview img');
        if (additionalPreviews && additionalPreviews.length > 0) {
            additionalPreviews.forEach(preview => {
                preview.src = '#';
                preview.style.display = 'none';
                const previewContainer = preview.closest('.additional-images-preview');
                if (previewContainer) {
                    previewContainer.classList.add('d-none');
                }
            });
        }
        
        // Also reset any preview elements with data-preview attribute
        document.querySelectorAll('[data-preview]').forEach(input => {
            const previewId = input.getAttribute('data-preview');
            if (previewId) {
                resetImagePreview(previewId);
            }
        });
    } catch (error) {
        console.error('Error in resetImagePreviews:', error);
    }
}

// Category Manager Class
class CategoryManager {
    constructor() {
        this.loadCategories();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const searchInput = document.getElementById('category-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        const statusFilter = document.getElementById('category-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => this.handleFilter(e.target.value));
        }

        const refreshBtn = document.getElementById('refresh-categories');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadCategories());
        }
        
        // Add recalculate counts button if it exists
        const recalculateBtn = document.getElementById('recalculate-category-counts');
        if (recalculateBtn) {
            recalculateBtn.addEventListener('click', () => this.recalculateProductCounts());
        } else {
            // If button doesn't exist, try to add it to the categories toolbar
            const toolbar = document.querySelector('.categories-toolbar');
            if (toolbar) {
                const recalculateButton = document.createElement('button');
                recalculateButton.id = 'recalculate-category-counts';
                recalculateButton.className = 'btn btn-sm btn-secondary ms-2';
                recalculateButton.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Update Counts';
                recalculateButton.addEventListener('click', () => this.recalculateProductCounts());
                toolbar.appendChild(recalculateButton);
            }
        }
    }
    
    // Method to recalculate product counts for all categories
    async recalculateProductCounts() {
        try {
            showAlert('Recalculating product counts...', 'info', true);
            
            const response = await fetch('/api/categories/recalculate-counts', {
                method: 'POST',
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error: ${response.status}`);
            }
            
            const result = await response.json();
            showAlert(result.message || 'Product counts updated successfully', 'success');
            
            // Reload categories to show updated counts
            await this.loadCategories();
            
        } catch (error) {
            console.error('Error recalculating product counts:', error);
            showAlert('Failed to update product counts: ' + error.message, 'danger');
        }
    }

    async loadCategories() {
        try {
            console.log('Loading categories...');
            showAlert('Loading categories...', 'info', true);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            const response = await fetch('/api/categories', {
                headers: getAuthHeaders(),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                let errorMessage;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || `Server error: ${response.status}`;
                } catch (e) {
                    errorMessage = `Server error: ${response.status}`;
                }
                throw new Error(errorMessage);
            }
            
            const categories = await response.json();
            console.log('Categories loaded:', categories);
            
            // Clear any loading alerts
            document.querySelectorAll('.alert-info').forEach(alert => alert.remove());
            
            this.displayCategories(categories);

            // Also update category dropdowns in product forms
            this.updateCategoryDropdowns(categories);
        } catch (error) {
            console.error('Error loading categories:', error);
            
            // Clear any loading alerts
            document.querySelectorAll('.alert-info').forEach(alert => alert.remove());
            
            if (error.message.includes('Please authenticate')) {
                handleLogout();
            } else {
                showAlert('Failed to load categories: ' + error.message, 'danger');
            }
        }
    }

    updateCategoryDropdowns(categories) {
        // Update category dropdowns in product forms
        const dropdowns = [
            document.querySelector('select[name="category"]'),
            document.getElementById('edit-product-category'),
            document.getElementById('category-filter')
        ];

        dropdowns.forEach(dropdown => {
            if (dropdown) {
                // Save current selection if it exists
                const currentValue = dropdown.value;
                
                dropdown.innerHTML = `
                    <option value="">Select Category</option>
                    ${categories.map(category => `
                        <option value="${category._id}">${category.name}</option>
                    `).join('')}
                `;
                
                // Restore selection if it still exists in the new options
                if (currentValue) {
                    const option = dropdown.querySelector(`option[value="${currentValue}"]`);
                    if (option) {
                        dropdown.value = currentValue;
                    }
                }
            }
        });
    }

    displayCategories(categories) {
        const tbody = document.getElementById('categories-table-body');
        if (!tbody) return;

        console.log('Categories to display:', categories.length);

        if (!categories || categories.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">No categories found</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = categories.map(category => {
            // Safe image URL handling
            let imageUrl = 'images/placeholder.png';
            
            if (category.image) {
                // Use fixImageUrl if available, otherwise handle URL processing manually
                imageUrl = window.fixImageUrl ? 
                    window.fixImageUrl(category.image) : 
                    category.image;
            }

            // Get product count safely, defaulting to 0 if not available
            const productCount = typeof category.products === 'number' ? category.products : 0;

            return `
            <tr data-id="${category._id}" class="category-row">
                <td>
                    <img src="${imageUrl}" 
                         alt="${category.name}" 
                         class="img-thumbnail" 
                         onerror="this.src='images/placeholder.png'"
                         style="max-width: 50px; max-height: 50px;">
                </td>
                <td>${category.name}</td>
                <td>${category.description || '-'}</td>
                <td>${productCount}</td>
                <td>
                    <span class="badge bg-${category.status === 'active' ? 'success' : 'danger'}">
                        ${category.status}
                    </span>
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary edit-category-btn" data-id="${category._id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-category-btn" data-id="${category._id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');
        
        // Add event listeners to the buttons - Fix: Use proper binding to preserve 'this' context
        const self = this; // Store reference to 'this' for use in event handlers
        document.querySelectorAll('.edit-category-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const categoryId = this.getAttribute('data-id');
                console.log('Edit button clicked for category ID:', categoryId);
                self.editCategory(categoryId);
            });
        });
        
        document.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const categoryId = this.getAttribute('data-id');
                console.log('Delete button clicked for category ID:', categoryId);
                self.deleteCategory(categoryId);
            });
        });
    }

    handleSearch(searchTerm) {
        const rows = document.querySelectorAll('#categories-table-body tr');
        searchTerm = searchTerm.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    handleFilter(status) {
        const rows = document.querySelectorAll('#categories-table-body tr');
        
        rows.forEach(row => {
            if (!status) {
                row.style.display = '';
                return;
            }
            const rowStatus = row.querySelector('.badge')?.textContent.toLowerCase();
            row.style.display = rowStatus === status.toLowerCase() ? '' : 'none';
        });
    }

    async deleteCategory(id) {
        try {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            });

            if (!result.isConfirmed) return;
            
            // Show loading
            const categoryRow = document.querySelector(`.category-row[data-id="${id}"]`);
            if (categoryRow) {
                categoryRow.classList.add('table-warning');
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const response = await fetch(`/api/categories/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorMessage;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || `Server error: ${response.status}`;
                } catch (e) {
                    errorMessage = `Server error: ${response.status}`;
                }
                throw new Error(errorMessage);
            }

            showAlert('Category deleted successfully', 'success');
            await this.loadCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
            showAlert('Failed to delete category: ' + error.message, 'danger');
        }
    }

    async editCategory(id) {
        try {
            showAlert('Loading category details...', 'info', true);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const response = await fetch(`/api/categories/${id}`, {
                headers: getAuthHeaders(),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Clear the loading alert
            document.querySelectorAll('.alert-info').forEach(alert => alert.remove());
            
            if (!response.ok) {
                let errorMessage;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || `Server error: ${response.status}`;
                } catch (e) {
                    errorMessage = `Server error: ${response.status}`;
                }
                throw new Error(errorMessage);
            }
            
            const category = await response.json();
            
            // Fill the edit form with category data
            document.getElementById('edit-category-id').value = category._id;
            document.getElementById('edit-category-name').value = category.name;
            document.getElementById('edit-category-description').value = category.description || '';
            document.getElementById('edit-category-status').value = category.status;
            
            // Set current image if exists
            const currentImageContainer = document.querySelector('.current-image-container');
            const currentImage = document.getElementById('current-category-image');
            
            if (category.image) {
                const imageUrl = window.fixImageUrl ? 
                    window.fixImageUrl(category.image) : 
                    category.image;
                
                currentImage.src = imageUrl;
                currentImage.onError = () => {
                    currentImage.src = 'images/placeholder.png';
                };
                currentImageContainer.classList.remove('d-none');
            } else {
                currentImageContainer.classList.add('d-none');
            }
            
            // Reset new image preview
            resetImagePreview('edit-preview-image');
            
            // Show the modal
            const editModal = new bootstrap.Modal(document.getElementById('editCategoryModal'));
            editModal.show();
            
        } catch (error) {
            console.error('Error loading category details:', error);
            showAlert('Failed to load category details: ' + error.message, 'danger');
        }
    }
}

// Product Manager Class
class ProductManager {
    constructor() {
        this.products = [];
        this.baseUrl = window.location.origin;
        this.loadProducts();
        this.setupImageHandling();
        this.initializeEventListeners();
        this.loadCategories();
    }
    
    initializeEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('product-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                // Clear any existing timeout
                if (this.searchTimeout) {
                    clearTimeout(this.searchTimeout);
                }
                // Add debounce to avoid too many searches while typing
                this.searchTimeout = setTimeout(() => {
                    this.handleSearch(e.target.value);
                }, 300);
            });
        }

        // Category filter functionality
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => this.handleFilter(e.target.value));
        }

        // Refresh button
        const refreshBtn = document.getElementById('refresh-products');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadProducts());
        }
    }

    handleSearch(searchTerm) {
        if (!this.products) {
            console.warn('No products loaded to search through');
            return;
        }

        if (!searchTerm) {
            this.displayProducts(this.products);
            return;
        }
        
        searchTerm = searchTerm.toLowerCase().trim();
        const filteredProducts = this.products.filter(product => {
            // Search in product name
            if (product.name?.toLowerCase().includes(searchTerm)) return true;
            
            // Search in product SKU
            if (product.sku?.toLowerCase().includes(searchTerm)) return true;
            
            // Search in category name
            if (product.category?.name?.toLowerCase().includes(searchTerm)) return true;
            
            // Search in price (convert price to string for searching)
            if (product.price?.toString().includes(searchTerm)) return true;
            
            // Search in status
            if (product.status?.toLowerCase().includes(searchTerm)) return true;
            
            // Search in variants
            if (product.variants?.some(variant => 
                variant.name?.toLowerCase().includes(searchTerm) || 
                variant.price?.toString().includes(searchTerm)
            )) return true;
            
            return false;
        });
        
        // Show message if no results found
        if (filteredProducts.length === 0) {
            const tbody = document.getElementById('products-table-body');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-4">
                            <div class="text-muted">
                                <i class="fas fa-search fa-2x mb-3"></i>
                                <p class="mb-0">No products found matching "${searchTerm}"</p>
                            </div>
                        </td>
                    </tr>
                `;
            }
            return;
        }
        
        // Display filtered products
        this.displayProducts(filteredProducts);
    }

    setupImageHandling() {
        console.log('Setting up image handling for product manager');
        
        // Handle product image upload with compression
        const featuredImageInput = document.getElementById('featuredImage');
        if (featuredImageInput) {
            featuredImageInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                console.log(`Product image selected: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
                
                // Show preview container
                const previewContainer = document.querySelector('.featured-image-preview');
                const previewImg = document.getElementById('product-preview-image');
                
                if (previewContainer) {
                    previewContainer.classList.remove('d-none');
                }
                
                // Set loading state
                if (previewImg) {
                    previewImg.alt = 'Loading...';
                    previewImg.style.opacity = '0.5';
                }
                
                try {
                    // Create preview directly from original file for now
                        this.createImagePreview(file, previewImg);
                    if (previewImg) {
                        previewImg.style.opacity = '1';
                    }
                } catch (error) {
                    console.error('Error processing product image:', error);
                    if (previewImg) {
                        previewImg.src = '#';
                        previewImg.alt = 'Error loading image';
                    }
                    if (previewContainer) {
                        previewContainer.classList.add('d-none');
                    }
                    
                    // Alert user
                    showAlert('Error processing image. Please try a smaller image.', 'danger');
                }
            });
        }
    }
    
    // Setup bulk actions functionality
    setupBulkActions() {
        const bulkActivateBtn = document.getElementById('bulk-activate');
        const bulkDeactivateBtn = document.getElementById('bulk-deactivate');
        const bulkDeleteBtn = document.getElementById('bulk-delete');
        
        if (bulkActivateBtn) {
            bulkActivateBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleBulkStatusChange('active');
            });
        }
        
        if (bulkDeactivateBtn) {
            bulkDeactivateBtn.addEventListener('click', (e) => {
        e.preventDefault();
                this.handleBulkStatusChange('inactive');
            });
        }
        
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleBulkDelete();
            });
        }
    }
    
    // Handle bulk status changes (activate/deactivate)
    async handleBulkStatusChange(status) {
        const selectedIds = this.getSelectedProductIds();
        
        if (selectedIds.length === 0) {
            showAlert('No products selected', 'warning');
            return;
        }
        
        const confirmResult = await Swal.fire({
            title: `${status === 'active' ? 'Activate' : 'Deactivate'} Products?`,
            text: `Are you sure you want to ${status === 'active' ? 'activate' : 'deactivate'} ${selectedIds.length} selected products?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: `Yes, ${status === 'active' ? 'activate' : 'deactivate'} them!`,
            cancelButtonText: 'Cancel'
        });
        
        if (!confirmResult.isConfirmed) return;
        
        showAlert(`Updating ${selectedIds.length} products...`, 'info', true);
        
        try {
            // Here you would make an API call to update the products
            console.log(`Changing ${selectedIds.length} products to status: ${status}`);
            
            // For now, just reload the products
            setTimeout(() => {
                showAlert(`${selectedIds.length} products ${status === 'active' ? 'activated' : 'deactivated'} successfully`, 'success');
                this.loadProducts();
            }, 1000);
        } catch (error) {
            console.error('Error changing product status:', error);
            showAlert('Failed to update products', 'danger');
        }
    }
    
    // Handle bulk delete
    async handleBulkDelete() {
        const selectedIds = this.getSelectedProductIds();
        
        if (selectedIds.length === 0) {
            showAlert('No products selected', 'warning');
            return;
        }
        
        const confirmResult = await Swal.fire({
            title: 'Delete Products?',
            text: `Are you sure you want to delete ${selectedIds.length} selected products? This action cannot be undone!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            confirmButtonText: 'Yes, delete them!',
            cancelButtonText: 'Cancel'
        });
        
        if (!confirmResult.isConfirmed) return;
        
        showAlert(`Deleting ${selectedIds.length} products...`, 'info', true);
        
        try {
            // Here you would make an API call to delete the products
            console.log(`Deleting ${selectedIds.length} products`);
            
            // For now, just reload the products
            setTimeout(() => {
                showAlert(`${selectedIds.length} products deleted successfully`, 'success');
                this.loadProducts();
            }, 1000);
        } catch (error) {
            console.error('Error deleting products:', error);
            showAlert('Failed to delete products', 'danger');
        }
    }
    
    // Helper to get selected product IDs
    getSelectedProductIds() {
        const checkboxes = document.querySelectorAll('.product-checkbox:checked');
        return Array.from(checkboxes).map(checkbox => checkbox.value);
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/categories', {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch categories');
            }
            
            const categories = await response.json();
            console.log('Categories loaded:', categories.length);
            this.populateCategoryDropdowns(categories);
        } catch (error) {
            console.error('Error loading categories:', error);
            if (error.message.includes('Please authenticate')) {
                handleLogout();
            }
        }
    }

    populateCategoryDropdowns(categories) {
        if (!categories || categories.length === 0) return;
        
        // Populate category filter dropdown
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.innerHTML = `
                <option value="">All Categories</option>
                ${categories.map(category => `
                    <option value="${category._id}">${category.name}</option>
                `).join('')}
            `;
        }

        // Populate category select in add product form
        const categorySelect = document.getElementById('category');
        if (categorySelect) {
            categorySelect.innerHTML = `
                <option value="">Select Category</option>
                ${categories.map(category => `
                    <option value="${category._id}">${category.name}</option>
                `).join('')}
            `;
        }
    }

    async loadProducts() {
        try {
            // Show loading state
            const tbody = document.getElementById('products-table-body');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </td>
                    </tr>
                `;
            }
            
            const response = await fetch('/api/products', {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch products');
            }
            
            const products = await response.json();
            console.log('Products loaded:', products.length);
            this.products = products;
            this.displayProducts(products);
        } catch (error) {
            console.error('Error loading products:', error);
            if (error.message.includes('Please authenticate')) {
                handleLogout();
            } else {
                showAlert('Failed to load products: ' + error.message, 'danger');
            }
        }
    }

    displayProducts(products) {
        const tbody = document.getElementById('products-table-body');
        if (!tbody) return;

        if (!products || products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-4">
                        <div class="text-muted">
                            <i class="fas fa-box-open fa-2x mb-3"></i>
                            <p class="mb-0">No products found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = products.map(product => {
            const imageUrl = window.fixImageUrl ? 
                window.fixImageUrl(product.featuredImage) : 
                (product.featuredImage || 'images/placeholder.png');
            
            const formattedPrice = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'RWF',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(product.price);
            
            const variantCount = product.variants && Array.isArray(product.variants) ? 
                product.variants.length : 0;
                
            return `
            <tr data-product-id="${product._id}">
                <td class="text-center">
                    <div class="form-check">
                        <input class="form-check-input product-checkbox" type="checkbox" value="${product._id}">
                    </div>
                </td>
                <td>
                    <div class="product-image-container">
                        ${product.featuredImage ? 
                              `<img src="${imageUrl}" 
                                   alt="${product.name}" 
                                   class="product-thumbnail" 
                               onerror="this.src='images/placeholder.png'">` : 
                          `<div class="placeholder-image bg-light d-flex align-items-center justify-content-center" 
                                style="width: 60px; height: 60px; border-radius: 4px;">
                                 <i class="fas fa-image text-muted"></i>
                               </div>`
                            }
                        </div>
                </td>
                <td>
                    <div class="d-flex flex-column">
                        <h6 class="mb-1 text-dark">${product.name}</h6>
                    </div>
                </td>
                <td>
                    <span class="badge bg-light text-dark">
                        ${product.category && typeof product.category === 'object' ? 
                            product.category.name : 'Uncategorized'}
                    </span>
                </td>
                <td class="text-end fw-bold">${formattedPrice}</td>
                <td class="text-center">
                    ${variantCount > 0 ? 
                        `<span class="badge bg-info">${variantCount}</span>` : 
                        '-'
                    }
                </td>
                <td class="text-center">
                    <span class="badge ${product.status === 'active' ? 'bg-success' : 'bg-warning'}">
                        ${product.status || 'active'}
                    </span>
                </td>
                <td class="text-end">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary edit-product-btn" data-product-id="${product._id}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-product-btn" data-product-id="${product._id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');
        
        // Add event listeners for edit and delete buttons
        const self = this;
        tbody.querySelectorAll('.edit-product-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const productId = this.getAttribute('data-product-id');
                self.editProduct(productId);
            });
        });
        
        tbody.querySelectorAll('.delete-product-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const productId = this.getAttribute('data-product-id');
                self.deleteProduct(productId);
                });
            });
    }

    handleFilter(categoryId) {
            if (!categoryId) {
            this.displayProducts(this.products);
                return;
            }
            
        const filteredProducts = this.products.filter(product => {
            if (!product.category) return false;
            
            // Check if category is an object with _id or just an id string
            const productCategoryId = typeof product.category === 'object' ? 
                product.category._id : product.category;
            
            return productCategoryId === categoryId;
        });
        
        this.displayProducts(filteredProducts);
    }

    async deleteProduct(id) {
        try {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            });

            if (!result.isConfirmed) return;

            const response = await fetch(`/api/products/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete product');
            }

            showAlert('Product deleted successfully', 'success');
            this.loadProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            showAlert(`Failed to delete product: ${error.message}`, 'danger');
        }
    }

    
async editProduct(id) {
    console.log(`Editing product with ID: ${id}`);
    try {
        // Show loading indicator
        showAlert('Loading product data...', 'info', 1000);
        
        // Fetch product details from the server
        const response = await fetch(`/api/products/${id}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch product data: ${response.status}`);
        }
        
        const product = await response.json();
        console.log('Product data loaded:', product);
        
        // Populate the edit form with product data
        const editForm = document.getElementById('edit-product-form');
        if (!editForm) {
            throw new Error('Edit product form not found');
        }
        
        // Check if the hidden input exists
        const productIdInput = document.getElementById('edit-product-id');
        if (!productIdInput) {
            throw new Error('Edit product ID input not found');
        }
        
        // Set hidden product ID field
        productIdInput.value = product._id;
        
        // Set basic product fields
        const nameInput = document.getElementById('edit-name');
        if (!nameInput) {
            throw new Error('Edit name input not found');
        }
        nameInput.value = product.name || '';
        
        const priceInput = document.getElementById('edit-price');
        if (!priceInput) {
            throw new Error('Edit price input not found');
        }
        priceInput.value = product.price || '';
        
        const statusSelect = document.getElementById('edit-status');
        if (!statusSelect) {
            throw new Error('Edit status select not found');
        }
        statusSelect.value = product.status || 'active';
        
        // Set category dropdown
        const categorySelect = document.getElementById('edit-category');
        if (categorySelect) {
            // If category is not in the list, fetch and update categories
            if (!Array.from(categorySelect.options).some(option => option.value === product.category)) {
                await this.loadCategoriesForDropdown(categorySelect);
            }
            categorySelect.value = product.category;
        }
        
        // Clear previous image previews
        resetImagePreviews('edit-product-images-preview');
        
        // Display existing product images
        const previewContainer = document.getElementById('edit-product-images-preview');
        if (previewContainer) {
            if (product.featuredImage) {
                const img = document.getElementById('edit-product-preview-image');
                img.src = product.featuredImage;
                img.style.display = 'block';
                    }
        }
        
        // Set up variants
        if (product.variants && product.variants.length > 0) {
            // Store variants in global variable for later use
            window.editProductVariants = [...product.variants];
            // Update variants table in the UI
            updateEditVariantsTable();
        } else {
            window.editProductVariants = [];
            document.getElementById('edit-variants-table').querySelector('tbody').innerHTML = 
                '<tr><td colspan="3" class="text-center">No variants defined</td></tr>';
        }
        
        // Update hidden field for variants
        document.getElementById('edit-variants-json').value = JSON.stringify(window.editProductVariants || []);
        
        // Show the edit modal
        const editModal = new bootstrap.Modal(document.getElementById('editProductModal'));
        editModal.show();
        
        // Set up form submission handler if not already set
        if (!editForm.dataset.handlerAttached) {
            editForm.addEventListener('submit', this.handleEditProductSubmit.bind(this));
            editForm.dataset.handlerAttached = 'true';
        }
    } catch (error) {
        console.error('Error editing product:', error);
        showAlert(error.message || 'Failed to load product data', 'danger');
    }
}


    // Helper method to load categories for dropdown
    async loadCategoriesForDropdown(selectElement) {
        try {
            const response = await fetch('/api/categories', {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch categories');
            }
            
            const categories = await response.json();
            
            // Clear existing options except the first one (if it's a placeholder)
            const firstOption = selectElement.options[0];
            selectElement.innerHTML = '';
            
            if (firstOption && firstOption.value === '') {
                selectElement.appendChild(firstOption);
            }
            
            // Add categories as options
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category._id;
                option.textContent = category.name;
                selectElement.appendChild(option);
            });
            
            return categories;
        } catch (error) {
            console.error('Error loading categories for dropdown:', error);
            return [];
        }
    }
    
    // Handler for edit product form submission
    async handleEditProductSubmit(e) {
        e.preventDefault();
        console.log('Edit product form submitted');
        
        // Validate form
        if (!e.target.checkValidity()) {
            e.target.classList.add('was-validated');
            return;
        }
        
        // Disable the submit button
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
        }
        
        try {
            // Get product ID
            const productId = e.target.querySelector('#edit-product-id').value;
            if (!productId) {
                throw new Error('Product ID is missing');
            }
            
            // Create FormData from the form
            const formData = new FormData(e.target);
            
            // Add existing images data
            const existingImagesField = document.getElementById('edit-existing-images');
            if (existingImagesField && existingImagesField.value) {
                formData.set('existingImages', existingImagesField.value);
            }
            
            // Ensure we have the variants in the form data
            // Check for edit-variants-json first
            const variantsJsonInput = document.getElementById('edit-variants-json');
            if (variantsJsonInput && variantsJsonInput.value) {
                formData.set('variants', variantsJsonInput.value);
            } 
            // Fallback to window.editProductVariants if available
            else if (window.editProductVariants) {
                formData.set('variants', JSON.stringify(window.editProductVariants));
            }
            // Ensure at least an empty array is set
            else {
                formData.set('variants', JSON.stringify([]));
            }
            
            // Log form data for debugging
            console.log('Edit product form data:');
            for (const [key, value] of formData.entries()) {
                const valueDisplay = value instanceof File ? 
                    `File: ${value.name} (${value.size} bytes)` : 
                    (key === 'variants' || key === 'existingImages' ? 
                        `${value.substring(0, 50)}...` : value);
                console.log(`${key}: ${valueDisplay}`);
            }
            
            // Get auth headers but DO NOT set Content-Type
            const headers = getAuthHeaders();
            delete headers['Content-Type'];
            
            console.log('Sending updated product data to server...');
            
            // Send request to server
            const response = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: headers,
                body: formData
            });
            
            console.log('Response status:', response.status);
            
            // Parse response
            const data = await response.json();
            console.log('Server response:', data);
            
            if (!response.ok) {
                throw new Error(data.message || 'Error updating product');
            }
            
            // Show success message
            showAlert('Product updated successfully', 'success');
            
            // Reset form
            e.target.reset();
            
            // Reset image preview
            resetImagePreviews();
            
            // Reset variants
            window.variants = [];
            if (window.productVariants) window.productVariants = [];
            updateVariantsTable();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
            if (modal) {
                modal.hide();
            }
            
            // Reload products
            this.loadProducts();
        } catch (error) {
            console.error('Error updating product:', error);
            showAlert(error.message || 'Failed to update product', 'danger');
        } finally {
            // Re-enable submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Update Product';
            }
        }
    }
}

// Function to update edit variants table
function updateEditVariantsTable() {
    const variantsTable = document.getElementById('edit-variants-table').querySelector('tbody');
    if (!variantsTable) return;
    
    if (!window.editProductVariants || window.editProductVariants.length === 0) {
        variantsTable.innerHTML = '<tr><td colspan="3" class="text-center">No variants defined</td></tr>';
        return;
    }
    
    variantsTable.innerHTML = '';
    
    window.editProductVariants.forEach((variant, index) => {
        const row = document.createElement('tr');
        // Create variant name from combination
        let variantName = variant.name;
        if (!variantName && variant.combination) {
            variantName = variant.combination
                .map(item => `${item.attribute}: ${item.value}`)
                .join(', ');
        }
        
        row.innerHTML = `
            <td class="fw-medium">${variantName || `Variant ${index + 1}`}</td>
            <td>
                <div class="input-group input-group-sm">
                    <span class="input-group-text">RWF</span>
                    <input type="number" class="form-control form-control-sm edit-variant-price" 
                           data-index="${index}" value="${variant.price || 0}" min="0" step="0.01">
                </div>
            </td>
            <td>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeEditVariant(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        `;
        variantsTable.appendChild(row);
    });
    
    // Add event listeners to variant inputs
    document.querySelectorAll('.edit-variant-price').forEach(input => {
        input.addEventListener('change', updateEditVariantValue);
    });
    
    // Update hidden input
    const variantsJsonInput = document.getElementById('edit-variants-json');
    if (variantsJsonInput) {
        variantsJsonInput.value = JSON.stringify(window.editProductVariants);
    }
}

// Update edit variant value when input changes
function updateEditVariantValue(event) {
    const input = event.target;
    const index = parseInt(input.getAttribute('data-index'), 10);
    
    if (input.classList.contains('edit-variant-price')) {
        window.editProductVariants[index].price = parseFloat(input.value) || 0;
    }
    
    // Update the hidden input
    const variantsJsonInput = document.getElementById('edit-variants-json');
    if (variantsJsonInput) {
        variantsJsonInput.value = JSON.stringify(window.editProductVariants);
    }
}

// Remove edit variant
function removeEditVariant(index) {
    window.editProductVariants.splice(index, 1);
    updateEditVariantsTable();
}

// Function to add a variant to the edit form
function addEditVariant() {
    // Initialize editProductVariants if it doesn't exist
    if (!window.editProductVariants) {
        window.editProductVariants = [];
    }
    
    // Create empty variant
    const newVariant = {
        options: {},
        price: document.getElementById('edit-product-price')?.value || 0,
        stock: 0
    };
    
    // Add to variants array
    window.editProductVariants.push(newVariant);
    
    // Update the variants table
    updateEditVariantsTable();
    
    // Show variant editor modal
    const variantIndex = window.editProductVariants.length - 1;
    showEditVariantEditor(variantIndex);
}

// Function to show the variant editor
function showEditVariantEditor(index) {
    const variant = window.editProductVariants[index];
    if (!variant) return;
    
    // Create modal HTML
    let modalHTML = `
    <div class="modal fade" id="editVariantModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Edit Variant</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <form id="edit-variant-form">
                        <input type="hidden" id="edit-variant-index" value="${index}">
                        
                        <div class="mb-3">
                            <label class="form-label">Variant Options</label>
                            <div id="variant-options-container">`;
    
    // Add existing options
    if (variant.options) {
        Object.entries(variant.options).forEach(([key, value]) => {
            modalHTML += `
            <div class="input-group mb-2">
                <input type="text" class="form-control option-name" placeholder="Option name" value="${key}">
                <input type="text" class="form-control option-value" placeholder="Option value" value="${value}">
                <button type="button" class="btn btn-outline-danger remove-option">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;
        });
    }
    
    // Add button to add more options
    modalHTML += `
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-primary mt-2" id="add-option-btn">
                                <i class="fas fa-plus"></i> Add Option
                            </button>
                        </div>
                        
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label for="variant-price" class="form-label">Price (RWF)</label>
                                <input type="number" class="form-control" id="variant-price" value="${variant.price || 0}" min="0">
                            </div>
                            <div class="col-md-6">
                                <label for="variant-stock" class="form-label">Stock</label>
                                <input type="number" class="form-control" id="variant-stock" value="${variant.stock || 0}" min="0">
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label for="variant-sku" class="form-label">SKU</label>
                            <input type="text" class="form-control" id="variant-sku" value="${variant.sku || ''}">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="save-variant-btn">Save Variant</button>
                </div>
            </div>
        </div>
    </div>`;
    
    // Add modal to body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    
    // Initialize modal
    const variantModal = new bootstrap.Modal(document.getElementById('editVariantModal'));
    variantModal.show();
    
    // Set up event handlers
    document.getElementById('add-option-btn').addEventListener('click', () => {
        const optionsContainer = document.getElementById('variant-options-container');
        const newOptionHTML = `
        <div class="input-group mb-2">
            <input type="text" class="form-control option-name" placeholder="Option name">
            <input type="text" class="form-control option-value" placeholder="Option value">
            <button type="button" class="btn btn-outline-danger remove-option">
                <i class="fas fa-times"></i>
            </button>
        </div>`;
        
        optionsContainer.insertAdjacentHTML('beforeend', newOptionHTML);
        
        // Add remove button handler
        const removeButtons = document.querySelectorAll('.remove-option');
        removeButtons[removeButtons.length - 1].addEventListener('click', function() {
            this.closest('.input-group').remove();
        });
    });
    
    // Add handlers for existing remove buttons
    document.querySelectorAll('.remove-option').forEach(button => {
        button.addEventListener('click', function() {
            this.closest('.input-group').remove();
        });
    });
    
    // Save variant button
    document.getElementById('save-variant-btn').addEventListener('click', () => {
        // Get values
        const variantIndex = parseInt(document.getElementById('edit-variant-index').value);
        const variantPrice = parseFloat(document.getElementById('variant-price').value) || 0;
        const variantStock = parseInt(document.getElementById('variant-stock').value) || 0;
        const variantSku = document.getElementById('variant-sku').value;
        
        // Get options
        const options = {};
        document.querySelectorAll('#variant-options-container .input-group').forEach(group => {
            const nameInput = group.querySelector('.option-name');
            const valueInput = group.querySelector('.option-value');
            
            if (nameInput && valueInput && nameInput.value.trim()) {
                options[nameInput.value.trim()] = valueInput.value.trim();
            }
        });
        
        // Update variant
        if (window.editProductVariants && window.editProductVariants[variantIndex]) {
            window.editProductVariants[variantIndex] = {
                options: options,
                price: variantPrice,
                stock: variantStock,
                sku: variantSku
            };
            
            // Update variants table
            updateEditVariantsTable();
            
            // Update hidden field for variants
            const variantsJsonInput = document.getElementById('edit-variants-json');
            if (variantsJsonInput) {
                variantsJsonInput.value = JSON.stringify(window.editProductVariants || []);
            }
        }
        
        // Close modal
        variantModal.hide();
        
        // Remove modal from DOM after hiding
        document.getElementById('editVariantModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    });
    
    // Clean up modal when closed
    document.getElementById('editVariantModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

// Initialize product variants
window.variants = [];
window.productVariants = [];
            
// Initialize variant attribute array
window.productAttributes = [];

// Debug function to log variant state
window.logVariantState = function() {
    console.log('=== VARIANT STATE DEBUG ===');
    console.log('window.variants:', JSON.stringify(window.variants));
    console.log('window.productVariants:', JSON.stringify(window.productVariants));
    console.log('window.productAttributes:', JSON.stringify(window.productAttributes));
    
    const variantsJsonInput = document.getElementById('variants-json');
    if (variantsJsonInput) {
        console.log('variants-json input value:', variantsJsonInput.value);
    } else {
        console.log('variants-json input not found in DOM');
    }
    console.log('=== END VARIANT STATE DEBUG ===');
};

// Add variant function
window.addVariant = function() {
    const variantType = document.getElementById('variant-type').value.trim();
    const variantValue = document.getElementById('variant-value').value.trim();
    const variantSku = document.getElementById('variant-sku').value.trim();
    
    if (!variantType || !variantValue || !variantSku) {
        showAlert('Please fill in all variant fields', 'danger');
        return;
    }
    
    const newVariant = {
        type: variantType,
        value: variantValue,
        sku: variantSku
    };
    
    if (!window.variants) window.variants = [];
    window.variants.push(newVariant);
    
    // Also add to the new format for compatibility
    if (!window.productVariants) window.productVariants = [];
    window.productVariants.push({
        name: `${variantType}: ${variantValue}`,
        combination: [{ attribute: variantType, value: variantValue }],
        sku: variantSku,
        price: parseFloat(document.getElementById('price').value) || 0,
        stock: 0
    });
    
    console.log('Added variant:', newVariant);
    console.log('Current variants count:', window.variants.length);
    
    // Update hidden input right after adding
    const variantsJsonInput = document.getElementById('variants-json');
    if (variantsJsonInput) {
        variantsJsonInput.value = JSON.stringify(window.variants);
        console.log('Updated variants-json input after adding variant');
    }
    
    updateVariantsTable();
    clearVariantForm();
}

// Clear variant form fields
function clearVariantForm() {
    document.getElementById('variant-type').value = '';
    document.getElementById('variant-value').value = '';
    document.getElementById('variant-sku').value = '';
}
            
// Update variants table
function updateVariantsTable() {
    const variantsList = document.getElementById('variants-list');
    if (!variantsList) return;
    
    if (!window.variants || window.variants.length === 0) {
        variantsList.innerHTML = `<tr><td colspan="4" class="text-center">No variants added</td></tr>`;
        return;
    }
    
    variantsList.innerHTML = window.variants.map((variant, index) => `
        <tr>
            <td>${variant.type}</td>
            <td>${variant.value}</td>
            <td>${variant.sku}</td>
            <td>
                <button type="button" class="btn btn-sm btn-danger" onclick="window.removeVariant(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Remove variant function
window.removeVariant = function(index) {
    if (window.productVariants) {
        window.productVariants.splice(index, 1);
    }
    
    // Also remove from the legacy variants array if it exists
    if (window.variants && window.variants.length > index) {
        window.variants.splice(index, 1);
    }
    
    // Update the hidden input with the latest variant data
    const variantsJsonInput = document.getElementById('variants-json');
    if (variantsJsonInput) {
        variantsJsonInput.value = JSON.stringify(window.productVariants || []);
        console.log(`Updated variants-json after removing variant ${index}`);
    }
    
    // Update both UI components
    updateVariantsTable();
    if (typeof updateVariantsList === 'function') {
        updateVariantsList();
    }
}

// Function to preview image before upload
function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    const previewContainer = preview.closest('.featured-image-preview');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.src = e.target.result;
            if (previewContainer) {
                previewContainer.classList.remove('d-none');
            }
        };
        
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.src = '#';
        if (previewContainer) {
            previewContainer.classList.add('d-none');
        }
    }
}

// Reset image preview
function resetImagePreview(previewId) {
    const preview = document.getElementById(previewId);
    if (preview) {
        preview.src = '#';
        const previewContainer = preview.closest('.featured-image-preview, .edit-image-preview, .image-preview');
        if (previewContainer) {
            previewContainer.classList.add('d-none');
        }
    }
}

// Reset all image previews
function resetImagePreviews() {
    document.querySelectorAll('[data-preview]').forEach(input => {
        const previewId = input.getAttribute('data-preview');
        resetImagePreview(previewId);
    });
}

// Global function to show alerts
function showAlert(message, type = 'info', autoHide = true, duration = 5000) {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) return;

    // Remove any existing alert of the same type if temporary
    if (autoHide) {
        alertContainer.querySelectorAll(`.alert-${type}[data-auto-hide="true"]`).forEach(alert => {
            alert.remove();
        });
    }

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    if (autoHide) {
        alert.setAttribute('data-auto-hide', 'true');
    }
    
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    alertContainer.appendChild(alert);

    // Auto remove after specified duration if autoHide is true
    if (autoHide) {
        setTimeout(() => {
            if (alert.parentNode) {  // Check if alert is still in the DOM
                alert.classList.remove('show');
                setTimeout(() => {
                    if (alert.parentNode) {
                        alert.remove();
                    }
                }, 300);  // Match the Bootstrap fade animation time
            }
        }, duration);
    }
    
    return alert;
}

// Function to safely initialize charts
function initCharts() {
    try {
        console.log('Initializing charts...');
        
        // First clean up any canvases with Chart.js instances
        document.querySelectorAll('canvas').forEach(canvas => {
            const chartId = canvas.id;
            const chartInstance = Chart.getChart(canvas);
            
            if (chartInstance) {
                console.log(`Destroying existing chart: ${chartId}`);
                chartInstance.destroy();
            }
        });
        
        // Reset chart variables
        salesChart = null;
        categoryChart = null;
        salesReportChart = null;
        revenueCategoryChart = null;
        inventoryValueChart = null;

        // Sales Chart
        const salesCtx = document.getElementById('salesChart');
        if (salesCtx && window.Chart) {
            try {
                salesChart = new Chart(salesCtx, {
                    type: 'line',
                    data: {
                        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                        datasets: [{
                            label: 'Sales',
                            data: [0, 0, 0, 0, 0, 0, 0],
                            borderColor: '#0d6efd',
                            backgroundColor: 'rgba(13, 110, 253, 0.1)',
                            tension: 0.3,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return value.toLocaleString() + ' RWF';
                                    }
                                }
                            }
                        }
                    }
                });
                console.log('Successfully created salesChart');
            } catch (e) {
                console.error('Error creating salesChart:', e);
            }
        } else {
            console.warn('Sales chart canvas or Chart.js not found');
        }

        // Category Chart
        const categoryCtx = document.getElementById('categoryChart');
        if (categoryCtx && window.Chart) {
            try {
                categoryChart = new Chart(categoryCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['------', '------', '------', '------', '------'],
                        datasets: [{
                            data: [0, 0, 0, 0, 0],
                            backgroundColor: [
                                '#0d6efd',
                                '#20c997',
                                '#ffc107',
                                '#dc3545',
                                '#6f42c1'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
                console.log('Successfully created categoryChart');
            } catch (e) {
                console.error('Error creating categoryChart:', e);
            }
        }

        // Sales Report Chart
        const salesReportCtx = document.getElementById('salesReportChart');
        if (salesReportCtx && window.Chart) {
            try {
                salesReportChart = new Chart(salesReportCtx, {
                    type: 'bar',
                    data: {
                        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                        datasets: [{
                            label: 'Sales',
                            data: [0, 0, 0, 0],
                            backgroundColor: '#0d6efd'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return value.toLocaleString() + ' RWF';
                                    }
                                }
                            }
                        }
                    }
                });
                console.log('Successfully created salesReportChart');
            } catch (e) {
                console.error('Error creating salesReportChart:', e);
            }
        }

        // Revenue Category Chart
        const revenueCategoryCtx = document.getElementById('revenueCategoryChart');
        if (revenueCategoryCtx && window.Chart) {
            try {
                revenueCategoryChart = new Chart(revenueCategoryCtx, {
                    type: 'polarArea',
                    data: {
                        labels: ['------', '------', '------', '------', '------'],
                        datasets: [{
                            data: [0, 0, 0, 0, 0],
                            backgroundColor: [
                                'rgba(13, 110, 253, 0.7)',
                                'rgba(32, 201, 151, 0.7)',
                                'rgba(255, 193, 7, 0.7)',
                                'rgba(220, 53, 69, 0.7)',
                                'rgba(111, 66, 193, 0.7)'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });
                console.log('Successfully created revenueCategoryChart');
            } catch (e) {
                console.error('Error creating revenueCategoryChart:', e);
            }
        }

        // Inventory Value Chart
        const inventoryValueCtx = document.getElementById('inventoryValueChart');
        if (inventoryValueCtx && window.Chart) {
            try {
                inventoryValueChart = new Chart(inventoryValueCtx, {
                    type: 'pie',
                    data: {
                        labels: ['------', '------', '------', '------', '------', '------'],
                        datasets: [{
                            data: [0, 0, 0, 0, 0, 0],
                            backgroundColor: [
                                '#0d6efd',
                                '#20c997',
                                '#ffc107',
                                '#dc3545',
                                '#6f42c1',
                                '#fd7e14'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
                console.log('Successfully created inventoryValueChart');
            } catch (e) {
                console.error('Error creating inventoryValueChart:', e);
            }
        }
    } catch (error) {
        console.error('General error initializing charts:', error);
    }
}

// Auth debugging panel to show current status
function addAuthDebugPanel() {
    // Only add in development environment
    if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
        return;
    }
    
    const debugPanel = document.createElement('div');
    debugPanel.style.position = 'fixed';
    debugPanel.style.bottom = '10px';
    debugPanel.style.right = '10px';
    debugPanel.style.backgroundColor = 'rgba(0,0,0,0.8)';
    debugPanel.style.color = 'lime';
    debugPanel.style.padding = '10px';
    debugPanel.style.borderRadius = '5px';
    debugPanel.style.fontSize = '12px';
    debugPanel.style.fontFamily = 'monospace';
    debugPanel.style.zIndex = '9999';
    debugPanel.style.maxWidth = '300px';
    debugPanel.id = 'auth-debug-panel';
    
    // Create refresh button
    const refreshButton = document.createElement('button');
    refreshButton.textContent = 'Refresh Auth Status';
    refreshButton.style.display = 'block';
    refreshButton.style.marginTop = '10px';
    refreshButton.style.backgroundColor = '#333';
    refreshButton.style.color = 'white';
    refreshButton.style.border = 'none';
    refreshButton.style.padding = '5px 10px';
    refreshButton.style.cursor = 'pointer';
    refreshButton.onclick = updateAuthDebugInfo;
    
    // Add minimize/maximize toggle
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'X';
    toggleButton.style.position = 'absolute';
    toggleButton.style.top = '5px';
    toggleButton.style.right = '5px';
    toggleButton.style.backgroundColor = 'transparent';
    toggleButton.style.color = 'white';
    toggleButton.style.border = 'none';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.fontWeight = 'bold';
    
    let isMinimized = false;
    const debugContent = document.createElement('div');
    debugContent.id = 'auth-debug-content';
    
    toggleButton.onclick = function() {
        isMinimized = !isMinimized;
        debugContent.style.display = isMinimized ? 'none' : 'block';
        toggleButton.textContent = isMinimized ? '+' : 'X';
        debugPanel.style.height = isMinimized ? 'auto' : '';
        debugPanel.style.width = isMinimized ? 'auto' : '';
        if (isMinimized) {
            debugPanel.innerHTML = '';
            debugPanel.appendChild(document.createTextNode('Auth Debug'));
            debugPanel.appendChild(toggleButton);
        } else {
            debugPanel.innerHTML = '';
            debugPanel.appendChild(toggleButton);
            debugPanel.appendChild(debugContent);
            debugPanel.appendChild(refreshButton);
            updateAuthDebugInfo();
        }
    };
    
    debugPanel.appendChild(toggleButton);
    debugPanel.appendChild(debugContent);
    debugPanel.appendChild(refreshButton);
    
    // Add to body
    document.body.appendChild(debugPanel);
    
    // Update info initially
    updateAuthDebugInfo();
}

// Update auth debug info
function updateAuthDebugInfo() {
    const debugContent = document.getElementById('auth-debug-content');
    if (!debugContent) return;
    
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const sessionActive = localStorage.getItem('sessionActive');
        const lastActivity = localStorage.getItem('lastActivity');
        const lastPageLeave = localStorage.getItem('lastPageLeave');
        
        // Get token expiration if possible
        let tokenExpiry = 'Unknown';
        let timeLeft = 'Unknown';
        try {
            if (token) {
                // Decode token (JWT tokens are base64 encoded)
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload.exp) {
                    const expDate = new Date(payload.exp * 1000);
                    tokenExpiry = expDate.toLocaleString();
                    
                    const now = Math.floor(Date.now() / 1000);
                    const secondsLeft = payload.exp - now;
                    const hours = Math.floor(secondsLeft / 3600);
                    const minutes = Math.floor((secondsLeft % 3600) / 60);
                    timeLeft = `${hours}h ${minutes}m (${secondsLeft}s)`;
                }
            }
        } catch (e) {
            tokenExpiry = `Error: ${e.message}`;
        }
        
        let lastActivityTime = 'Never';
        if (lastActivity) {
            const lastActivityDate = new Date(parseInt(lastActivity));
            lastActivityTime = lastActivityDate.toLocaleString();
        }
        
        let lastLeaveTime = 'Never';
        if (lastPageLeave) {
            const lastLeaveDate = new Date(parseInt(lastPageLeave));
            lastLeaveTime = lastLeaveDate.toLocaleString();
        }
        
        debugContent.innerHTML = `
            <div style="margin-bottom: 5px; font-weight: bold;">Auth Status</div>
            <div>Token: ${token ? '✅ Present' : '❌ Missing'}</div>
            <div>User: ${user && user._id ? '✅ ' + (user.username || 'Unknown') : '❌ Missing'}</div>
            <div>Session: ${sessionActive === 'true' ? '✅ Active' : '❓ ' + sessionActive}</div>
            <div>Expires: ${tokenExpiry}</div>
            <div>Time Left: ${timeLeft}</div>
            <div>Last Activity: ${lastActivityTime}</div>
            <div>Last Page Leave: ${lastLeaveTime}</div>
        `;
    } catch (error) {
        debugContent.innerHTML = `<div style="color: red;">Error: ${error.message}</div>`;
    }
}

// Add after the addAuthDebugPanel function

// Network status indicator
function initNetworkStatusMonitor() {
    const body = document.body;
    
    // Create status indicator
    const networkIndicator = document.createElement('div');
    networkIndicator.id = 'network-status';
    networkIndicator.style.position = 'fixed';
    networkIndicator.style.bottom = '10px';
    networkIndicator.style.left = '10px';
    networkIndicator.style.padding = '8px 15px';
    networkIndicator.style.borderRadius = '20px';
    networkIndicator.style.fontSize = '14px';
    networkIndicator.style.fontWeight = 'bold';
    networkIndicator.style.color = 'white';
    networkIndicator.style.zIndex = '9999';
    networkIndicator.style.display = 'none';
    networkIndicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    networkIndicator.style.transition = 'opacity 0.3s ease';
    
    body.appendChild(networkIndicator);
    
    // Update network status and show indicator
    function updateNetworkStatus() {
        if (navigator.onLine) {
            networkIndicator.textContent = '✓ Online';
            networkIndicator.style.backgroundColor = '#28a745';
            
            // Hide after 3 seconds if we're online
            setTimeout(() => {
                networkIndicator.style.opacity = '0';
                setTimeout(() => {
                    networkIndicator.style.display = 'none';
                    networkIndicator.style.opacity = '1';
                }, 300);  // Match the Bootstrap fade animation time
            }, 3000);
        } else {
            networkIndicator.textContent = '✕ Offline';
            networkIndicator.style.backgroundColor = '#dc3545';
            networkIndicator.style.display = 'block';
        }
    }
    
    // Show temporary status when network status changes
    window.addEventListener('online', () => {
        networkIndicator.style.display = 'block';
        updateNetworkStatus();
        showAlert('Your internet connection has been restored.', 'success');
    });
    
    window.addEventListener('offline', () => {
        networkIndicator.style.display = 'block';
        updateNetworkStatus();
        showAlert('You are currently offline. Some features may not work properly.', 'warning', false);
    });
    
    // Check status on page load
    if (!navigator.onLine) {
        networkIndicator.style.display = 'block';
        updateNetworkStatus();
        showAlert('You are currently offline. Some features may not work properly.', 'warning', false);
    }
    
    // Setup ping to check real connectivity (not just navigator.onLine)
    let pingInterval;
    function setupConnectivityCheck() {
        // Clear any existing interval
        if (pingInterval) clearInterval(pingInterval);
        
        // Check connectivity every 30 seconds
        pingInterval = setInterval(async () => {
            try {
                // Tiny request to check connectivity with a cache buster
                const response = await fetch(`/api/ping?_=${Date.now()}`, {
                    method: 'HEAD',
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' }
                });
                
                if (!response.ok && navigator.onLine) {
                    // Browser thinks we're online but server is unreachable
                    networkIndicator.textContent = '! Limited Connectivity';
                    networkIndicator.style.backgroundColor = '#ffc107';
                    networkIndicator.style.display = 'block';
                } else if (navigator.onLine) {
                    // We're truly online, update and start fade timer
                    updateNetworkStatus();
                }
            } catch (error) {
                if (navigator.onLine) {
                    // Error connecting despite browser thinking we're online
                    networkIndicator.textContent = '! Limited Connectivity';
                    networkIndicator.style.backgroundColor = '#ffc107';
                    networkIndicator.style.display = 'block';
                }
            }
        }, 30000);
    }
    
    // Start connectivity checks
    setupConnectivityCheck();
}

// Helper to create image preview
function createImagePreview(file, previewEl) {
    if (!previewEl) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        previewEl.src = e.target.result;
        previewEl.alt = 'Preview';
        previewEl.style.opacity = '1';
    };
    reader.readAsDataURL(file);
}

// Initialize Category Manager
window.categoryManager = new CategoryManager();

// Setup category form submission handler
function setupCategoryFormHandler() {
    const categoryForm = document.getElementById('category-form');
    if (!categoryForm) {
        console.error('Category form not found!');
        return;
    }

    console.log('Setting up category form handler');

    categoryForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('Category form submitted');
        
        try {
            // Disable submit button to prevent multiple submissions
            const submitBtn = categoryForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
            }

            // Get form input values
            const nameInput = categoryForm.querySelector('input[name="name"]');
            const descInput = categoryForm.querySelector('textarea[name="description"]');
            const statusSelect = categoryForm.querySelector('select[name="status"]');
            const imageInput = categoryForm.querySelector('input[name="image"]');
            
            if (!nameInput) {
                throw new Error('Name field not found in form');
            }
            
            // Get values
            const name = nameInput.value.trim();
            const description = descInput ? descInput.value.trim() : '';
            const status = statusSelect ? statusSelect.value : 'active';
            
            console.log('Form values:', { name, description, status });
            
            if (!name) {
                throw new Error('Category name is required');
            }
            
            // Get auth token
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }
            
            // Always use FormData for consistency (it works with or without files)
            const formData = new FormData();
            formData.append('name', name);
            formData.append('description', description);
            formData.append('status', status);
            
            // Add image file if present
            if (imageInput && imageInput.files && imageInput.files.length > 0) {
                console.log('Image file present, adding to FormData');
                formData.append('image', imageInput.files[0]);
            }
            
            // Log what we're sending
            console.log('Sending category data:', {
                name,
                description,
                status,
                hasImage: imageInput && imageInput.files && imageInput.files.length > 0
            });
            
            const response = await fetch('/api/categories', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // Don't set Content-Type header - browser will set it with boundary for FormData
                },
                body: formData
            });
            
            const data = await response.json();
            console.log('Server response:', data);
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to create category');
            }
            
            // Show success message
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Category created successfully',
                timer: 2000,
                showConfirmButton: false
            });
            
            // Reset form
            categoryForm.reset();
            categoryForm.classList.remove('was-validated');
            
            // Reset image preview
            const previewContainer = document.querySelector('.image-preview');
            const previewImage = document.getElementById('preview-image');
            if (previewContainer) previewContainer.classList.add('d-none');
            if (previewImage) previewImage.src = '#';
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addCategoryModal'));
            if (modal) modal.hide();
            
            // Reload categories
            if (window.categoryManager) {
                window.categoryManager.loadCategories();
            }
            
        } finally {
            // Re-enable submit button
            const submitBtn = categoryForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Save Category';
            }
        }
    });
}

// Update image preview function to handle loading state better
function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    const previewContainer = preview.closest('.image-preview');
    
    if (input.files && input.files[0]) {
        // Show loading state
        previewContainer.classList.remove('d-none');
        preview.src = '/images/loading.gif';
        
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        previewContainer.classList.add('d-none');
        preview.src = '#';
    }
}

// Update image compression function to handle errors better
async function compressImage(file) {
    try {
        console.log('Original image size:', file.size / 1024 / 1024, 'MB');
        // Skip compression for small images
        if (file.size < 500 * 1024) {
            console.log('Image already small enough, skipping compression');
            return file;
        }
        
        const compressedFile = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1024,
            useWebWorker: true,
            fileType: 'image/jpeg'
        });
        
        console.log('Compressed image size:', compressedFile.size / 1024 / 1024, 'MB');
        
        // Create a new File object from the compressed blob
        return new File([compressedFile], file.name, {
            type: 'image/jpeg',
            lastModified: new Date().getTime()
        });
    } catch (error) {
        console.error('Error compressing image:', error);
        return file; // Return original on error
    }
}

// Setup edit category form submission handler
function setupEditCategoryFormHandler() {
    const editCategoryForm = document.getElementById('edit-category-form');
    if (!editCategoryForm) {
        console.warn('Edit category form not found');
        return;
    }

    console.log('Setting up edit category form handler');
    
    // Remove any existing handlers to avoid duplicates
    const clonedForm = editCategoryForm.cloneNode(true);
    editCategoryForm.parentNode.replaceChild(clonedForm, editCategoryForm);
    
    // Set up the new handler
    clonedForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('Edit category form submitted');

        // Validate form
        if (!this.checkValidity()) {
            e.stopPropagation();
            this.classList.add('was-validated');
            return;
        }

        // Disable the submit button
        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
        }

        try {
            // Get category ID
            const categoryId = document.getElementById('edit-category-id').value;
            if (!categoryId) {
                throw new Error('Category ID is missing');
            }
            
            // Create FormData from the form
            const formData = new FormData(this);
            
            // Log all form fields for debugging
            console.log('Edit category form data fields:');
            for (const [key, value] of formData.entries()) {
                const valueDisplay = value instanceof File ? 
                    `File: ${value.name} (${value.size} bytes)` : value;
                console.log(`${key}: ${valueDisplay}`);
            }
            
            // Get auth headers but DO NOT set Content-Type
            const headers = getAuthHeaders();
            delete headers['Content-Type']; 
            
            console.log(`Sending updated category data to server for ID: ${categoryId}`);
            
            // Send request to server
            const response = await fetch(`/api/categories/${categoryId}`, {
                method: 'PUT',
                headers: headers,
                body: formData
            });
            
            console.log('Response status:', response.status);
            
            // Parse response
            const data = await response.json();
            console.log('Server response:', data);
                
            if (!response.ok) {
                throw new Error(data.message || 'Error updating category');
            }

            // Show success message
            showAlert('Category updated successfully', 'success');

            // Reset form
            this.reset();
            
            // Reset image preview
            resetImagePreview('edit-preview-image');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editCategoryModal'));
            if (modal) {
                modal.hide();
            }
            
            // Reload categories
            if (window.categoryManager) {
                window.categoryManager.loadCategories();
            }

        } catch (error) {
            console.error('Error updating category:', error);
            showAlert(error.message || 'Failed to update category', 'danger');
        } finally {
            // Re-enable submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Update Category';
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin panel initialization started');

    // Initialize auth check
    if (!checkAuth()) {
        return;
    }

    // Initialize sidebar
    initializeSidebar();
    
    // Initialize navigation
    initializeNavigation();
    
    // Initialize modals
    initializeModals();
    
    // Setup form handlers
    setupProductFormHandler();
    setupCategoryFormHandler(); // Make sure this is called
    setupEditCategoryFormHandler();
    
    // Initialize category and product managers
    if (window.CategoryManager) {
        window.categoryManager = new CategoryManager();
    }
    
    if (window.ProductManager) {
        window.productManager = new ProductManager();
    }
    
    // Initialize charts
    initCharts();
    
    // Load dashboard data
    loadDashboardData();
    
    // Setup category and product image previews
    setupImagePreviewHandlers();
    
    // Setup session manager for auto logout
    initSessionManager();
    
    // Setup network status monitor
    initNetworkStatusMonitor();
    
    // Add logout button event listeners
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Logout button clicked');
            handleLogout();
        });
    }
    
    const navLogoutBtn = document.getElementById('nav-logout-btn');
    if (navLogoutBtn) {
        navLogoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Navigation logout button clicked');
            handleLogout();
        });
    }
    
    // Hide loader when everything is initialized
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'none';
    }

    console.log('Admin panel initialization completed');

    // Profile/Settings dropdown navigation (single source of truth)
    const profileDropdown = document.getElementById('profile-dropdown-item');
    const settingsDropdown = document.getElementById('settings-dropdown-item');
    if (profileDropdown) {
        profileDropdown.addEventListener('click', function(e) {
            e.preventDefault();
            goToSettingsTab('profile');
        });
    }
    if (settingsDropdown) {
        settingsDropdown.addEventListener('click', function(e) {
            e.preventDefault();
            goToSettingsTab('general');
        });
    }
    function goToSettingsTab(tab) {
        // Show settings section
        document.querySelectorAll('.section-content').forEach(s => s.classList.remove('active'));
        const settingsSection = document.getElementById('settings-section');
        settingsSection.classList.add('active');
        // Use Bootstrap's tab API
        const tabBtn = document.getElementById(tab+'-tab');
        if (tabBtn) {
            if (window.bootstrap) {
                const tabInstance = window.bootstrap.Tab.getOrCreateInstance(tabBtn);
                tabInstance.show();
            } else {
                tabBtn.click();
            }
        }
        // Scroll to settings
        settingsSection.scrollIntoView({behavior:'smooth'});
        // Set sidebar active
        document.querySelectorAll('.section-link').forEach(l => l.classList.remove('active'));
        const sidebarLink = document.querySelector('[data-section="settings-section"]');
        if (sidebarLink) sidebarLink.classList.add('active');
        // Close dropdown (if open)
        document.body.click();
    }

    // Notification panel logic (single source of truth)
    const notificationBell = document.getElementById('notification-bell');
    const notificationPanel = document.getElementById('notification-panel');
    const closeNotificationPanel = document.getElementById('close-notification-panel');
    const notificationList = document.getElementById('notification-list');
    function openNotificationPanel() {
        notificationPanel.classList.add('open');
        setTimeout(() => { notificationPanel.focus?.(); }, 100);
    }
    function closeNotificationPanelFn() {
        notificationPanel.classList.remove('open');
    }
    if (notificationBell) {
        notificationBell.addEventListener('click', function(e) {
            e.preventDefault();
            if (notificationPanel.classList.contains('open')) {
                closeNotificationPanelFn();
            } else {
                openNotificationPanel();
            }
        });
    }
    if (closeNotificationPanel) {
        closeNotificationPanel.addEventListener('click', closeNotificationPanelFn);
    }
    // Close on outside click
    document.addEventListener('mousedown', function(e) {
        if (notificationPanel.classList.contains('open') && !notificationPanel.contains(e.target) && e.target.id !== 'notification-bell') {
            closeNotificationPanelFn();
        }
    });
    // Close on Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && notificationPanel.classList.contains('open')) {
            closeNotificationPanelFn();
        }
    });
    // Sample notifications
    if (notificationList) {
        const notifications = [
            {icon:'fa-shopping-cart text-primary', title:'New Order', desc:'Order #1234 placed', time:'2 min ago'},
            {icon:'fa-envelope text-success', title:'New Message', desc:'You have a new support message', time:'10 min ago'},
            {icon:'fa-user-plus text-info', title:'New Subscription', desc:'John Doe subscribed', time:'1 hour ago'},
            {icon:'fa-box-open text-warning', title:'Stock Alert', desc:'Product ABC is low on stock', time:'2 hours ago'},
            {icon:'fa-bell text-danger', title:'System Alert', desc:'Backup needed soon', time:'Yesterday'}
        ];
        notificationList.innerHTML = notifications.map(n => `
            <div class="notification-item">
                <span class="notification-icon"><i class="fas ${n.icon}"></i></span>
                <div class="notification-content">
                    <div class="notification-title">${n.title}</div>
                    <div class="notification-desc small">${n.desc}</div>
                    <div class="notification-time">${n.time}</div>
                </div>
            </div>
        `).join('');
    }
});

// Setup image preview handlers
function setupImagePreviewHandlers() {
    // Setup image preview for file inputs
    document.querySelectorAll('input[type="file"][data-preview]').forEach(input => {
        input.addEventListener('change', function() {
            const previewId = this.getAttribute('data-preview');
            if (previewId) {
                previewImage(this, previewId);
            }
        });
    });
}

// Product variant management
let productAttributes = [];
let productVariants = [];

// Initialize variant management
function initializeVariantManagement() {
    // Add attribute button event listener
    document.getElementById('add-attribute-btn')?.addEventListener('click', addProductAttribute);
    
    // Generate variants button event listener
    document.getElementById('generate-variants-btn')?.addEventListener('click', generateProductVariants);
}

// Add a product attribute
function addProductAttribute() {
    const attributeType = document.getElementById('attribute-type').value.trim();
    const attributeValuesStr = document.getElementById('attribute-values').value.trim();
    
    if (!attributeType || !attributeValuesStr) {
        showAlert('Please enter both attribute type and values', 'warning');
        return;
    }
    
    // Parse attribute values, removing empty values and trimming
    const attributeValues = attributeValuesStr
        .split(',')
        .map(value => value.trim())
        .filter(value => value.length > 0);
    
    if (attributeValues.length === 0) {
        showAlert('Please enter at least one attribute value', 'warning');
        return;
    }
    
    // Check if attribute type already exists
    if (productAttributes.some(attr => attr.name.toLowerCase() === attributeType.toLowerCase())) {
        showAlert('This attribute type already exists', 'warning');
        return;
    }
    
    // Add to attributes array
    productAttributes.push({
        name: attributeType,
        values: attributeValues
    });
    
    // Update the attributes list UI
    updateAttributesList();
    
    // Clear the inputs
    document.getElementById('attribute-type').value = '';
    document.getElementById('attribute-values').value = '';
    
    // Enable generate variants button if we have attributes
    document.getElementById('generate-variants-btn').disabled = productAttributes.length === 0;
    
    // Show preview of variants count
    updateVariantsCount();
}

// Remove a product attribute
function removeProductAttribute(index) {
    productAttributes.splice(index, 1);
    updateAttributesList();
    
    // Reset variants when attributes change
    productVariants = [];
    document.getElementById('variants-list').innerHTML = `
        <tr id="no-variants-message">
            <td colspan="5" class="text-center py-3 text-muted">
                <i class="fas fa-info-circle me-1"></i> Add attributes and generate variants
            </td>
        </tr>
    `;
    
    // Update generate button state
    document.getElementById('generate-variants-btn').disabled = productAttributes.length === 0;
    
    // Update variants count
    updateVariantsCount();
}

// Update the attributes list UI
function updateAttributesList() {
    const attributesList = document.getElementById('attributes-list');
    if (!attributesList) return;
    
    attributesList.innerHTML = '';
    
    productAttributes.forEach((attr, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="fw-medium">${attr.name}</td>
            <td>${attr.values.join(', ')}</td>
            <td>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeProductAttribute(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        attributesList.appendChild(row);
    });
}

// Update variants count preview
function updateVariantsCount() {
    const variantsCountElem = document.getElementById('variants-count');
    if (!variantsCountElem) return;
    
    if (productAttributes.length === 0) {
        variantsCountElem.textContent = '';
        return;
    }
    
    // Calculate total possible combinations
    const totalCombinations = productAttributes.reduce((total, attr) => {
        return total * attr.values.length;
    }, 1);
    
    variantsCountElem.textContent = `(Will generate ${totalCombinations} variant${totalCombinations !== 1 ? 's' : ''})`;
}

// Generate all possible variant combinations from attributes
function generateProductVariants() {
    if (productAttributes.length === 0) {
        showAlert('Please add at least one attribute first', 'warning');
        return;
    }
    
    // Get base product details
    const basePrice = parseFloat(document.getElementById('price').value) || 0;
    
    // Generate combinations
    productVariants = generateVariantCombinations(productAttributes);
    
    // Add price to each variant
    productVariants = productVariants.map(variant => {
        return {
            ...variant,
            price: basePrice
        };
    });
    
    // Update variants UI
    updateVariantsList();
}

// Generate all possible combinations of attributes
function generateVariantCombinations(attributes) {
    // Helper function to generate combinations recursively
    function combine(attributes, current = [], index = 0, results = []) {
        if (index === attributes.length) {
            // Base case: we've processed all attributes
            // Create a variant from the current combination
            const variantName = current.map(item => `${item.attribute}: ${item.value}`).join(', ');
            results.push({
                name: variantName,
                combination: [...current]
            });
            return;
        }
        
        // Recursive case: process the current attribute's values
        const attribute = attributes[index];
        for (const value of attribute.values) {
            current.push({ attribute: attribute.name, value });
            combine(attributes, current, index + 1, results);
            current.pop(); // Backtrack
        }
    }
    
    const results = [];
    combine(attributes, [], 0, results);
    return results;
}

// Update the variants table UI
function updateVariantsList() {
    const variantsList = document.getElementById('variants-list');
    if (!variantsList) return;
    
    if (productVariants.length === 0) {
        variantsList.innerHTML = `
            <tr id="no-variants-message">
                <td colspan="3" class="text-center py-3 text-muted">
                    <i class="fas fa-info-circle me-1"></i> Add attributes and generate variants
                </td>
            </tr>
        `;
        
        // Update hidden input with empty array
        const variantsJsonInput = document.getElementById('variants-json');
        if (variantsJsonInput) {
            variantsJsonInput.value = JSON.stringify([]);
            console.log('Updated variants-json input to empty array');
        }
        
        return;
    }
    
    variantsList.innerHTML = '';
    
    productVariants.forEach((variant, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="fw-medium">${variant.name}</td>
            <td>
                <div class="input-group input-group-sm">
                    <span class="input-group-text">RWF</span>
                    <input type="number" class="form-control form-control-sm variant-price" 
                           data-index="${index}" value="${variant.price}" min="0" step="0.01">
                </div>
            </td>
            <td>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.removeVariant(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        `;
        variantsList.appendChild(row);
    });
    
    // Add event listeners to variant inputs
    document.querySelectorAll('.variant-price').forEach(input => {
        input.addEventListener('change', updateVariantValue);
    });
    
    // Update hidden input whenever variants are updated
    const variantsJsonInput = document.getElementById('variants-json');
    if (variantsJsonInput) {
        variantsJsonInput.value = JSON.stringify(productVariants);
        console.log('Updated variants-json input with', productVariants.length, 'variants');
    } else {
        console.warn('variants-json input not found, could not update');
    }
    
    // Show success message
    showAlert(`Generated ${productVariants.length} product variants`, 'success', true, 2000);
}

// Update a variant's value when input changes
function updateVariantValue(event) {
    const input = event.target;
    const index = parseInt(input.getAttribute('data-index'), 10);
    
    if (input.classList.contains('variant-price')) {
        productVariants[index].price = parseFloat(input.value) || 0;
    }
    
    // Update the hidden input with the latest variant data
    const variantsJsonInput = document.getElementById('variants-json');
    if (variantsJsonInput) {
        variantsJsonInput.value = JSON.stringify(productVariants);
        console.log(`Updated variants-json after changing variant ${index}`);
    }
    
    // Also update window.variants for backward compatibility
    window.variants = productVariants;
}

// Remove a variant - use the global function
function removeVariant(index) {
    // Call the global function to ensure consistency
    window.removeVariant(index);
}

// Hook into product form submission
function setupVariantFormIntegration() {
    // Add an event listener to the product form
    const productForm = document.getElementById('product-form');
    if (productForm) {
        // Create the variants input at initialization
        let variantsInput = document.getElementById('variants-json');
        if (!variantsInput) {
            variantsInput = document.createElement('input');
            variantsInput.type = 'hidden';
            variantsInput.id = 'variants-json';
            variantsInput.name = 'variants';
            variantsInput.value = JSON.stringify([]);
            productForm.appendChild(variantsInput);
            console.log('Added variants-json hidden field to form at initialization');
        }
        
        // Function to ensure variants are in the form before submission
        const ensureVariantsInForm = () => {
            console.log('=== ENSURING VARIANTS IN FORM ===');
            console.log('window.productVariants length:', window.productVariants ? window.productVariants.length : 'undefined');
            console.log('window.variants length:', window.variants ? window.variants.length : 'undefined');
            
            // Always get a fresh reference to the input
            let variantsInput = document.getElementById('variants-json');
            if (!variantsInput) {
                variantsInput = document.createElement('input');
                variantsInput.type = 'hidden';
                variantsInput.id = 'variants-json';
                variantsInput.name = 'variants';
                productForm.appendChild(variantsInput);
                console.log('Created missing variants-json input during form submission');
            }
            
            // Decide which variants data to use
            let variantsData = [];
            
            if (window.productVariants && window.productVariants.length > 0) {
                variantsData = window.productVariants;
                console.log('Using productVariants data with', variantsData.length, 'entries');
            } else if (window.variants && window.variants.length > 0) {
                variantsData = window.variants;
                console.log('Using legacy variants data with', variantsData.length, 'entries');
            } else {
                console.log('No variants found, using empty array');
            }
            
            // Stringify the variants
            const variantsJson = JSON.stringify(variantsData);
            
            // Set the value
            variantsInput.value = variantsJson;
            console.log('Set variants JSON:', variantsInput.value.substring(0, 100) + (variantsInput.value.length > 100 ? '...' : ''));
            console.log('=== END ENSURING VARIANTS IN FORM ===');
            
            // Log the full form data before submission
            console.log('Form data before submission:');
            const formData = new FormData(productForm);
            for (const [key, value] of formData.entries()) {
                if (key === 'variants') {
                    console.log(`${key}: [${value.length} characters]`);
                } else {
                    console.log(`${key}: ${value}`);
                }
            }
            
            return true;
        };
        
        // Add event listener for form submission
        productForm.addEventListener('submit', function(e) {
            // Call our debug function
            window.logVariantState();
            
            // Make sure variants are in the form
            ensureVariantsInForm();
            
            // Validate that variants have been generated if attributes exist
            if (window.productAttributes && window.productAttributes.length > 0 && 
                (!window.productVariants || window.productVariants.length === 0)) {
                e.preventDefault();
                showAlert('Please generate variants before submitting', 'warning');
                const generateBtn = document.getElementById('generate-variants-btn');
                if (generateBtn) {
                    generateBtn.scrollIntoView({ behavior: 'smooth' });
                }
                return;
            }
        });
    }
}

// Initialize variant management when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeVariantManagement();
    setupVariantFormIntegration();
});

// --- Notification Bell Logic: Only one instance, at the end of the file ---
document.addEventListener('DOMContentLoaded', function() {
  const notificationBell = document.getElementById('notification-bell');
  const notificationPanel = document.getElementById('notification-panel');
  const closeNotificationPanel = document.getElementById('close-notification-panel');
  const notificationList = document.getElementById('notification-list');

  function openNotificationPanel() {
    if (notificationPanel) {
      notificationPanel.classList.add('open');
    }
  }
  function closeNotificationPanelFn() {
    if (notificationPanel) {
      notificationPanel.classList.remove('open');
    }
  }
  if (notificationBell) {
    notificationBell.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Notification bell clicked');
      if (notificationPanel) {
        if (notificationPanel.classList.contains('open')) {
          closeNotificationPanelFn();
        } else {
          openNotificationPanel();
        }
      } else {
        console.warn('Notification panel not found in DOM');
      }
    });
  } else {
    console.warn('Notification bell not found in DOM');
  }
  if (closeNotificationPanel) {
    closeNotificationPanel.addEventListener('click', closeNotificationPanelFn);
  }
  // Close on outside click
  document.addEventListener('mousedown', function(e) {
    if (notificationPanel.classList.contains('open') && !notificationPanel.contains(e.target) && e.target.id !== 'notification-bell') {
      closeNotificationPanelFn();
    }
  });
  // Close on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && notificationPanel.classList.contains('open')) {
      closeNotificationPanelFn();
    }
  });
  // Sample notifications
  if (notificationList) {
    const notifications = [
      {icon:'fa-shopping-cart text-primary', title:'New Order', desc:'Order #1234 placed', time:'2 min ago'},
      {icon:'fa-envelope text-success', title:'New Message', desc:'You have a new support message', time:'10 min ago'},
      {icon:'fa-user-plus text-info', title:'New Subscription', desc:'John Doe subscribed', time:'1 hour ago'},
      {icon:'fa-box-open text-warning', title:'Stock Alert', desc:'Product ABC is low on stock', time:'2 hours ago'},
      {icon:'fa-bell text-danger', title:'System Alert', desc:'Backup needed soon', time:'Yesterday'}
    ];
    notificationList.innerHTML = notifications.map(n => `
      <div class="notification-item">
        <span class="notification-icon"><i class="fas ${n.icon}"></i></span>
        <div class="notification-content">
          <div class="notification-title">${n.title}</div>
          <div class="notification-desc small">${n.desc}</div>
          <div class="notification-time">${n.time}</div>
        </div>
      </div>
    `).join('');
  }
});

// Remove notification handling from admin.js since it's now handled by admin-notifications.js
document.addEventListener('DOMContentLoaded', function() {
    const notificationBell = document.getElementById('notification-bell');
    const notificationPanel = document.getElementById('notification-panel');
    const closeNotificationPanel = document.getElementById('close-notification-panel');
    const notificationList = document.getElementById('notification-list');

    // Clear any existing notifications to let admin-notifications.js handle them
    if (notificationList) {
        notificationList.innerHTML = '';
    }

    // Remove old event listeners
    if (notificationBell) {
        const oldListeners = notificationBell.cloneNode(true);
        notificationBell.parentNode.replaceChild(oldListeners, notificationBell);
    }

    if (closeNotificationPanel) {
        const oldListeners = closeNotificationPanel.cloneNode(true);
        closeNotificationPanel.parentNode.replaceChild(oldListeners, closeNotificationPanel);
    }
});

// Utility Functions
function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'flex';
    }
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) return;

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    alertContainer.appendChild(alertDiv);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}