/**
 * N.Honest Profile Popup
 * Handles the customer profile popup functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the profile popup system
    initProfilePopup();
});

/**
 * Initialize the profile popup system
 */
function initProfilePopup() {
    // Check if user is logged in
    const customerToken = localStorage.getItem('customerToken');
    const customerDataStr = localStorage.getItem('customerData');
    
    if (!customerToken || !customerDataStr) {
        console.log('User not logged in, profile popup will not be initialized');
        return;
    }
    
    try {
        // Parse customer data
        const customerData = JSON.parse(customerDataStr);
        
        // Update profile popup with customer data
        updateProfilePopup(customerData);
        
        // Setup event listeners
        setupProfilePopupListeners();
        
    } catch (error) {
        console.error('Error initializing profile popup:', error);
    }
}

/**
 * Update profile popup with customer data
 * @param {Object} customerData - Customer data object
 */
function updateProfilePopup(customerData) {
    if (!customerData) return;
    
    // Update profile popup name
    const popupName = document.getElementById('profile-popup-name');
    if (popupName) {
        popupName.textContent = `${customerData.firstName} ${customerData.lastName}`;
    }
    
    // Update profile popup email
    const popupEmail = document.getElementById('profile-popup-email');
    if (popupEmail) {
        popupEmail.textContent = customerData.email;
    }
    
    // Update profile popup avatar
    const popupAvatar = document.getElementById('profile-popup-avatar');
    if (popupAvatar) {
        if (customerData.picture) {
            popupAvatar.src = customerData.picture;
        } else {
            // Generate avatar from name
            const name = encodeURIComponent(`${customerData.firstName}+${customerData.lastName}`);
            popupAvatar.src = `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&size=200`;
        }
        popupAvatar.alt = `${customerData.firstName} ${customerData.lastName}`;
    }
    
    // Update stats
    updateProfileStats(customerData);
    
    // Update completion items
    updateCompletionItems(customerData);
}

/**
 * Update profile stats (orders, wishlist, points)
 * @param {Object} customerData - Customer data object
 */
function updateProfileStats(customerData) {
    // Update orders count
    const ordersCount = document.getElementById('profile-stat-orders');
    if (ordersCount) {
        // Get orders count from customer data or set to 0
        const count = customerData.orders ? customerData.orders.length : 0;
        ordersCount.textContent = count;
    }
    
    // Update wishlist count
    const wishlistCount = document.getElementById('profile-stat-wishlist');
    if (wishlistCount) {
        // Get wishlist count from customer data or set to 0
        const count = customerData.wishlist ? customerData.wishlist.length : 0;
        wishlistCount.textContent = count;
    }
    
    // Update points
    const pointsCount = document.getElementById('profile-stat-points');
    if (pointsCount) {
        // Get points from customer data or set to 0
        const points = customerData.points || 0;
        pointsCount.textContent = points;
    }
}

/**
 * Update completion items based on customer data
 * @param {Object} customerData - Customer data object
 */
function updateCompletionItems(customerData) {
    // Calculate completion percentage
    let completedItems = 0;
    let totalItems = 7;
    
    // Check basic information
    if (customerData.firstName && customerData.lastName) {
        completedItems++;
        updateCompletionItem('basic', true);
    } else {
        updateCompletionItem('basic', false);
    }
    
    // Check email verification
    if (customerData.isVerified) {
        completedItems++;
        updateCompletionItem('email', true);
    } else {
        updateCompletionItem('email', false);
    }
    
    // Check phone number
    if (customerData.phone) {
        completedItems++;
        updateCompletionItem('phone', true);
    } else {
        updateCompletionItem('phone', false);
    }
    
    // Check address
    if (customerData.address && Object.keys(customerData.address).length > 0) {
        completedItems++;
        updateCompletionItem('address', true);
    } else {
        updateCompletionItem('address', false);
    }
    
    // Check profile picture
    if (customerData.picture && !customerData.picture.includes('ui-avatars.com')) {
        completedItems++;
        updateCompletionItem('picture', true);
    } else {
        updateCompletionItem('picture', false);
    }
    
    // Check preferences
    if (customerData.emailPreferences && Object.keys(customerData.emailPreferences).length > 0) {
        completedItems++;
        updateCompletionItem('preferences', true);
    } else {
        updateCompletionItem('preferences', false);
    }
    
    // Check security settings
    if (customerData.isVerified) {
        completedItems++;
        updateCompletionItem('security', true);
    } else {
        updateCompletionItem('security', false);
    }
    
    // Calculate percentage
    const percentage = Math.round((completedItems / totalItems) * 100);
    
    // Update percentage display
    const percentageElement = document.getElementById('completion-percentage');
    if (percentageElement) {
        percentageElement.textContent = `${percentage}%`;
    }
    
    // Update progress bar
    const progressElement = document.getElementById('completion-progress');
    if (progressElement) {
        progressElement.style.width = `${percentage}%`;
        
        // Add animation class if completion is 100%
        if (percentage === 100) {
            progressElement.classList.add('complete-pulse');
        } else {
            progressElement.classList.remove('complete-pulse');
        }
    }
}

/**
 * Update a completion item in the UI
 * @param {string} itemId - ID of the completion item
 * @param {boolean} isComplete - Whether the item is complete
 */
function updateCompletionItem(itemId, isComplete) {
    const item = document.getElementById(`completion-item-${itemId}`);
    if (!item) return;
    
    const checkIcon = item.querySelector('.completion-check');
    if (checkIcon) {
        if (isComplete) {
            checkIcon.classList.remove('pending');
            checkIcon.classList.add('complete');
            checkIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
        } else {
            checkIcon.classList.remove('complete');
            checkIcon.classList.add('pending');
            checkIcon.innerHTML = '<i class="fas fa-circle"></i>';
        }
    }
}

/**
 * Setup event listeners for the profile popup
 */
function setupProfilePopupListeners() {
    // Close button
    const closeButton = document.getElementById('profile-popup-close');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            const popup = document.getElementById('profile-popup');
            if (popup) {
                popup.classList.remove('show');
            }
        });
    }
    
    // Logout button
    const logoutButton = document.getElementById('profile-logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', async function() {
            try {
                const token = localStorage.getItem('customerToken');
                
                if (token) {
                    // Call logout API
                    await fetch('/api/customer/logout', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }).catch(error => {
                        console.error('Error logging out:', error);
                    });
                }
                
                // Clear customer data from localStorage
                localStorage.removeItem('customerData');
                localStorage.removeItem('customerToken');
                
                // Show toast notification
                if (typeof showToast === 'function') {
                    showToast('Logged Out', 'You have been successfully logged out.', 'success');
                }
                
                // Close the popup
                const popup = document.getElementById('profile-popup');
                if (popup) {
                    popup.classList.remove('show');
                }
                
                // Redirect to home page after a short delay
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
                
            } catch (error) {
                console.error('Logout error:', error);
                
                // Even if API call fails, clear local storage
                localStorage.removeItem('customerToken');
                localStorage.removeItem('customerData');
                
                // Redirect to home page
                window.location.href = 'index.html';
            }
        });
    }
}

/**
 * Show the profile popup
 */
function showProfilePopup() {
    const popup = document.getElementById('profile-popup');
    if (popup) {
        popup.classList.add('show');
    }
}

// Make function available globally
window.showProfilePopup = showProfilePopup;
