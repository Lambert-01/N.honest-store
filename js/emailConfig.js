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
        order: 'template_ahcpezh',        // Specific template for orders/invoices
        invoice: 'template_ahcpezh',
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
    },

    // Updated email sending function with invoice support
    sendOrderConfirmation: async function(orderData) {
        if (typeof emailjs === 'undefined') {
            console.error('EmailJS library not found.');
            return Promise.reject(new Error('EmailJS not initialized'));
        }

        const params = {
            to_email: orderData.customer.email,
            to_name: orderData.customer.firstName + ' ' + orderData.customer.lastName,
            order_number: orderData.orderNumber,
            order_date: new Date().toLocaleString(),
            total_amount: orderData.total.toFixed(2),
            items_list: orderData.items.map(item => 
                `${item.name} x${item.quantity} - RWF ${item.price}`
            ).join('\n'),
            shop_name: 'N.Honest Supermarket',
            invoice_url: `${window.location.origin}/orders/${orderData.orderNumber}`
        };

        // Send to customer
        await emailjs.send(
            this.serviceId,
            this.templateIds.invoice,
            params
        );

        // Send copy to business email
        const businessParams = {
            ...params,
            to_email: 'info@nhonnestsupermarket.com',
            to_name: 'N.Honest Supermarket',
            is_business_copy: true
        };

        await emailjs.send(
            this.serviceId,
            this.templateIds.invoice,
            businessParams
        );

        return { success: true };
    }
};

// Initialize EmailJS
(function() {
    emailjs.init({
        publicKey: "WOcO2ZGCFwjylrI2f"
    });
})();

const EMAIL_CONFIG = {
    serviceID: "service_3hekbvk",
    templates: {
        verification: "template_zpxvfqs",
        invoice: "template_ahcpezh"
    },
    baseURL: window.location.origin
};

// Send verification email
const sendVerificationEmail = async (userData) => {
    try {
        const templateParams = {
            to_email: userData.email,
            to_name: `${userData.firstName} ${userData.lastName}`,
            name: `${userData.firstName} ${userData.lastName}`,
            user_email: userData.email,
            time: new Date().toLocaleString(),
            verification_link: `${EMAIL_CONFIG.baseURL}/verify-email?token=${userData.verificationToken}`,
            message: `Welcome to N.honest! Please verify your email to activate your account.`
        };

        const response = await emailjs.send(
            EMAIL_CONFIG.serviceID,
            EMAIL_CONFIG.templates.verification,
            templateParams
        );
        console.log('Verification email sent:', response);
        return { success: true };
    } catch (error) {
        console.error('Error sending verification email:', error);
        return { success: false, error };
    }
};

// Send invoice email
const sendInvoiceEmail = async (orderData) => {
    try {
        const templateParams = {
            to_email: orderData.customer.email,
            to_name: orderData.customer.fullName,
            order_number: orderData.orderNumber,
            order_date: new Date().toLocaleString(),
            total_amount: orderData.total.toLocaleString(),
            items_summary: orderData.items.map(item => 
                `${item.name} (${item.quantity}x) - RWF ${item.price}`
            ).join('\n'),
            invoice_url: `${EMAIL_CONFIG.baseURL}/invoices/${orderData.orderNumber}`,
            merchant_code: "430020"
        };

        // Only send from client-side if explicitly requested
        if (orderData.sendClientNotification) {
            const response = await emailjs.send(
                EMAIL_CONFIG.serviceID,
                EMAIL_CONFIG.templates.invoice,
                templateParams
            );
            console.log('Client-side invoice notification sent:', response);
            return { success: true };
        }
        
        return { success: true, skipped: true };
    } catch (error) {
        console.error('Error sending invoice email:', error);
        return { success: false, error };
    }
};

// Test function
const testEmailService = async () => {
    try {
        const testParams = {
            to_email: "test@example.com",
            to_name: "Test User",
            subject: "Test Email from Client",
            message: "This is a test email sent from the client side",
            verification_url: `${window.location.origin}/verify`
        };

        const response = await emailjs.send(
            "service_3hekbvk",
            "template_zpxvfqs",
            testParams
        );

        console.log('Test email sent successfully:', response);
        return { success: true, response };
    } catch (error) {
        console.error('Test email failed:', error);
        return { success: false, error };
    }
};

// Export functions and constants
export {
    EMAIL_CONFIG,
    sendVerificationEmail,
    sendInvoiceEmail,
    testEmailService  // Add this export
};

// Export the config
window.emailConfig = emailConfig;

// Initialize when the script loads
document.addEventListener('DOMContentLoaded', function() {
    emailConfig.init();
});
