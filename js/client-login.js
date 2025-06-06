/**
 * N.Honest Customer Login Form Handler
 * Handles customer authentication with the API and Google OAuth
 */

// Global variables for alerts
let errorAlert;
let successAlert;

// Initialize alerts on load
document.addEventListener('DOMContentLoaded', () => {
    errorAlert = document.getElementById('error-alert');
    successAlert = document.getElementById('success-alert');
});

// Helper functions for showing messages
function showErrorMessage(message) {
    if (errorAlert) {
        errorAlert.textContent = message;
        errorAlert.style.display = 'block';
        if (successAlert) successAlert.style.display = 'none';
    }
}

function showSuccessMessage(message) {
    if (successAlert) {
        successAlert.textContent = message;
        successAlert.style.display = 'block';
        if (errorAlert) errorAlert.style.display = 'none';
    }
}

// Function to handle Google Sign-In callback
function handleGoogleSignIn(response) {
    console.log('Google Sign-In response received:', response);
    
    if (!response || !response.credential) {
        showErrorMessage('Failed to get Google credentials');
        return;
    }

    const credential = response.credential;
    
    // Get API URL
    const apiUrl = getApiUrl();
    console.log('Using API URL for Google auth:', apiUrl);
    
    fetch(`${apiUrl}/api/customer/google/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ credential })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Google authentication failed');
            });
        }
        return response.json();
    })
    .then(data => {
        localStorage.setItem('customerToken', data.token);
        localStorage.setItem('customer', JSON.stringify(data.customer));
        localStorage.setItem('customerLastActivity', Date.now().toString());
        
        showSuccessMessage('Login successful! Redirecting...');
        
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    })
    .catch(error => {
        console.error('Google auth error:', error);
        showErrorMessage(error.message || 'Failed to authenticate with Google');
    });
}

// Function to determine the API URL based on environment
function getApiUrl() {
    const hostname = window.location.hostname;
    console.log('Current hostname:', hostname);
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return '';
}

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const resendVerificationForm = document.getElementById('resend-verification-form');
    
    // Session configuration
    const SESSION_CONFIG = {
        tokenKey: 'customerToken',
        userKey: 'customer',
        sessionTimeout: 24 * 60 * 60 * 1000,
        activityKey: 'customerLastActivity'
    };
    
    // Hide alerts initially
    if (errorAlert) errorAlert.style.display = 'none';
    if (successAlert) successAlert.style.display = 'none';
    
    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('verified') === 'true') {
        showSuccessMessage('Email verified successfully! You can now log in.');
    }
    
    if (urlParams.get('reset') === 'true') {
        showSuccessMessage('Password reset successfully! You can now log in with your new password.');
    }
    
    // Check for stored messages
    const loginMessage = sessionStorage.getItem('customerLoginMessage');
    if (loginMessage) {
        if (loginMessage.includes('success:')) {
            showSuccessMessage(loginMessage.replace('success:', ''));
        } else {
            showErrorMessage(loginMessage);
        }
        sessionStorage.removeItem('customerLoginMessage');
    }
    
    // Handle login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitButton = e.target.querySelector('button[type="submit"]');
            
            if (errorAlert) errorAlert.style.display = 'none';
            if (successAlert) successAlert.style.display = 'none';
            
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';
            
            try {
                const apiUrl = getApiUrl();
                console.log('Using API URL for login:', apiUrl);
                
                const response = await fetch(`${apiUrl}/api/customer/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Login failed');
                }
                
                if (data.needsVerification) {
                    loginForm.style.display = 'none';
                    resendVerificationForm.style.display = 'block';
                    document.getElementById('verification-email').value = email;
                    return;
                }
                
                localStorage.setItem(SESSION_CONFIG.tokenKey, data.token);
                localStorage.setItem(SESSION_CONFIG.userKey, JSON.stringify(data.customer));
                localStorage.setItem(SESSION_CONFIG.activityKey, Date.now().toString());
                
                showSuccessMessage('Login successful! Redirecting...');
                
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
                
            } catch (error) {
                console.error('Login error:', error);
                showErrorMessage(error.message);
                
                loginForm.classList.add('animate__animated', 'animate__shakeX');
                setTimeout(() => {
                    loginForm.classList.remove('animate__animated', 'animate__shakeX');
                }, 1000);
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Login';
            }
        });
    }
    
    // Handle password visibility toggle
    const togglePassword = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.querySelector('i').classList.toggle('fa-eye');
            this.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }
    
    // Form navigation
    document.getElementById('forgot-password-link')?.addEventListener('click', function(e) {
        e.preventDefault();
        loginForm.style.display = 'none';
        forgotPasswordForm.style.display = 'block';
        resendVerificationForm.style.display = 'none';
    });
    
    document.getElementById('back-to-login')?.addEventListener('click', function() {
        forgotPasswordForm.style.display = 'none';
        loginForm.style.display = 'block';
    });
    
    document.getElementById('back-to-login-from-verification')?.addEventListener('click', function() {
        resendVerificationForm.style.display = 'none';
        loginForm.style.display = 'block';
    });
    
    // Check if already logged in
    const token = localStorage.getItem(SESSION_CONFIG.tokenKey);
    if (token) {
        try {
            const customer = JSON.parse(localStorage.getItem(SESSION_CONFIG.userKey) || '{}');
            if (customer.exp && customer.exp < Math.floor(Date.now() / 1000)) {
                localStorage.removeItem(SESSION_CONFIG.tokenKey);
                localStorage.removeItem(SESSION_CONFIG.userKey);
                localStorage.removeItem(SESSION_CONFIG.activityKey);
                showErrorMessage('Your session has expired. Please login again.');
                return;
            }
            
            const lastActivity = localStorage.getItem(SESSION_CONFIG.activityKey);
            if (lastActivity) {
                const now = Date.now();
                const lastActivityTime = parseInt(lastActivity, 10);
                if (now - lastActivityTime > SESSION_CONFIG.sessionTimeout) {
                    localStorage.removeItem(SESSION_CONFIG.tokenKey);
                    localStorage.removeItem(SESSION_CONFIG.userKey);
                    localStorage.removeItem(SESSION_CONFIG.activityKey);
                    showErrorMessage('Your session has timed out due to inactivity. Please login again.');
                    return;
                }
            }
            
            console.log('Valid customer token found, redirecting to store');
            window.location.href = '/';
        } catch (error) {
            console.error('Error checking login status:', error);
            localStorage.removeItem(SESSION_CONFIG.tokenKey);
            localStorage.removeItem(SESSION_CONFIG.userKey);
            localStorage.removeItem(SESSION_CONFIG.activityKey);
        }
    }
});
