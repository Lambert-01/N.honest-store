/**
 * N.Honest Password Reset Handler
 * Handles password reset with the API
 */

document.addEventListener('DOMContentLoaded', function() {
    const resetForm = document.getElementById('reset-password-form');
    const errorAlert = document.getElementById('error-alert');
    const successAlert = document.getElementById('success-alert');
    
    // Hide alerts initially
    if (errorAlert) errorAlert.style.display = 'none';
    if (successAlert) successAlert.style.display = 'none';
    
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    // If no token is present, show error and disable form
    if (!token) {
        showErrorMessage('Invalid or missing reset token. Please request a new password reset link.');
        if (resetForm) {
            const formInputs = resetForm.querySelectorAll('input, button[type="submit"]');
            formInputs.forEach(input => {
                input.disabled = true;
            });
        }
    }
    
    // Helper functions to show messages
    function showErrorMessage(message) {
        if (errorAlert) {
            errorAlert.textContent = message;
            errorAlert.style.display = 'block';
            successAlert.style.display = 'none';
        }
    }
    
    function showSuccessMessage(message) {
        if (successAlert) {
            successAlert.textContent = message;
            successAlert.style.display = 'block';
            errorAlert.style.display = 'none';
        }
    }
    
    // Password validation
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
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
    
    // Handle form submission
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Validate passwords match
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
                showErrorMessage('Passwords do not match');
                return;
            }
            
            const submitButton = e.target.querySelector('button[type="submit"]');
            
            // Clear previous alerts
            errorAlert.style.display = 'none';
            successAlert.style.display = 'none';
            
            // Disable button and show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Resetting Password...';
            
            try {
                const response = await fetch('/api/customer/reset-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ token, password })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Password reset failed');
                }
                
                // Show success message
                showSuccessMessage(data.message || 'Password has been reset successfully!');
                
                // Disable form fields
                const formInputs = resetForm.querySelectorAll('input, button[type="submit"]');
                formInputs.forEach(input => {
                    input.disabled = true;
                });
                
                // Store success message for login page
                sessionStorage.setItem('customerLoginMessage', 'success:Your password has been reset successfully. Please login with your new password.');
                
                // Redirect to login page after a delay
                setTimeout(() => {
                    window.location.href = '/client-login?reset=true';
                }, 3000);
                
            } catch (error) {
                console.error('Password reset error:', error);
                showErrorMessage(error.message);
                
                // Add shake animation to the form for better feedback
                resetForm.classList.add('animate__animated', 'animate__shakeX');
                setTimeout(() => {
                    resetForm.classList.remove('animate__animated', 'animate__shakeX');
                }, 1000);
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-key me-2"></i>Reset Password';
            }
        });
    }
});
