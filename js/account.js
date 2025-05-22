/**
 * N.Honest Account Management
 * Handles customer authentication and account management with EmailJS integration
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize EmailJS if available
    if (typeof emailjs !== 'undefined') {
        // EmailJS is already initialized in the HTML with:
        // emailjs.init("WOcO2ZGCFwjylrI2f");
        console.log('EmailJS is ready for use');
    } else {
        console.warn('EmailJS not found. Make sure the EmailJS script is loaded.');
    }
    
    // Setup event listeners for login/signup forms
    setupFormListeners();
    
    // Check if user is logged in and update UI
    checkLoginStatus();

    // DOM Elements
    const accountButton = document.getElementById('accountButton');
    const accountStatusIndicator = document.querySelector('.account-status-indicator');
    const accountModal = document.getElementById('accountModal');
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const accountTab = document.getElementById('account-tab');
    const loginTabContent = document.getElementById('login-tab-content');
    const signupTabContent = document.getElementById('signup-tab-content');
    const accountTabContent = document.getElementById('account-tab-content');
    const logoutButton = document.getElementById('logout-button');
    const accountUsername = document.getElementById('user-full-name');
    const accountEmail = document.getElementById('user-email');
    
    // Show spinner during async operations
    function showSpinner() {
        document.querySelector('.spinner-overlay').style.display = 'flex';
    }
    
    // Hide spinner after async operations
    function hideSpinner() {
        document.querySelector('.spinner-overlay').style.display = 'none';
    }
    
    // Show error alert
    function showErrorAlert(message) {
        // Try multiple possible error alert elements
        const alertElement = document.getElementById('account-error-alert') || 
                            document.getElementById('signup-error') || 
                            document.getElementById('login-error');
        
        if (!alertElement) {
            // Fallback to console if no alert element found
            console.error('Error:', message);
            return;
        }
        
        alertElement.textContent = message;
        alertElement.classList.remove('d-none');
        alertElement.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            alertElement.classList.add('d-none');
            alertElement.style.display = 'none';
        }, 5000);
    }
    
    // Show success alert
    function showSuccessAlert(message) {
        // Try multiple possible success alert elements
        const alertElement = document.getElementById('account-success-alert') || 
                            document.getElementById('signup-success') || 
                            document.getElementById('login-success');
        
        if (!alertElement) {
            // Fallback to console if no alert element found
            console.log('Success:', message);
            return;
        }
        
        alertElement.textContent = message;
        alertElement.classList.remove('d-none');
        alertElement.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            alertElement.classList.add('d-none');
            alertElement.style.display = 'none';
        }, 5000);
    }
    
    /**
     * Setup event listeners for login and signup forms
     */
    function setupFormListeners() {
        // Login form listener
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
        
        // Signup form listener
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', handleSignup);
        }
    }
    
    /**
     * Check if user is logged in and update UI accordingly
     */
    function checkLoginStatus() {
        const token = localStorage.getItem('customerToken');
        const customerData = localStorage.getItem('customerData');
        
        if (token && customerData) {
            try {
                const customer = JSON.parse(customerData);
                updateAccountUI(customer);
                showAccountTab();
            } catch (error) {
                console.error('Error parsing customer data:', error);
                // Clear invalid data
                localStorage.removeItem('customerToken');
                localStorage.removeItem('customerData');
            }
        }
    }
    
    // Handle login form submission
    async function handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitButton = document.querySelector('#login-form button[type="submit"]');
        
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
                // Check if this is a verification required error
                if (data.needsVerification) {
                    // Show verification reminder
                    const verificationReminder = document.getElementById('login-verification-reminder');
                    if (verificationReminder) {
                        // Store the email for resend functionality
                        const emailField = document.getElementById('verification-email');
                        if (emailField) {
                            emailField.value = email;
                        }
                        
                        // Show the reminder
                        verificationReminder.classList.remove('d-none');
                        
                        // Setup resend button
                        const resendButton = document.getElementById('login-resend-verification-btn');
                        if (resendButton) {
                            resendButton.addEventListener('click', async function() {
                                await resendVerificationEmail(email, resendButton);
                            });
                        }
                    }
                    
                    throw new Error('Your email address needs to be verified before you can log in. Please check your inbox for a verification link.');
                } else {
                    throw new Error(data.error || 'Login failed');
                }
            }
            
            // Store token and user data
            localStorage.setItem('customerToken', data.token);
            localStorage.setItem('customerData', JSON.stringify(data.customer));
            
            // Send login notification email using EmailJS
            try {
                const emailParams = {
                    to_name: data.customer.firstName + ' ' + data.customer.lastName,
                    to_email: data.customer.email,
                    subject: 'N.Honest Login Notification',
                    message: 'You have successfully logged in to your N.honest Supermarket account. If this was not you, please contact us immediately.'
                };
                
                // Send the email using EmailJS configuration utility
                window.emailConfig.sendEmail(emailParams)
                    .then(function(response) {
                        console.log('Login notification email sent successfully:', response);
                    })
                    .catch(function(error) {
                        console.error('Login notification email sending failed:', error);
                    });
            } catch (emailError) {
                console.error('Error sending login notification email:', emailError);
            }
            
            // Update UI
            updateAccountUI(data.customer);
            showAccountTab();
            showSuccessAlert('Login successful!');
            
        } catch (error) {
            console.error('Login error:', error);
            showErrorAlert(error.message);
        } finally {
            // Reset button state
            submitButton.disabled = false;
            submitButton.innerHTML = 'Login';
        }
    }
    
    // Handle signup form submission
    async function handleSignup(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('signup-firstName')?.value || '';
        const lastName = document.getElementById('signup-lastName')?.value || '';
        const email = document.getElementById('signup-email')?.value || '';
        const password = document.getElementById('signup-password')?.value || '';
        const confirmPassword = document.getElementById('signup-confirm-password')?.value || '';
        const phone = document.getElementById('signup-phone')?.value || '';
        const submitButton = document.querySelector('#signup-form button[type="submit"]');
        
        // Validate passwords match
        if (password !== confirmPassword) {
            showErrorAlert('Passwords do not match');
            return;
        }
        
        // Disable button and show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating Account...';
        
        try {
            // Validate required fields
            if (!firstName || !lastName || !email || !password) {
                showErrorAlert('Please fill in all required fields');
                return;
            }

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
                // Handle specific error cases
                if (data.error && data.error.includes('Email is already in use')) {
                    showErrorAlert('This email address is already registered. Please use a different email or try logging in.');
                } else {
                    showErrorAlert(data.error || 'Registration failed');
                }
                // Reset button state
                submitButton.disabled = false;
                submitButton.innerHTML = 'Create Account';
                return;
            }
            
            // Send welcome email using EmailJS if needed
            if (data.useClientEmail) {
                try {
                    // Use email parameters from server if available, or create default ones
                    const emailParams = data.emailParams || {
                        to_name: firstName + ' ' + lastName,
                        to_email: email,
                        subject: 'Welcome to N.honest Supermarket!',
                        message: 'Thank you for creating an account with N.honest Supermarket. Your account has been successfully created and you can now log in to start shopping!'
                    };
                    
                    // Send the email using EmailJS configuration utility
                    window.emailConfig.sendEmail(emailParams)
                        .then(function(response) {
                            console.log('Email sent successfully:', response);
                        })
                        .catch(function(error) {
                            console.error('Email sending failed:', error);
                        });
                } catch (emailError) {
                    console.error('Error sending welcome email:', emailError);
                }
            }
            
            // Show success message
            showSuccessAlert(data.message || 'Account created successfully!');
            
            // Show verification reminder
            const verificationReminder = document.getElementById('verification-reminder');
            if (verificationReminder) {
                verificationReminder.classList.remove('d-none');
                
                // Extract email domain to customize the message
                const emailDomain = email.split('@')[1];
                const isGmail = emailDomain && emailDomain.toLowerCase().includes('gmail');
                
                // Update the Gmail button if it's a Gmail account
                const gmailButton = verificationReminder.querySelector('a[href="https://mail.google.com/mail/"]');
                if (gmailButton) {
                    if (isGmail) {
                        gmailButton.innerHTML = '<i class="fab fa-google me-1"></i> Open Gmail';
                        gmailButton.href = 'https://mail.google.com/mail/';
                    } else if (emailDomain) {
                        // Try to provide a link to common email providers
                        if (emailDomain.includes('yahoo')) {
                            gmailButton.innerHTML = '<i class="fab fa-yahoo me-1"></i> Open Yahoo Mail';
                            gmailButton.href = 'https://mail.yahoo.com/';
                        } else if (emailDomain.includes('outlook') || emailDomain.includes('hotmail') || emailDomain.includes('live')) {
                            gmailButton.innerHTML = '<i class="fab fa-microsoft me-1"></i> Open Outlook';
                            gmailButton.href = 'https://outlook.live.com/mail/';
                        } else {
                            gmailButton.innerHTML = '<i class="fas fa-envelope me-1"></i> Check Email';
                            gmailButton.href = `https://${emailDomain}`;
                        }
                    }
                }
                
                // Setup resend verification button
                const resendButton = document.getElementById('resend-verification-btn');
                if (resendButton) {
                    resendButton.addEventListener('click', async function() {
                        try {
                            resendButton.disabled = true;
                            resendButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';
                            
                            const response = await fetch('/api/customer/resend-verification', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ email })
                            });
                            
                            const data = await response.json();
                            
                            if (response.ok) {
                                showSuccessAlert('Verification email has been resent. Please check your inbox.');
                            } else {
                                showErrorAlert(data.error || 'Failed to resend verification email');
                            }
                        } catch (error) {
                            console.error('Error resending verification email:', error);
                            showErrorAlert('Failed to resend verification email. Please try again later.');
                        } finally {
                            resendButton.disabled = false;
                            resendButton.innerHTML = '<i class="fas fa-paper-plane me-1"></i> Resend Email';
                        }
                    });
                }
            }
            
            // Don't automatically switch to login tab so user can see the verification reminder
            // loginTab.click();
            
        } catch (error) {
            console.error('Signup error:', error);
            showErrorAlert(error.message);
        } finally {
            // Reset button state
            submitButton.disabled = false;
            submitButton.innerHTML = 'Create Account';
        }
    }
    
    // Update UI based on authentication status
    function updateAccountUI(customer) {
        if (customer) {
            // User is logged in
            accountStatusIndicator.classList.add('logged-in');
            accountStatusIndicator.classList.remove('logged-out');
            
            // Update account tab content
            if (accountUsername) {
                accountUsername.textContent = `${customer.firstName} ${customer.lastName}`;
            }
            
            if (accountEmail) {
                accountEmail.textContent = customer.email;
            }
            
            // Update profile image if available
            const profileImage = document.getElementById('user-profile-image');
            if (profileImage && customer.picture) {
                profileImage.src = customer.picture;
                profileImage.alt = `${customer.firstName} ${customer.lastName}`;
                console.log('Updated profile image:', customer.picture);
            } else if (profileImage) {
                // Generate a profile image URL based on the user's name if picture is not available
                const name = encodeURIComponent(`${customer.firstName}+${customer.lastName}`);
                profileImage.src = `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&size=200`;
                profileImage.alt = `${customer.firstName} ${customer.lastName}`;
            }
            
            // Update user initials if that element exists
            const userInitials = document.getElementById('user-initials');
            if (userInitials) {
                userInitials.textContent = `${customer.firstName.charAt(0)}${customer.lastName.charAt(0)}`;
            }
        } else {
            // User is logged out
            accountStatusIndicator.classList.add('logged-out');
            accountStatusIndicator.classList.remove('logged-in');
            
            // Reset profile image to default
            const profileImage = document.getElementById('user-profile-image');
            if (profileImage) {
                profileImage.src = 'https://ui-avatars.com/api/?name=N+Honest&background=random&color=fff&size=200';
                profileImage.alt = 'Profile Image';
            }
        }
    }
    
    // Show account tab
    function showAccountTab() {
        if (accountTab && accountTabContent) {
            // Hide login and signup tabs
            loginTab.classList.remove('active');
            signupTab.classList.remove('active');
            accountTab.classList.add('active');
            
            // Hide login and signup content
            loginTabContent.classList.remove('show', 'active');
            signupTabContent.classList.remove('show', 'active');
            accountTabContent.classList.add('show', 'active');
        }
    }
    
    // Show login tab
    function showLoginTab() {
        if (loginTab && loginTabContent) {
            // Hide signup and account tabs
            signupTab.classList.remove('active');
            accountTab.classList.remove('active');
            loginTab.classList.add('active');
            
            // Hide signup and account content
            signupTabContent.classList.remove('show', 'active');
            accountTabContent.classList.remove('show', 'active');
            loginTabContent.classList.add('show', 'active');
        }
    }
    
    // Handle logout
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
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
                    });
                }
                
                // Clear local storage
                localStorage.removeItem('customerToken');
                localStorage.removeItem('customerData');
                
                // Update UI
                updateAccountUI(null);
                showLoginTab();
                showSuccessAlert('Logged out successfully');
                
                // Close the modal if it's open
                const accountModal = document.getElementById('accountModal');
                if (accountModal) {
                    const bsModal = bootstrap.Modal.getInstance(accountModal);
                    if (bsModal) {
                        bsModal.hide();
                    }
                }
                
                console.log('User logged out successfully');
                
            } catch (error) {
                console.error('Logout error:', error);
                
                // Even if API call fails, clear local storage and update UI
                localStorage.removeItem('customerToken');
                localStorage.removeItem('customerData');
                updateAccountUI(null);
                showLoginTab();
            }
        });
    }
    
    /**
     * Resend verification email to the specified email address
     * @param {string} email - The email address to send verification to
     * @param {HTMLElement} button - The button element that triggered the resend
     * @returns {Promise} - Promise that resolves when the email is sent
     */
    async function resendVerificationEmail(email, button) {
        if (!email) {
            showErrorAlert('Email address is required');
            return;
        }
        
        try {
            // Update button state
            const originalButtonText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';
            
            // Send the request to resend verification email
            const response = await fetch('/api/customer/resend-verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showSuccessAlert('Verification email has been resent. Please check your inbox.');
                
                // Extract email domain to provide a direct link
                const emailDomain = email.split('@')[1];
                if (emailDomain) {
                    let mailLink = '';
                    
                    // Provide links to common email providers
                    if (emailDomain.toLowerCase().includes('gmail')) {
                        mailLink = 'https://mail.google.com/mail/';
                    } else if (emailDomain.includes('yahoo')) {
                        mailLink = 'https://mail.yahoo.com/';
                    } else if (emailDomain.includes('outlook') || emailDomain.includes('hotmail') || emailDomain.includes('live')) {
                        mailLink = 'https://outlook.live.com/mail/';
                    } else {
                        mailLink = `https://${emailDomain}`;
                    }
                    
                    // Add a direct link to check email
                    const successAlert = document.getElementById('login-success') || document.getElementById('signup-success');
                    if (successAlert && !successAlert.querySelector('.email-link')) {
                        const linkElement = document.createElement('div');
                        linkElement.className = 'mt-2 email-link';
                        linkElement.innerHTML = `<a href="${mailLink}" target="_blank" class="btn btn-sm btn-primary"><i class="fas fa-envelope me-1"></i> Check Your Email</a>`;
                        successAlert.appendChild(linkElement);
                    }
                }
            } else {
                showErrorAlert(data.error || 'Failed to resend verification email');
            }
        } catch (error) {
            console.error('Error resending verification email:', error);
            showErrorAlert('Failed to resend verification email. Please try again later.');
        } finally {
            // Reset button state
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-paper-plane me-1"></i> Resend Verification Email';
            }
        }
    }
    
    // Check authentication status
    function checkAuthStatus() {
        const token = localStorage.getItem('customerToken');
        const customerData = localStorage.getItem('customerData');
        
        if (token && customerData) {
            try {
                const customer = JSON.parse(customerData);
                
                // Check if token is expired
                const now = Math.floor(Date.now() / 1000);
                if (customer.exp && customer.exp < now) {
                    // Token expired, clear data
                    localStorage.removeItem('customerToken');
                    localStorage.removeItem('customerData');
                    updateAccountUI(null);
                    showLoginTab();
                    return;
                }
                
                updateAccountUI(customer);
                showAccountTab();
            } catch (error) {
                console.error('Error parsing customer data:', error);
                localStorage.removeItem('customerToken');
                localStorage.removeItem('customerData');
                updateAccountUI(null);
                showLoginTab();
            }
        } else {
            updateAccountUI(null);
            showLoginTab();
        }
    }
    
    // Initialize account UI
    if (accountButton) {
        accountButton.addEventListener('click', function() {
            checkAuthStatus();
        });
    }
    
    // Initialize modal events
    if (accountModal) {
        accountModal.addEventListener('show.bs.modal', function() {
            checkAuthStatus();
        });
    }
});
