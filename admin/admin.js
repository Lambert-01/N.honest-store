

// Session configuration
const SESSION_CONFIG = {
    tokenKey: 'token',
    userKey: 'user',
    sessionTimeout: 30 * 60 * 1000, // 30 minutes in milliseconds
    refreshThreshold: 5 * 60 * 1000, // 5 minutes before expiry to refresh
    activityKey: 'lastActivity',
    warningTime: 1 * 60 * 1000, // Show warning 1 minute before timeout
    maxLoginAttempts: 5,
    lockoutTime: 15 * 60 * 1000, // 15 minutes lockout after too many attempts
    twoFactorEnabled: false
};

// Add authentication headers to fetch requests
function getAuthHeaders() {
    const token = localStorage.getItem(SESSION_CONFIG.tokenKey);
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Check if user is authenticated
function isAuthenticated() {
    const token = localStorage.getItem(SESSION_CONFIG.tokenKey);
    const user = JSON.parse(localStorage.getItem(SESSION_CONFIG.userKey) || '{}');
    const lastActivity = localStorage.getItem(SESSION_CONFIG.activityKey);
    
    if (!token || !user || !lastActivity) {
        return false;
    }
    
    // Check if session has timed out due to inactivity
    const now = Date.now();
    const lastActivityTime = parseInt(lastActivity, 10);
    if (now - lastActivityTime > SESSION_CONFIG.sessionTimeout) {
        // Session expired due to inactivity
        clearSession();
        return false;
    }
    
    // Check if token has expired (if we have expiration data)
    if (user.exp && user.exp * 1000 < now) {
        // Token expired
        clearSession();
        return false;
    }
    
    return true;
}

// Record user activity to keep session alive
function recordActivity() {
    if (isAuthenticated()) {
        localStorage.setItem(SESSION_CONFIG.activityKey, Date.now().toString());
    }
}

// Clear all session data
function clearSession() {
    localStorage.removeItem(SESSION_CONFIG.tokenKey);
    localStorage.removeItem(SESSION_CONFIG.userKey);
    localStorage.removeItem(SESSION_CONFIG.activityKey);
    
    // Clear any other session-related items
    localStorage.removeItem('sessionActive');
    sessionStorage.clear();
    
    // Remove any auth cookies (if using cookies alongside localStorage)
    document.cookie = "auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

// Initialize session timeout monitoring
function initSessionMonitoring() {
    // Record activity on user interactions
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, recordActivity, { passive: true });
    });
    
    // Set up interval to check session status
    const checkInterval = Math.min(SESSION_CONFIG.warningTime, 60000); // Check at least every minute
    let sessionCheckTimer = setInterval(checkSessionStatus, checkInterval);
    let sessionWarningDisplayed = false;
    
    // Function to check session status
    function checkSessionStatus() {
        if (!isAuthenticated()) {
            // Not authenticated anymore, redirect to login
            redirectToLogin();
            return;
        }
        
        const lastActivity = parseInt(localStorage.getItem(SESSION_CONFIG.activityKey), 10);
        const now = Date.now();
        const timeElapsed = now - lastActivity;
        const timeRemaining = SESSION_CONFIG.sessionTimeout - timeElapsed;
        
        // Check if we need to display timeout warning
        if (timeRemaining <= SESSION_CONFIG.warningTime && !sessionWarningDisplayed) {
            showSessionTimeoutWarning(Math.ceil(timeRemaining / 1000));
            sessionWarningDisplayed = true;
        }
        
        // Check if we need to attempt token refresh
        const user = JSON.parse(localStorage.getItem(SESSION_CONFIG.userKey) || '{}');
        if (user.exp) {
            const tokenExpiry = user.exp * 1000;
            if (tokenExpiry - now <= SESSION_CONFIG.refreshThreshold) {
                refreshToken();
            }
        }
    }
    
    // Initial check
    checkSessionStatus();
}

// Show warning before session times out
function showSessionTimeoutWarning(secondsRemaining) {
    // Create or get the warning modal
    let modal = document.getElementById('session-timeout-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'session-timeout-modal';
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('aria-hidden', 'true');
        
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-warning">
                        <h5 class="modal-title">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Session Timeout Warning
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p class="mb-0">Your session is about to expire due to inactivity. You will be logged out in <span id="timeout-countdown">${secondsRemaining}</span> seconds.</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Dismiss</button>
                        <button type="button" class="btn btn-primary" id="extend-session-btn">
                            <i class="fas fa-clock me-1"></i>
                            Extend Session
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Set up the event listener for extending session
        document.getElementById('extend-session-btn').addEventListener('click', function() {
            recordActivity();
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        });
    }
    
    // Show the modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Start the countdown
    const countdownEl = document.getElementById('timeout-countdown');
    let countdownValue = secondsRemaining;
    
    const countdownTimer = setInterval(() => {
        countdownValue--;
        if (countdownEl) countdownEl.textContent = countdownValue;
        
        if (countdownValue <= 0) {
            clearInterval(countdownTimer);
            bsModal.hide();
            redirectToLogin('Your session has expired due to inactivity.');
        }
    }, 1000);
    
    // Clear timer when modal is hidden
    modal.addEventListener('hidden.bs.modal', function() {
        clearInterval(countdownTimer);
    });
}

