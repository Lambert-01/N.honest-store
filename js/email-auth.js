/**
 * Email Authentication with EmailJS
 * Handles email-based authentication and notifications
 */

document.addEventListener('DOMContentLoaded', function() {
    // Get the email sign-in button
    const emailSignInBtn = document.getElementById('email-signin-btn');
    
    // Add click event listener to the email sign-in button
    if (emailSignInBtn) {
        emailSignInBtn.addEventListener('click', function() {
            // Get the email from the login form
            const emailInput = document.getElementById('login-email');
            if (!emailInput || !emailInput.value) {
                showAlert('Please enter your email address first.', 'danger');
                return;
            }
            
            const email = emailInput.value;
            
            // Send a notification email using EmailJS
            sendLoginNotification(email);
        });
    }
    
    // Handle signup form submission to send welcome email
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            // We don't prevent default here because we want the normal form submission to happen
            // This is just to capture the data for the email
            const firstName = document.getElementById('signup-firstName')?.value || '';
            const lastName = document.getElementById('signup-lastName')?.value || '';
            const email = document.getElementById('signup-email')?.value || '';
            
            // Store the signup data in session storage to use after successful signup
            if (email) {
                sessionStorage.setItem('pendingSignupEmail', JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    timestamp: new Date().toISOString()
                }));
                console.log('Stored signup data for email notification');
            }
        });
    }
    
    // Check for successful signup and send welcome email
    const signupSuccess = document.getElementById('signup-success');
    if (signupSuccess && signupSuccess.style.display !== 'none') {
        const pendingSignupData = sessionStorage.getItem('pendingSignupEmail');
        if (pendingSignupData) {
            try {
                const signupData = JSON.parse(pendingSignupData);
                // Only send if the signup was recent (within the last minute)
                const signupTime = new Date(signupData.timestamp);
                const now = new Date();
                if ((now - signupTime) < 60000) { // 1 minute in milliseconds
                    sendWelcomeEmail(signupData.firstName, signupData.lastName, signupData.email);
                    // Clear the pending signup data
                    sessionStorage.removeItem('pendingSignupEmail');
                }
            } catch (error) {
                console.error('Error processing pending signup data:', error);
            }
        }
    }
    
    /**
     * Send a welcome email to a new customer using EmailJS
     * @param {string} firstName - Customer's first name
     * @param {string} lastName - Customer's last name
     * @param {string} email - Customer's email address
     */
    function sendWelcomeEmail(firstName, lastName, email) {
        console.log('Sending welcome email to:', email);
        
        // Prepare email parameters for the welcome template
        const emailParams = {
            to_name: firstName + ' ' + lastName,
            to_email: email,
            subject: 'Welcome to N.Honest Supermarket!',
            message: 'Thank you for creating an account with N.honest Supermarket. Your account has been successfully created and you can now log in to start shopping!',
            user_name: firstName,
            shop_name: 'N.Honest Supermarket',
            shop_address: 'Kigali, Rwanda',
            shop_phone: '+250 788 123 456',
            shop_email: 'info@nhonest.com'
        };
        
        // Send the email using EmailJS with welcome template
        window.emailConfig.sendEmail(emailParams, 'welcome')
            .then(function(response) {
                console.log('Welcome email sent successfully:', response);
            })
            .catch(function(error) {
                console.error('Welcome email sending failed:', error);
            });
    }
    
    /**
     * Send a login notification email using EmailJS
     * @param {string} email - The recipient's email address
     */
    function sendLoginNotification(email) {
        // Show loading state
        const originalBtnText = emailSignInBtn.innerHTML;
        emailSignInBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';
        emailSignInBtn.disabled = true;
        
        // Prepare email parameters for the login notification template
        const emailParams = {
            to_email: email,
            to_name: email.split('@')[0], // Use part of email as name if actual name is not available
            subject: 'N.Honest Supermarket - Sign In Notification',
            message: 'You are receiving this email because you attempted to sign in to your N.honest Supermarket account. If this was not you, please contact us immediately.',
            login_time: new Date().toLocaleString(),
            login_ip: 'Not available for privacy reasons',
            shop_name: 'N.Honest Supermarket',
            shop_logo: 'https://nhonest.com/images/f.logo.png'
        };
        
        // Send the email using EmailJS with login template
        window.emailConfig.sendEmail(emailParams, 'login')
            .then(function(response) {
                console.log('Login notification email sent successfully:', response);
                showAlert('Login notification sent to your email!', 'success');
                
                // After successful email, try to proceed with normal login
                const loginForm = document.getElementById('login-form');
                if (loginForm) {
                    loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            })
            .catch(function(error) {
                console.error('Login notification email sending failed:', error);
                showAlert('Failed to send login notification. Please try again.', 'danger');
            })
            .finally(function() {
                // Reset button state
                emailSignInBtn.innerHTML = originalBtnText;
                emailSignInBtn.disabled = false;
            });
    }
    
    /**
     * Show an alert message
     * @param {string} message - The message to display
     * @param {string} type - The type of alert (success, danger, warning, info)
     */
    function showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('login-alerts');
        if (!alertContainer) return;
        
        const alertElement = document.createElement('div');
        alertElement.className = `alert alert-${type} alert-dismissible fade show`;
        alertElement.role = 'alert';
        alertElement.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        alertContainer.innerHTML = '';
        alertContainer.appendChild(alertElement);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            alertElement.classList.remove('show');
            setTimeout(() => alertElement.remove(), 300);
        }, 5000);
    }
});
