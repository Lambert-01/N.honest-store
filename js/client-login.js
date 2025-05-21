/**
 * N.Honest Customer Login Form Handler
 * Handles customer authentication with the API
 */

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const resendVerificationForm = document.getElementById('resend-verification-form');
    const errorAlert = document.getElementById('error-alert');
    const successAlert = document.getElementById('success-alert');
    
    // Session configuration
    const SESSION_CONFIG = {
        tokenKey: 'customerToken',
        userKey: 'customer',
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        activityKey: 'customerLastActivity',
        maxLoginAttempts: 5,
        lockoutKey: 'customerLoginLockout',
        attemptsKey: 'customerLoginAttempts'
    };
    
    // Hide alerts initially
    if (errorAlert) errorAlert.style.display = 'none';
    if (successAlert) successAlert.style.display = 'none';
    
    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    // Handle email verification success
    if (urlParams.get('verified') === 'true') {
        showSuccessMessage('Email verified successfully! You can now log in.');
    }
    
    // Handle password reset success
    if (urlParams.get('reset') === 'true') {
        showSuccessMessage('Password reset successfully! You can now log in with your new password.');
    }
    
    // Check for and display any stored login messages
    const loginMessage = sessionStorage.getItem('customerLoginMessage');
    if (loginMessage) {
        if (loginMessage.includes('success')) {
            showSuccessMessage(loginMessage.replace('success:', ''));
        } else {
            showErrorMessage(loginMessage);
        }
        
        // Clear the message after displaying it
        sessionStorage.removeItem('customerLoginMessage');
    }
    
    // Check if the user is in a lockout state
    function isUserLockedOut() {
        const lockoutUntil = localStorage.getItem(SESSION_CONFIG.lockoutKey);
        if (!lockoutUntil) return false;
        
        const lockoutTime = parseInt(lockoutUntil, 10);
        const now = Date.now();
        
        if (now < lockoutTime) {
            // User is still in lockout period
            const minutesRemaining = Math.ceil((lockoutTime - now) / 60000);
            showErrorMessage(`Too many failed login attempts. Please try again in ${minutesRemaining} ${minutesRemaining === 1 ? 'minute' : 'minutes'}.`);
            return true;
        } else {
            // Lockout period has expired, clear it
            localStorage.removeItem(SESSION_CONFIG.lockoutKey);
            localStorage.removeItem(SESSION_CONFIG.attemptsKey);
            return false;
        }
    }
    
    // Increment login attempts and manage lockout
    function handleFailedLogin() {
        const currentAttempts = parseInt(localStorage.getItem(SESSION_CONFIG.attemptsKey) || '0', 10);
        const newAttempts = currentAttempts + 1;
        
        localStorage.setItem(SESSION_CONFIG.attemptsKey, newAttempts.toString());
        
        if (newAttempts >= SESSION_CONFIG.maxLoginAttempts) {
            // Set lockout for 15 minutes
            const lockoutUntil = Date.now() + (15 * 60 * 1000);
            localStorage.setItem(SESSION_CONFIG.lockoutKey, lockoutUntil.toString());
            
            showErrorMessage(`Too many failed login attempts. Your account has been temporarily locked for 15 minutes.`);
            return true;
        }
        
        // Show remaining attempts
        const remainingAttempts = SESSION_CONFIG.maxLoginAttempts - newAttempts;
        if (remainingAttempts <= 2) {
            errorAlert.textContent += ` You have ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining before your account is temporarily locked.`;
        }
        
        return false;
    }
    
    // Helper function to show error message
    function showErrorMessage(message) {
        if (errorAlert) {
            errorAlert.textContent = message;
            errorAlert.style.display = 'block';
            successAlert.style.display = 'none';
        }
    }
    
    // Helper function to show success message
    function showSuccessMessage(message) {
        if (successAlert) {
            successAlert.textContent = message;
            successAlert.style.display = 'block';
            errorAlert.style.display = 'none';
        }
    }
    
    // Toggle between forms
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
    
    // Handle login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Check if user is locked out first
            if (isUserLockedOut()) {
                return;
            }
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitButton = e.target.querySelector('button[type="submit"]');
            
            // Clear previous alerts
            errorAlert.style.display = 'none';
            successAlert.style.display = 'none';
            
            // Disable button and show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';
            
            try {
                const response = await fetch('/api/customer/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Login failed');
                }
                
                // Check if email needs verification
                if (data.needsVerification) {
                    // Show resend verification form
                    loginForm.style.display = 'none';
                    resendVerificationForm.style.display = 'block';
                    document.getElementById('verification-email').value = email;
                    return;
                }
                
                // Store token and user data
                localStorage.setItem(SESSION_CONFIG.tokenKey, data.token);
                localStorage.setItem(SESSION_CONFIG.userKey, JSON.stringify(data.customer));
                localStorage.setItem(SESSION_CONFIG.activityKey, Date.now().toString());
                
                // Clear any failed login attempts
                localStorage.removeItem(SESSION_CONFIG.attemptsKey);
                
                // Show success message
                showSuccessMessage('Login successful! Redirecting...');
                
                // Redirect to store page after a short delay
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
                
            } catch (error) {
                console.error('Login error:', error);
                showErrorMessage(error.message);
                
                // Handle failed login attempt
                const isLockedOut = handleFailedLogin();
                if (isLockedOut) {
                    // Disable the form if user is locked out
                    submitButton.disabled = true;
                    document.getElementById('email').disabled = true;
                    document.getElementById('password').disabled = true;
                }
                
                // Add shake animation to the form for better feedback
                loginForm.classList.add('animate__animated', 'animate__shakeX');
                setTimeout(() => {
                    loginForm.classList.remove('animate__animated', 'animate__shakeX');
                }, 1000);
            } finally {
                if (!isUserLockedOut()) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Login';
                }
            }
        });
    }
    
    // Handle forgot password form submission
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('reset-email').value;
            const submitButton = e.target.querySelector('button[type="submit"]');
            
            // Clear previous alerts
            errorAlert.style.display = 'none';
            successAlert.style.display = 'none';
            
            // Disable button and show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';
            
            try {
                const response = await fetch('/api/customer/forgot-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to send reset link');
                }
                
                // Store success message for login page
                sessionStorage.setItem('customerLoginMessage', 'success:' + data.message);
                
                // Show success message
                showSuccessMessage('Password reset link sent! Please check your email.');
                
                // Switch back to login form after a delay
                setTimeout(() => {
                    forgotPasswordForm.style.display = 'none';
                    loginForm.style.display = 'block';
                }, 3000);
                
            } catch (error) {
                console.error('Forgot password error:', error);
                showErrorMessage(error.message);
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Send Reset Link';
            }
        });
    }
    
    // Handle resend verification form submission
    if (resendVerificationForm) {
        resendVerificationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('verification-email').value;
            const submitButton = e.target.querySelector('button[type="submit"]');
            
            // Clear previous alerts
            errorAlert.style.display = 'none';
            successAlert.style.display = 'none';
            
            // Disable button and show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';
            
            try {
                const response = await fetch('/api/customer/resend-verification', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to resend verification email');
                }
                
                // Show success message
                showSuccessMessage('Verification email sent! Please check your inbox.');
                
                // Switch back to login form after a delay
                setTimeout(() => {
                    resendVerificationForm.style.display = 'none';
                    loginForm.style.display = 'block';
                }, 3000);
                
            } catch (error) {
                console.error('Resend verification error:', error);
                showErrorMessage(error.message);
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Resend Verification';
            }
        });
    }

    // Check if user is already logged in
    const token = localStorage.getItem(SESSION_CONFIG.tokenKey);
    if (token) {
        try {
            // Check token expiration if we have it
            const customer = JSON.parse(localStorage.getItem(SESSION_CONFIG.userKey) || '{}');
            if (customer.exp && customer.exp < Math.floor(Date.now() / 1000)) {
                // Token expired, clear it
                localStorage.removeItem(SESSION_CONFIG.tokenKey);
                localStorage.removeItem(SESSION_CONFIG.userKey);
                localStorage.removeItem(SESSION_CONFIG.activityKey);
                
                // Show expired message
                showErrorMessage('Your session has expired. Please login again.');
                return;
            }
            
            // Check if session has timed out due to inactivity
            const lastActivity = localStorage.getItem(SESSION_CONFIG.activityKey);
            if (lastActivity) {
                const now = Date.now();
                const lastActivityTime = parseInt(lastActivity, 10);
                if (now - lastActivityTime > SESSION_CONFIG.sessionTimeout) {
                    // Session expired due to inactivity
                    localStorage.removeItem(SESSION_CONFIG.tokenKey);
                    localStorage.removeItem(SESSION_CONFIG.userKey);
                    localStorage.removeItem(SESSION_CONFIG.activityKey);
                    
                    // Show timeout message
                    showErrorMessage('Your session has timed out due to inactivity. Please login again.');
                    return;
                }
            }
            
            // Valid token and active session, redirect to store page
            console.log('Valid customer token found, redirecting to store');
            window.location.href = '/';
        } catch (error) {
            console.error('Error checking login status:', error);
            // Clear potentially corrupted data
            localStorage.removeItem(SESSION_CONFIG.tokenKey);
            localStorage.removeItem(SESSION_CONFIG.userKey);
            localStorage.removeItem(SESSION_CONFIG.activityKey);
        }
    }
});
