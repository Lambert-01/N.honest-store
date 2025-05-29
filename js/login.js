/**
 * N.Honest Login Form Handler
 * Handles authentication with the API
 */

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const errorAlert = document.getElementById('error-alert');
    
    // Session configuration (must match admin.js)
    const SESSION_CONFIG = {
        tokenKey: 'token',
        userKey: 'user',
        sessionTimeout: 30 * 60 * 1000, // 30 minutes in milliseconds
        activityKey: 'lastActivity',
        maxLoginAttempts: 5,
        lockoutKey: 'loginLockout',
        attemptsKey: 'loginAttempts'
    };
    
    // Check for and display any stored login messages
    const loginMessage = sessionStorage.getItem('loginMessage');
    if (loginMessage && errorAlert) {
        errorAlert.textContent = loginMessage;
        errorAlert.style.display = 'block';
        
        // If it's a session expiry message, add a different style
        if (loginMessage.includes('expired') || loginMessage.includes('timeout')) {
            errorAlert.classList.remove('alert-danger');
            errorAlert.classList.add('alert-warning');
        }
        
        // Clear the message after displaying it
        sessionStorage.removeItem('loginMessage');
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
            errorAlert.textContent = `Too many failed login attempts. Please try again in ${minutesRemaining} ${minutesRemaining === 1 ? 'minute' : 'minutes'}.`;
            errorAlert.style.display = 'block';
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
            
            errorAlert.textContent = `Too many failed login attempts. Your account has been temporarily locked for 15 minutes.`;
            errorAlert.style.display = 'block';
            return true;
        }
        
        // Show remaining attempts
        const remainingAttempts = SESSION_CONFIG.maxLoginAttempts - newAttempts;
        if (remainingAttempts <= 2) {
            errorAlert.textContent += ` You have ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining before your account is temporarily locked.`;
        }
        
        return false;
    }
    
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
            
            // Clear previous errors
            errorAlert.style.display = 'none';
            
            // Clear any previous validation states
            loginForm.querySelectorAll('.is-invalid').forEach(el => {
                el.classList.remove('is-invalid');
            });
            
            // Validate input fields
            let isValid = true;
            if (!email || !email.trim()) {
                document.getElementById('email').classList.add('is-invalid');
                isValid = false;
            }
            
            if (!password || !password.trim()) {
                document.getElementById('password').classList.add('is-invalid');
                isValid = false;
            }
            
            if (!isValid) {
                errorAlert.textContent = 'Email and password are required';
                errorAlert.style.display = 'block';
                return;
            }
            
            try {
                submitButton.disabled = true;
                submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';
                
                // Make API request to login endpoint
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || data.message || `Login failed (${response.status})`);
                }

                // Store token and user data in localStorage
                localStorage.setItem(SESSION_CONFIG.tokenKey, data.token);
                localStorage.setItem(SESSION_CONFIG.userKey, JSON.stringify(data.user));

                // Set last activity timestamp
                localStorage.setItem(SESSION_CONFIG.activityKey, Date.now().toString());
                
                // Clear any login attempts since login was successful
                localStorage.removeItem(SESSION_CONFIG.attemptsKey);
                localStorage.removeItem(SESSION_CONFIG.lockoutKey);

                // Show success message before redirect
                const successAlert = document.createElement('div');
                successAlert.className = 'alert alert-success';
                successAlert.textContent = 'Login successful! Redirecting to admin panel...';
                
                // Replace error alert or add after form
                if (errorAlert) {
                    errorAlert.replaceWith(successAlert);
                } else {
                    loginForm.after(successAlert);
                }
                
                // Redirect to admin panel after a short delay
                setTimeout(() => {
                    window.location.href = '/admin.html';
                }, 1000);
                
            } catch (error) {
                console.error('Login error:', error);
                errorAlert.textContent = error.message;
                errorAlert.style.display = 'block';
                
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

    // Check if user is already logged in
    const token = localStorage.getItem(SESSION_CONFIG.tokenKey);
    if (token) {
        try {
            // Check token expiration if we have it
            const user = JSON.parse(localStorage.getItem(SESSION_CONFIG.userKey) || '{}');
            if (user.exp && user.exp < Math.floor(Date.now() / 1000)) {
                // Token expired, clear it
                localStorage.removeItem(SESSION_CONFIG.tokenKey);
                localStorage.removeItem(SESSION_CONFIG.userKey);
                localStorage.removeItem(SESSION_CONFIG.activityKey);
                
                // Show expired message if on login page
                if (errorAlert) {
                    errorAlert.textContent = 'Your session has expired. Please login again.';
                    errorAlert.style.display = 'block';
                }
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
                    if (errorAlert) {
                        errorAlert.textContent = 'Your session has timed out due to inactivity. Please login again.';
                        errorAlert.style.display = 'block';
                    }
                    return;
                }
            }
            
            // Valid token and active session, redirect to admin panel
            console.log('Valid token found, redirecting to admin panel');
            window.location.href = '/admin.html';
        } catch (error) {
            console.error('Error checking login status:', error);
            // Clear potentially corrupted data
            localStorage.removeItem(SESSION_CONFIG.tokenKey);
            localStorage.removeItem(SESSION_CONFIG.userKey);
            localStorage.removeItem(SESSION_CONFIG.activityKey);
        }
    }
}); 