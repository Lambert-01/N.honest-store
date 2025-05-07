/**
 * N.Honest Sign Up Form Handler
 * Handles user registration with the API
 */

document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signup-form');
    const passwordInput = document.getElementById('password');
    const passwordMeter = document.getElementById('password-meter');
    
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
                if (strength <= 1) {
                    passwordMeter.classList.add('weak');
                } else if (strength === 2) {
                    passwordMeter.classList.add('medium');
                } else {
                    passwordMeter.classList.add('strong');
                }
            }
        });
    }
    
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const errorAlert = document.getElementById('error-alert');
            const submitButton = e.target.querySelector('button[type="submit"]');
            
            // Basic validation
            if (!username || !email || !password || !confirmPassword) {
                errorAlert.textContent = 'All fields are required';
                errorAlert.style.display = 'block';
                return;
            }
            
            if (password !== confirmPassword) {
                errorAlert.textContent = 'Passwords do not match';
                errorAlert.style.display = 'block';
                return;
            }
            
            if (password.length < 6) {
                errorAlert.textContent = 'Password must be at least 6 characters';
                errorAlert.style.display = 'block';
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
                    body: JSON.stringify({ username, email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Sign up failed');
                }

                // Store token and user data in localStorage
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // Redirect to admin panel
                window.location.href = '/admin';
            } catch (error) {
                console.error('Signup error:', error);
                errorAlert.textContent = error.message;
                errorAlert.style.display = 'block';
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-user-plus me-2"></i>Sign Up';
            }
        });
    }

    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        // If already logged in, redirect to admin panel
        window.location.href = '/admin';
    }
}); 