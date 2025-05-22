/**
 * EmailJS Configuration
 * Loads EmailJS credentials from environment variables or defaults
 * Supports different templates for different email types
 */

// EmailJS configuration
const emailConfig = {
    // Default values (fallback if environment variables are not available)
    serviceId: 'service_3hekbvk',
    templateIds: {
        welcome: 'template_zpxvfqs',      // Welcome email template
        login: 'template_zpxvfqs',        // Login notification template
        order: 'template_zpxvfqs',        // Order confirmation template
        reset: 'template_zpxvfqs'         // Password reset template
    },
    publicKey: 'WOcO2ZGCFwjylrI2f',
    
    // Initialize EmailJS with the public key
    init: function() {
        if (typeof emailjs !== 'undefined') {
            // Try to get values from meta tags (which can be populated from server-side env variables)
            this.serviceId = document.querySelector('meta[name="emailjs-service-id"]')?.getAttribute('content') || this.serviceId;
            const templateId = document.querySelector('meta[name="emailjs-template-id"]')?.getAttribute('content');
            if (templateId) {
                // If a single template ID is provided, use it for all template types
                Object.keys(this.templateIds).forEach(key => {
                    this.templateIds[key] = templateId;
                });
            }
            this.publicKey = document.querySelector('meta[name="emailjs-public-key"]')?.getAttribute('content') || this.publicKey;
            
            // Initialize EmailJS
            emailjs.init(this.publicKey);
            console.log('EmailJS initialized with service ID:', this.serviceId);
        } else {
            console.error('EmailJS library not found. Make sure to include the EmailJS script in your HTML.');
        }
    },
    
    /**
     * Send an email using EmailJS
     * @param {Object} params - Email parameters
     * @param {string} type - Email type (welcome, login, order, reset)
     * @returns {Promise} - EmailJS send promise
     */
    sendEmail: function(params, type = 'welcome') {
        if (typeof emailjs === 'undefined') {
            console.error('EmailJS library not found.');
            return Promise.reject(new Error('EmailJS library not found'));
        }
        
        // Get the appropriate template ID based on the email type
        const templateId = this.templateIds[type] || this.templateIds.welcome;
        
        // Add timestamp to email parameters
        params.timestamp = new Date().toLocaleString();
        
        // Add shop info if not provided
        if (!params.shop_name) params.shop_name = 'N.Honest Supermarket';
        if (!params.shop_logo) params.shop_logo = window.location.origin + '/images/f.logo.png';
        
        console.log(`Sending ${type} email using template: ${templateId}`);
        return emailjs.send(this.serviceId, templateId, params);
    }
};

// Export the config
window.emailConfig = emailConfig;

// Initialize when the script loads
document.addEventListener('DOMContentLoaded', function() {
    emailConfig.init();
});
