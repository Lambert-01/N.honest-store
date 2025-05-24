/**
 * N.Honest Customer Signup Form Handler
 * Handles customer registration with the API and Google OAuth
 */

// Function to determine the API URL based on environment
function getApiUrl() {
    // Check if we're running on production domain
    const hostname = window.location.hostname;
    console.log('Current hostname:', hostname);
    
    if (hostname === 'nhonestsupermarket.com' || hostname === 'www.nhonestsupermarket.com') {
        // For production, we don't need the domain prefix since we're on the same domain
        // This avoids CORS issues
        return '';
    }
    // Default to local development
    return '';
}

// Function to handle Google Sign-Up callback
function handleGoogleSignUp(response) {
    console.log('Google Sign-Up response received:', response);
    // Get the ID token from the response
    const credential = response.credential;
    
    // Determine the API URL based on environment
    const apiUrl = getApiUrl();
    console.log('Using API URL for Google auth:', apiUrl);
    
    // Send the token to your backend for verification and account creation
    fetch(`${apiUrl}/api/customer/google/signup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ credential })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Google signup failed');
            });
        }
        return response.json();
    })
    .then(data => {
        // Create enhanced success alert
        const errorAlert = document.getElementById('error-alert');
        const successAlert = document.createElement('div');
        successAlert.className = 'alert alert-success';
        successAlert.innerHTML = `<strong>Success!</strong> ${data.message} <br>
            Your account has been created with the following details:<br>
            Name: ${data.customer.firstName} ${data.customer.lastName}<br>
            Email: ${data.customer.email}<br>
            A welcome email has been sent to your address.`;
        
        // Replace error alert with success alert
        if (errorAlert) {
            errorAlert.replaceWith(successAlert);
        } else {
            document.querySelector('.signup-container').prepend(successAlert);
        }
        
        // Store success message for login page
        sessionStorage.setItem('customerLoginMessage', 'success:' + data.message);
        
        // Redirect to login page after a delay
        setTimeout(() => {
            window.location.href = '/client-login.html';
        }, 3000);
    })
    .catch(error => {
        console.error('Google signup error:', error);
        
        // Show error message
        const errorAlert = document.getElementById('error-alert');
        if (errorAlert) {
            errorAlert.textContent = error.message;
            errorAlert.style.display = 'block';
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signup-form');
    const errorAlert = document.getElementById('error-alert');
    
    // Hide error alert initially
    if (errorAlert) errorAlert.style.display = 'none';
    
    // Helper function to show error message
    function showErrorMessage(message) {
        if (errorAlert) {
            errorAlert.textContent = message;
            errorAlert.style.display = 'block';
        }
    }
    
    // Password validation
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    // Add password strength indicator
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            validatePassword();
        });
    }
    
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            validatePasswordMatch();
        });
    }
    
    function validatePassword() {
        const password = passwordInput.value;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasMinLength = password.length >= 8;
        
        // Update validity state
        passwordInput.setCustomValidity(
            hasUpperCase && hasLowerCase && hasNumbers && hasMinLength ? '' : 
            'Password must be at least 8 characters with uppercase, lowercase, and numbers'
        );
    }
    
    function validatePasswordMatch() {
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Update validity state
        confirmPasswordInput.setCustomValidity(
            password === confirmPassword ? '' : 'Passwords do not match'
        );
    }
    
    // Handle signup form submission
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Validate passwords match
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
                showErrorMessage('Passwords do not match');
                return;
            }
            
            // Get form data
            const firstName = document.getElementById('firstName').value;
            const lastName = document.getElementById('lastName').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const submitButton = e.target.querySelector('button[type="submit"]');
            
            // Clear previous errors
            errorAlert.style.display = 'none';
            
            // Disable button and show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating Account...';
            
            try {
                // Get the API URL based on environment
                const apiUrl = getApiUrl();
                console.log('Using API URL for signup:', apiUrl);
                
                const response = await fetch(`${apiUrl}/api/customer/signup`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        firstName,
                        lastName,
                        email,
                        phone,
                        password
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Registration failed');
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
                
                // Store success message for login page
                sessionStorage.setItem('customerLoginMessage', 'success:' + data.message);
                
                // Create enhanced success alert
                const successAlert = document.createElement('div');
                successAlert.className = 'alert alert-success';
                successAlert.innerHTML = `<strong>Success!</strong> ${data.message} <br>
                    Your account has been created with the following details:<br>
                    Name: ${firstName} ${lastName}<br>
                    Email: ${email}<br>
                    A welcome email has been sent to your address.`;
                
                // Replace error alert with success alert
                if (errorAlert) {
                    errorAlert.replaceWith(successAlert);
                } else {
                    signupForm.prepend(successAlert);
                }
                
                // Log success message to console for confirmation
                console.log('✅ Signup successful! Customer details saved to MongoDB:');
                console.log(`Name: ${firstName} ${lastName}`);
                console.log(`Email: ${email}`);
                console.log(`Phone: ${phone}`);
                console.log('Customer ID:', data.customer?._id || 'Not available');
                
                // Disable form fields
                const formInputs = signupForm.querySelectorAll('input, button[type="submit"]');
                formInputs.forEach(input => {
                    input.disabled = true;
                });
                
                // Redirect to login page after a delay
                setTimeout(() => {
                    window.location.href = '/client-login.html';
                }, 3000);
                
            } catch (error) {
                console.error('Signup error:', error);
                showErrorMessage(error.message);
                
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
});