// Attempt to refresh the authentication token
async function refreshToken() {
    try {
        const response = await fetch('/api/auth/refresh-token', {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Update token and user data
            localStorage.setItem(SESSION_CONFIG.tokenKey, data.token);
            localStorage.setItem(SESSION_CONFIG.userKey, JSON.stringify(data.user));
            localStorage.setItem(SESSION_CONFIG.activityKey, Date.now().toString());
            
            return true;
        }
        
        // If refresh failed, consider clearing the session
        return false;
    } catch (error) {
        console.error('Token refresh failed:', error);
        return false;
    }
}

// Redirect to login page with optional error message
function redirectToLogin(message) {
    clearSession();
    
    if (message) {
        // Store message to be displayed on login page
        sessionStorage.setItem('loginMessage', message);
    }
    
    window.location.href = '/login.html';
}

// Check if user has permission for a specific action
function hasPermission(permission) {
    const user = JSON.parse(localStorage.getItem(SESSION_CONFIG.userKey) || '{}');
    
    // If user has roles/permissions array
    if (user.permissions && Array.isArray(user.permissions)) {
        return user.permissions.includes(permission);
    }
    
    // If user has role-based permissions
    if (user.role) {
        const adminRoles = ['admin', 'superadmin', 'owner'];
        
        // Superadmin can do everything
        if (adminRoles.includes(user.role.toLowerCase())) {
            return true;
        }
        
        // Add role-specific permission logic here
        switch (user.role.toLowerCase()) {
            case 'manager':
                // Managers can do most things except user management
                return !permission.startsWith('user.manage');
            case 'staff':
                // Staff have limited permissions
                const staffPermissions = [
                    'products.view', 'orders.view', 'customers.view',
                    'products.edit', 'orders.process'
                ];
                return staffPermissions.includes(permission);
            default:
                return false;
        }
    }
    
    return false;
}

// Handle user logout
function handleLogout() {
    // Show confirmation dialog
    if (confirm('Are you sure you want to log out?')) {
        // Send logout request to invalidate token on server
        fetch('/api/auth/logout', {
            method: 'POST',
            headers: getAuthHeaders()
        }).finally(() => {
            // Clear session data and redirect
            clearSession();
            window.location.href = '/login.html';
        });
    }
}

// Protect admin routes requiring authentication
function protectAdminRoute() {
    if (!isAuthenticated()) {
        redirectToLogin('Please log in to access the admin panel.');
        return false;
    }
    return true;
}

// Initialize security features when document is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication for admin pages
    if (window.location.pathname.includes('admin')) {
        if (!protectAdminRoute()) return;
        
        // Set up session monitoring
        initSessionMonitoring();
        
        // Set up logout button handlers
        const logoutBtns = document.querySelectorAll('#logout-btn, #nav-logout-btn');
        logoutBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                handleLogout();
            });
        });
        
        // Apply permission-based UI restrictions
        applyPermissions();
    }
    
    // Add CSRF token to all forms (if using CSRF protection)
    addCsrfTokenToForms();
});

// Apply UI restrictions based on user permissions
function applyPermissions() {
    const user = JSON.parse(localStorage.getItem(SESSION_CONFIG.userKey) || '{}');
    
    // Update user display info
    const userNameElements = document.querySelectorAll('.user-display-name');
    userNameElements.forEach(el => {
        el.textContent = user.username || user.name || user.email || '------';
    });
    
    // Hide UI elements based on permissions
    if (!hasPermission('users.manage')) {
        // Hide user management UI
        const userManagementElements = document.querySelectorAll('[data-requires-permission="users.manage"]');
        userManagementElements.forEach(el => el.style.display = 'none');
    }
    
    if (!hasPermission('settings.edit')) {
        // Make settings read-only
        const settingsInputs = document.querySelectorAll('#settings-section input, #settings-section select, #settings-section textarea');
        settingsInputs.forEach(input => {
            input.setAttribute('readonly', 'readonly');
            input.classList.add('bg-light');
        });
        
        // Hide settings save buttons
        const settingsSaveButtons = document.querySelectorAll('#settings-section button[type="submit"]');
        settingsSaveButtons.forEach(btn => btn.style.display = 'none');
    }
}

// Add CSRF token to all forms if using CSRF protection
function addCsrfTokenToForms() {
    const csrfToken = localStorage.getItem('csrfToken');
    if (!csrfToken) return;
    
    document.querySelectorAll('form').forEach(form => {
        let csrfInput = form.querySelector('input[name="_csrf"]');
        if (!csrfInput) {
            csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = '_csrf';
            form.appendChild(csrfInput);
        }
        csrfInput.value = csrfToken;
    });
}

// Update the category check endpoint
async function checkCategoryExists(name) {
    try {
        const response = await fetch(`/api/categories/check?name=${encodeURIComponent(name)}`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to check category');
        }
        
        const data = await response.json();
        return data.exists;
    } catch (error) {
        console.error('Error checking category:', error);
        throw error;
    }
} 