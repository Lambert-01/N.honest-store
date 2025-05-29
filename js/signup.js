/**
 * N.Honest Sign Up Form Handler
 * Handles user registration with the API
 */

document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signup-form');
    const passwordInput = document.getElementById('password');
    const passwordMeter = document.getElementById('password-meter');
    const errorAlert = document.getElementById('error-alert');
    
    // Session configuration (must match admin.js)
    const SESSION_CONFIG = {
        tokenKey: 'token',
        userKey: 'user',
        sessionTimeout: 30 * 60 * 1000, // 30 minutes
        activityKey: 'lastActivity'
    };
    
    // Password strength checker
    function checkPasswordStrength(password) {
        let strength = 0;
        
        // If password is 6 characters or more, add 1
        if (password.length >= 6) strength += 1;
        
        // If password has both lowercase and uppercase letters, add 1
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength += 1;
        
        // If password has numbers, add 1
        if (password.match(/[0-9]/)) strength += 1;
        
        // If password has special characters, add 1
        if (password.match(/[^a-zA-Z0-9]/)) strength += 1;
        
        return strength;
    }
    
    // Update password strength meter
    if (passwordInput && passwordMeter) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            const strength = checkPasswordStrength(password);
            
            // Reset classes
            passwordMeter.className = 'password-strength-meter';
            
            if (password.length === 0) {
                passwordMeter.style.width = '0';
            } else {
                const widthPercentage = Math.min(25 * strength, 100);
                passwordMeter.style.width = `${widthPercentage}%`;
                
                if (strength <= 1) {
                    passwordMeter.classList.add('weak');
                } else if (strength === 2) {
                    passwordMeter.classList.add('medium');
                } else {
                    passwordMeter.classList.add('strong');
                }
                
                // Add aria attributes for accessibility
                passwordMeter.setAttribute('aria-label', 
                    strength <= 1 ? 'Weak password' : 
                    strength === 2 ? 'Medium strength password' : 
                    'Strong password'
                );
            }
        });
    }
    
    // Check complexity requirements for password
    function validatePasswordComplexity(password) {
        const minLength = 8;
        const hasLowercase = /[a-z]/.test(password);
        const hasUppercase = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[^a-zA-Z0-9]/.test(password);
        
        // Create an array of validation messages
        const requirements = [];
        
        if (password.length < minLength) {
            requirements.push(`Password must be at least ${minLength} characters long`);
        }
        
        if (!hasLowercase) {
            requirements.push('Password must include at least one lowercase letter');
        }
        
        if (!hasUppercase) {
            requirements.push('Password must include at least one uppercase letter');
        }
        
        if (!hasNumber) {
            requirements.push('Password must include at least one number');
        }
        
        if (!hasSpecial) {
            requirements.push('Password must include at least one special character');
        }
        
        return requirements;
    }
    
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const submitButton = e.target.querySelector('button[type="submit"]');
            
            // Clear previous errors
            errorAlert.style.display = 'none';
            errorAlert.innerHTML = '';
            
            // Reset validation states
            signupForm.querySelectorAll('.is-invalid').forEach(el => {
                el.classList.remove('is-invalid');
            });
            
            // Basic field validation
            let isValid = true;
            let focusSet = false;
            
            if (!username || !username.trim()) {
                document.getElementById('username').classList.add('is-invalid');
                isValid = false;
                if (!focusSet) {
                    document.getElementById('username').focus();
                    focusSet = true;
                }
            }
            
            if (!email || !email.trim() || !email.includes('@')) {
                document.getElementById('email').classList.add('is-invalid');
                isValid = false;
                if (!focusSet) {
                    document.getElementById('email').focus();
                    focusSet = true;
                }
            }
            
            // Password validation
            const passwordRequirements = validatePasswordComplexity(password);
            if (passwordRequirements.length > 0) {
                document.getElementById('password').classList.add('is-invalid');
                isValid = false;
                
                // Display password requirements
                let requirementsList = '<ul class="mb-0 ps-3">';
                passwordRequirements.forEach(req => {
                    requirementsList += `<li>${req}</li>`;
                });
                requirementsList += '</ul>';
                
                errorAlert.innerHTML = 'Your password does not meet the following requirements:' + requirementsList;
                errorAlert.style.display = 'block';
                
                if (!focusSet) {
                    document.getElementById('password').focus();
                    focusSet = true;
                }
            }
            
            if (password !== confirmPassword) {
                document.getElementById('confirm-password').classList.add('is-invalid');
                isValid = false;
                errorAlert.textContent = 'Passwords do not match';
                errorAlert.style.display = 'block';
                
                if (!focusSet) {
                    document.getElementById('confirm-password').focus();
                    focusSet = true;
                }
            }
            
            if (!isValid) {
                if (!errorAlert.textContent && !errorAlert.innerHTML) {
                    errorAlert.textContent = 'Please fix the errors in the form';
                    errorAlert.style.display = 'block';
                }
                return;
            }
            
            try {
                submitButton.disabled = true;
                submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating account...';
                
                // Make API request to signup endpoint
                const response = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        username, 
                        email, 
                        password,
                        role: 'staff' // Default role for self-registration
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || data.message || 'Sign up failed');
                }

                // Store token and user data in localStorage
                localStorage.setItem(SESSION_CONFIG.tokenKey, data.token);
                localStorage.setItem(SESSION_CONFIG.userKey, JSON.stringify(data.user));
                
                // Set last activity timestamp
                localStorage.setItem(SESSION_CONFIG.activityKey, Date.now().toString());

                // Show success message
                const successAlert = document.createElement('div');
                successAlert.className = 'alert alert-success';
                successAlert.innerHTML = '<strong>Account created successfully!</strong> Redirecting to admin panel...';
                
                // Replace error alert or add after form
                if (errorAlert) {
                    errorAlert.replaceWith(successAlert);
                } else {
                    signupForm.after(successAlert);
                }
                
                // Redirect to admin panel after a short delay
                setTimeout(() => {
                    window.location.href = '/admin.html';
                }, 1500);
                
            } catch (error) {
                console.error('Signup error:', error);
                
                // Check for specific error messages
                if (error.message.includes('exists') || error.message.includes('taken')) {
                    // Username or email already exists
                    if (error.message.toLowerCase().includes('username')) {
                        document.getElementById('username').classList.add('is-invalid');
                    }
                    if (error.message.toLowerCase().includes('email')) {
                        document.getElementById('email').classList.add('is-invalid');
                    }
                }
                
                errorAlert.textContent = error.message;
                errorAlert.style.display = 'block';
                
                // Add shake animation for better feedback
                signupForm.classList.add('animate__animated', 'animate__shakeX');
                setTimeout(() => {
                    signupForm.classList.remove('animate__animated', 'animate__shakeX');
                }, 1000);
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-user-plus me-2"></i>Sign Up';
            }
        });
    }

    // Check if user is already logged in
    const token = localStorage.getItem(SESSION_CONFIG.tokenKey);
    if (token) {
        try {
            // Check token expiration if we have it
            const user = JSON.parse(localStorage.getItem(SESSION_CONFIG.userKey) || '{}');
            if (user.exp && user.exp * 1000 < Date.now()) {
                // Token expired, clear it
                localStorage.removeItem(SESSION_CONFIG.tokenKey);
                localStorage.removeItem(SESSION_CONFIG.userKey);
                localStorage.removeItem(SESSION_CONFIG.activityKey);
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
                    return;
                }
            }
            
            // Already logged in, redirect to admin panel
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