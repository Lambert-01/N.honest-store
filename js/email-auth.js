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
        try {
            const emailParams = {
                to_name: `${firstName} ${lastName}`,
                to_email: email,
                subject: 'Welcome to N.Honest Supermarket!',
                shop_name: 'N.Honest Supermarket'
            };

            return window.emailConfig.sendEmail(emailParams, 'welcome')
                .catch(error => {
                    console.error('Failed to send welcome email:', error);
                    return null;
                });
        } catch (error) {
            console.error('Error in sendWelcomeEmail:', error);
            return null;
        }
    }
    
    /**
     * Send a login notification email using EmailJS
     * @param {string} email - The recipient's email address
     */
    function sendLoginNotification(email) {
        try {
            const emailParams = {
                to_email: email,
                to_name: email.split('@')[0],
                subject: 'N.Honest Supermarket - Login Notification',
                login_time: new Date().toLocaleString(),
                shop_name: 'N.Honest Supermarket'
            };

            return window.emailConfig.sendEmail(emailParams, 'login')
                .catch(error => {
                    console.error('Failed to send login notification:', error);
                    // Don't block login process if email fails
                    return null;
                });
        } catch (error) {
            console.error('Error in sendLoginNotification:', error);
            return null;
        }
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
