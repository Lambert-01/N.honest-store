/**
 * N.Honest Login Form Handler
 * Handles authentication with the API
 */

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorAlert = document.getElementById('error-alert');
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
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // Set session as active
                localStorage.setItem('sessionActive', 'true');
                
                // Set last activity timestamp
                localStorage.setItem('lastActivity', Date.now().toString());

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

    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        try {
            // Check token expiration if we have it
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.exp && user.exp < Math.floor(Date.now() / 1000)) {
                // Token expired, clear it
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('sessionActive');
                
                // Show expired message if on login page
                const errorAlert = document.getElementById('error-alert');
                if (errorAlert) {
                    errorAlert.textContent = 'Your session has expired. Please login again.';
                    errorAlert.style.display = 'block';
                }
                return;
            }
            
            // Don't check sessionActive flag anymore, just redirect if token exists
            console.log('Valid token found, redirecting to admin panel');
            window.location.href = '/admin.html';
        } catch (error) {
            console.error('Error checking login status:', error);
            // Clear potentially corrupted data
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('sessionActive');
        }
    }
}); 