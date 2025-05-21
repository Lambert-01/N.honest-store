/**
 * N.Honest Account Management
 * Handles customer authentication and account management in the modal
 */

// Google Sign-In initialization
let googleUser = null;

function initGoogleSignIn() {
    // Initialize Google Sign-In
    google.accounts.id.initialize({
        client_id: 'YOUR_GOOGLE_CLIENT_ID', // Replace with your actual Google Client ID
        callback: handleGoogleSignIn,
        auto_select: false,
        cancel_on_tap_outside: true
    });
    
    // Set up Google Sign-In buttons
    document.getElementById('google-signin-btn').addEventListener('click', function() {
        google.accounts.id.prompt();
    });
    
    document.getElementById('google-signup-btn').addEventListener('click', function() {
        google.accounts.id.prompt();
    });
}

// Handle Google Sign-In response
async function handleGoogleSignIn(response) {
    try {
        showSpinner();
        
        const result = await fetch('/api/customer/google-signin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: response.credential })
        });
        
        const data = await result.json();
        
        if (result.ok) {
            // Save token and user data
            localStorage.setItem('customerToken', data.token);
            localStorage.setItem('customerData', JSON.stringify(data.customer));
            
            // Update UI
            updateAccountUI(data.customer);
            showAccountTab();
            showSuccessAlert('Successfully signed in with Google!');
            
            // Close modal if needed
            // $('#accountModal').modal('hide');
        } else {
            showErrorAlert(data.error || 'Google sign-in failed');
        }
    } catch (error) {
        console.error('Google sign-in error:', error);
        showErrorAlert('Failed to sign in with Google. Please try again.');
    } finally {
        hideSpinner();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Google Sign-In
    if (typeof google !== 'undefined' && google.accounts) {
        initGoogleSignIn();
    } else {
        // If Google API is not loaded yet, wait and try again
        window.addEventListener('load', function() {
            if (typeof google !== 'undefined' && google.accounts) {
                initGoogleSignIn();
            } else {
                console.error('Google Sign-In API failed to load');
            }
        });
    }
    // DOM Elements
    const accountButton = document.getElementById('accountButton');
    const accountStatusIndicator = document.querySelector('.account-status-indicator');
    const accountModal = document.getElementById('accountModal');
    const accountTabItem = document.getElementById('account-tab-item');
    const accountTab = document.getElementById('account-tab');
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    
    // Forms
    const loginForm = document.getElementById('modal-login-form');
    const signupForm = document.getElementById('modal-signup-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const editProfileForm = document.getElementById('edit-profile-form');
    const changePasswordForm = document.getElementById('change-password-form');
    
    // Buttons and links
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const backToLoginBtn = document.getElementById('back-to-login');
    const logoutBtn = document.getElementById('logout-btn');
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const backToAccountBtn = document.getElementById('back-to-account');
    const backFromPasswordBtn = document.getElementById('back-from-password');
    
    // Alerts
    const loginError = document.getElementById('login-error');
    const loginSuccess = document.getElementById('login-success');
    const signupError = document.getElementById('signup-error');
    const signupSuccess = document.getElementById('signup-success');
    const forgotError = document.getElementById('forgot-error');
    const forgotSuccess = document.getElementById('forgot-success');
    const profileError = document.getElementById('profile-error');
    const profileSuccess = document.getElementById('profile-success');
    const passwordError = document.getElementById('password-error');
    const passwordSuccess = document.getElementById('password-success');
    
    // Session configuration
    const SESSION_CONFIG = {
        tokenKey: 'customerToken',
        userKey: 'customer',
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        activityKey: 'customerLastActivity'
    };
    
    // Check authentication status on page load
    checkAuthStatus();
    
    // Toggle password visibility
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            
            // Toggle eye icon
            const icon = this.querySelector('i');
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        });
    });
    
    // Show forgot password form
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            loginForm.classList.add('d-none');
            forgotPasswordForm.classList.remove('d-none');
        });
    }
    
    // Back to login from forgot password
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            forgotPasswordForm.classList.add('d-none');
            loginForm.classList.remove('d-none');
        });
    }
    
    // Edit profile button
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelector('#account-tab-pane > div:not(#edit-profile-form)').classList.add('d-none');
            editProfileForm.classList.remove('d-none');
            
            // Load user data into form
            const customer = JSON.parse(localStorage.getItem(SESSION_CONFIG.userKey) || '{}');
            document.getElementById('profile-firstname').value = customer.firstName || '';
            document.getElementById('profile-lastname').value = customer.lastName || '';
            document.getElementById('profile-email').value = customer.email || '';
            document.getElementById('profile-phone').value = customer.phone || '';
        });
    }
    
    // Back to account from edit profile
    if (backToAccountBtn) {
        backToAccountBtn.addEventListener('click', function(e) {
            e.preventDefault();
            editProfileForm.classList.add('d-none');
            document.querySelector('#account-tab-pane > div:not(#edit-profile-form)').classList.remove('d-none');
        });
    }
    
    // Change password button
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelector('#account-tab-pane > div:not(#change-password-form)').classList.add('d-none');
            changePasswordForm.classList.remove('d-none');
        });
    }
    
    // Back from change password
    if (backFromPasswordBtn) {
        backFromPasswordBtn.addEventListener('click', function(e) {
            e.preventDefault();
            changePasswordForm.classList.add('d-none');
            document.querySelector('#account-tab-pane > div:not(#change-password-form)').classList.remove('d-none');
        });
    }
    
    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            try {
                const token = localStorage.getItem(SESSION_CONFIG.tokenKey);
                
                if (token) {
                    // Call logout API
                    await fetch('/api/customer/logout', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                }
                
                // Clear local storage
                localStorage.removeItem(SESSION_CONFIG.tokenKey);
                localStorage.removeItem(SESSION_CONFIG.userKey);
                localStorage.removeItem(SESSION_CONFIG.activityKey);
                
                // Update UI
                updateUIForLoggedOutUser();
                
                // Close modal
                const modalInstance = bootstrap.Modal.getInstance(accountModal);
                modalInstance.hide();
                
                // Show success message
                showToast('You have been successfully logged out');
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }
    
    // Login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Clear previous alerts
            hideAlert(loginError);
            hideAlert(loginSuccess);
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password');
            const rememberMe = document.getElementById('remember-me').checked;
            const submitButton = this.querySelector('button[type="submit"]');
            
            // Disable button and show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';
            
            try {
                const response = await fetch('/api/customer/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password: password.value })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Login failed');
                }
                
                // Check if email needs verification
                if (data.needsVerification) {
                    showAlert(loginError, 'Please verify your email address before logging in. <a href="#" id="resend-verification-link">Resend verification email?</a>');
                    
                    // Add event listener to resend verification link
                    document.getElementById('resend-verification-link').addEventListener('click', async function(e) {
                        e.preventDefault();
                        
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
                            
                            showAlert(loginSuccess, 'Verification email sent! Please check your inbox.');
                            hideAlert(loginError);
                        } catch (error) {
                            console.error('Resend verification error:', error);
                            showAlert(loginError, error.message);
                        }
                    });
                    
                    return;
                }
                
                // Store token and user data
                localStorage.setItem(SESSION_CONFIG.tokenKey, data.token);
                localStorage.setItem(SESSION_CONFIG.userKey, JSON.stringify(data.customer));
                localStorage.setItem(SESSION_CONFIG.activityKey, Date.now().toString());
                
                // Update UI for logged in user
                updateUIForLoggedInUser(data.customer);
                
                // Show success message
                showAlert(loginSuccess, 'Login successful!');
                
                // Switch to account tab after a short delay
                setTimeout(() => {
                    accountTab.click();
                }, 1000);
                
            } catch (error) {
                console.error('Login error:', error);
                showAlert(loginError, error.message);
                
                // Add shake animation to the form for better feedback
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
    
    // Signup form submission
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Clear previous alerts
            hideAlert(signupError);
            hideAlert(signupSuccess);
            
            // Validate passwords match
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;
            
            if (password !== confirmPassword) {
                showAlert(signupError, 'Passwords do not match');
                return;
            }
            
            // Get form data
            const firstName = document.getElementById('signup-firstname').value;
            const lastName = document.getElementById('signup-lastname').value;
            const email = document.getElementById('signup-email').value;
            const phone = document.getElementById('signup-phone').value;
            const submitButton = this.querySelector('button[type="submit"]');
            
            // Disable button and show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating Account...';
            
            try {
                const response = await fetch('/api/customer/signup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        firstName,
                        lastName,
                        email,
                        password,
                        phone
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Registration failed');
                }
                
                // Show success message
                showAlert(signupSuccess, data.message || 'Account created successfully! Please check your email to verify your account.');
                
                // If there was an email error but account was created
                if (data.emailError) {
                    // Add a note about the email verification
                    const noteElement = document.createElement('div');
                    noteElement.className = 'alert alert-warning mt-3';
                    noteElement.innerHTML = '<strong>Note:</strong> We couldn\'t send a verification email at this time. You can still log in and request verification later.';
                    signupSuccess.after(noteElement);
                    
                    // Remove the note after some time
                    setTimeout(() => {
                        noteElement.remove();
                    }, 10000);
                }
                
                // Clear form
                signupForm.reset();
                
                // Switch to login tab after a delay
                setTimeout(() => {
                    loginTab.click();
                }, 5000);
                
            } catch (error) {
                console.error('Signup error:', error);
                showAlert(signupError, error.message);
                
                // Add shake animation to the form for better feedback
                signupForm.classList.add('animate__animated', 'animate__shakeX');
                setTimeout(() => {
                    signupForm.classList.remove('animate__animated', 'animate__shakeX');
                }, 1000);
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-user-plus me-2"></i>Create Account';
            }
        });
    }
    
    // Forgot password form submission
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Clear previous alerts
            hideAlert(forgotError);
            hideAlert(forgotSuccess);
            
            const email = document.getElementById('forgot-email').value;
            const submitButton = this.querySelector('button[type="submit"]');
            
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
                
                // Show success message
                showAlert(forgotSuccess, 'Password reset link sent! Please check your email.');
                
                // Clear form
                forgotPasswordForm.reset();
                
                // Switch back to login form after a delay
                setTimeout(() => {
                    forgotPasswordForm.classList.add('d-none');
                    loginForm.classList.remove('d-none');
                }, 3000);
                
            } catch (error) {
                console.error('Forgot password error:', error);
                showAlert(forgotError, error.message);
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Send Reset Link';
            }
        });
    }
    
    // Edit profile form submission
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Clear previous alerts
            hideAlert(profileError);
            hideAlert(profileSuccess);
            
            const firstName = document.getElementById('profile-firstname').value;
            const lastName = document.getElementById('profile-lastname').value;
            const phone = document.getElementById('profile-phone').value;
            const submitButton = this.querySelector('button[type="submit"]');
            
            // Disable button and show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
            
            try {
                const token = localStorage.getItem(SESSION_CONFIG.tokenKey);
                
                if (!token) {
                    throw new Error('You are not logged in');
                }
                
                const response = await fetch('/api/customer/profile', {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        firstName,
                        lastName,
                        phone
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to update profile');
                }
                
                // Update stored user data
                localStorage.setItem(SESSION_CONFIG.userKey, JSON.stringify(data.customer));
                
                // Update UI
                updateUIForLoggedInUser(data.customer);
                
                // Show success message
                showAlert(profileSuccess, 'Profile updated successfully!');
                
                // Go back to account view after a delay
                setTimeout(() => {
                    editProfileForm.classList.add('d-none');
                    document.querySelector('#account-tab-pane > div:not(#edit-profile-form)').classList.remove('d-none');
                }, 2000);
                
            } catch (error) {
                console.error('Edit profile error:', error);
                showAlert(profileError, error.message);
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes';
            }
        });
    }
    
    // Change password form submission
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Clear previous alerts
            hideAlert(passwordError);
            hideAlert(passwordSuccess);
            
            // Validate passwords match
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmNewPassword = document.getElementById('confirm-new-password').value;
            
            if (newPassword !== confirmNewPassword) {
                showAlert(passwordError, 'New passwords do not match');
                return;
            }
            
            const submitButton = this.querySelector('button[type="submit"]');
            
            // Disable button and show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';
            
            try {
                const token = localStorage.getItem(SESSION_CONFIG.tokenKey);
                
                if (!token) {
                    throw new Error('You are not logged in');
                }
                
                const response = await fetch('/api/customer/change-password', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        currentPassword,
                        newPassword
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to change password');
                }
                
                // Show success message
                showAlert(passwordSuccess, 'Password changed successfully! You will be logged out.');
                
                // Clear form
                changePasswordForm.reset();
                
                // Logout after a delay
                setTimeout(() => {
                    // Clear local storage
                    localStorage.removeItem(SESSION_CONFIG.tokenKey);
                    localStorage.removeItem(SESSION_CONFIG.userKey);
                    localStorage.removeItem(SESSION_CONFIG.activityKey);
                    
                    // Update UI
                    updateUIForLoggedOutUser();
                    
                    // Close modal
                    const modalInstance = bootstrap.Modal.getInstance(accountModal);
                    modalInstance.hide();
                    
                    // Show toast
                    showToast('Password changed successfully. Please log in again.');
                }, 2000);
                
            } catch (error) {
                console.error('Change password error:', error);
                showAlert(passwordError, error.message);
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-key me-2"></i>Update Password';
            }
        });
    }
    
    // Check authentication status
    function checkAuthStatus() {
        const token = localStorage.getItem(SESSION_CONFIG.tokenKey);
        
        if (!token) {
            updateUIForLoggedOutUser();
            return;
        }
        
        try {
            // Check token expiration
            const customer = JSON.parse(localStorage.getItem(SESSION_CONFIG.userKey) || '{}');
            
            if (customer.exp && customer.exp < Math.floor(Date.now() / 1000)) {
                // Token expired, clear it
                localStorage.removeItem(SESSION_CONFIG.tokenKey);
                localStorage.removeItem(SESSION_CONFIG.userKey);
                localStorage.removeItem(SESSION_CONFIG.activityKey);
                
                updateUIForLoggedOutUser();
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
                    
                    updateUIForLoggedOutUser();
                    return;
                }
            }
            
            // Valid token and active session
            updateUIForLoggedInUser(customer);
            
            // Update last activity
            localStorage.setItem(SESSION_CONFIG.activityKey, Date.now().toString());
            
        } catch (error) {
            console.error('Error checking authentication status:', error);
            
            // Clear potentially corrupted data
            localStorage.removeItem(SESSION_CONFIG.tokenKey);
            localStorage.removeItem(SESSION_CONFIG.userKey);
            localStorage.removeItem(SESSION_CONFIG.activityKey);
            
            updateUIForLoggedOutUser();
        }
    }
    
    // Update UI for logged in user
    function updateUIForLoggedInUser(customer) {
        if (!customer) return;
        
        // Show account tab
        accountTabItem.classList.remove('d-none');
        
        // Update user info in account tab
        document.getElementById('user-full-name').textContent = `${customer.firstName} ${customer.lastName}`;
        document.getElementById('user-email').textContent = customer.email;
        document.getElementById('user-initials').textContent = getInitials(customer.firstName, customer.lastName);
        
        // Show logged in indicator
        accountStatusIndicator.classList.remove('d-none');
        
        // Update account button tooltip
        accountButton.setAttribute('title', 'My Account');
    }
    
    // Update UI for logged out user
    function updateUIForLoggedOutUser() {
        // Hide account tab
        accountTabItem.classList.add('d-none');
        
        // Show login/signup tabs
        loginTab.click();
        
        // Hide logged in indicator
        accountStatusIndicator.classList.add('d-none');
        
        // Update account button tooltip
        accountButton.setAttribute('title', 'Login / Sign Up');
    }
    
    // Get initials from name
    function getInitials(firstName, lastName) {
        return `${firstName ? firstName.charAt(0).toUpperCase() : ''}${lastName ? lastName.charAt(0).toUpperCase() : ''}`;
    }
    
    // Show alert
    function showAlert(alertElement, message) {
        if (!alertElement) return;
        
        alertElement.innerHTML = message;
        alertElement.classList.remove('d-none');
    }
    
    // Hide alert
    function hideAlert(alertElement) {
        if (!alertElement) return;
        
        alertElement.innerHTML = '';
        alertElement.classList.add('d-none');
    }
    
    // Show toast notification
    function showToast(message) {
        // Check if toast container exists, if not create it
        let toastContainer = document.querySelector('.toast-container');
        
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toastEl = document.createElement('div');
        toastEl.className = 'toast';
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        
        toastEl.innerHTML = `
            <div class="toast-header">
                <strong class="me-auto">N.Honest</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;
        
        // Add toast to container
        toastContainer.appendChild(toastEl);
        
        // Initialize and show toast
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
        
        // Remove toast after it's hidden
        toastEl.addEventListener('hidden.bs.toast', function() {
            toastEl.remove();
        });
    }
    
    // Add CSS for avatar circle
    const style = document.createElement('style');
    style.textContent = `
        .avatar-circle {
            width: 80px;
            height: 80px;
            background-color: #007bff;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .avatar-initials {
            color: white;
            font-size: 32px;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);
    
    // Update activity timestamp on user interaction
    document.addEventListener('click', function() {
        const token = localStorage.getItem(SESSION_CONFIG.tokenKey);
        if (token) {
            localStorage.setItem(SESSION_CONFIG.activityKey, Date.now().toString());
        }
    });
    
    // Listen for account modal open
    accountModal.addEventListener('show.bs.modal', function() {
        checkAuthStatus();
    });
});
