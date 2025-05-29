/**
 * EmailJS Configuration
 * Handles both development and production environments
 */

// EmailJS configuration object
const emailConfig = {
    // Production credentials
    production: {
        serviceId: 'service_3hekbvk',
        publicKey: 'WOcO2ZGCFwjylrI2f',
        templates: {
            welcome: 'template_zpxvfqs',
            invoice: 'template_ahcpezh',
            verification: 'template_zpxvfqs',
            reset: 'template_zpxvfqs'
        }
    },

    // Current environment settings (will be set during initialization)
    current: {
        serviceId: null,
        publicKey: null,
        templates: {}
    },

    // Initialize EmailJS with the appropriate configuration
    init: function() {
        return new Promise((resolve, reject) => {
            try {
                // Check if EmailJS library is loaded
                if (typeof emailjs === 'undefined') {
                    throw new Error('EmailJS library not found. Make sure to include the EmailJS script.');
                }

                // Set current configuration to production values
                this.current.serviceId = this.production.serviceId;
                this.current.publicKey = this.production.publicKey;
                this.current.templates = { ...this.production.templates };

                // Initialize EmailJS with the public key
                emailjs.init(this.current.publicKey);
                
                console.log('EmailJS initialized successfully');
                console.log('Service ID:', this.current.serviceId);
                console.log('Templates:', this.current.templates);
                
                resolve();
            } catch (error) {
                console.error('EmailJS initialization failed:', error);
                reject(error);
            }
        });
    },

    // Send an email using EmailJS
    sendEmail: async function(params, templateType = 'welcome') {
        try {
            // Validate initialization
            if (!this.current.serviceId || !this.current.publicKey) {
                throw new Error('EmailJS not properly initialized');
            }

            // Get template ID
            const templateId = this.current.templates[templateType];
            if (!templateId) {
                throw new Error(`Template type '${templateType}' not found`);
            }

            // Add common parameters
            const emailParams = {
                ...params,
                shop_name: 'N.Honest Supermarket',
                shop_logo: window.location.origin + '/images/f.logo.png',
                timestamp: new Date().toLocaleString(),
                base_url: window.location.origin
            };

            console.log(`Sending ${templateType} email using template: ${templateId}`);
            
            const response = await emailjs.send(
                this.current.serviceId,
                templateId,
                emailParams
            );

            console.log(`Email sent successfully:`, response);
            return { success: true, response };

        } catch (error) {
            console.error('Failed to send email:', error);
            throw error;
        }
    },

    // Send invoice email
    sendInvoiceEmail: async function(orderData) {
        try {
            const templateParams = {
                to_email: orderData.customer.email,
                to_name: orderData.customer.fullName,
                order_number: orderData.reference || orderData.orderNumber,
                order_date: new Date().toLocaleString(),
                total_amount: orderData.total.toLocaleString(),
                items_summary: orderData.items.map(item => 
                    `${item.name} (${item.quantity}x) - RWF ${item.price}`
                ).join('\n'),
                invoice_html: orderData.invoiceHtml,
                merchant_code: "430020",
                delivery_fee: orderData.deliveryFee.toLocaleString(),
                subtotal: orderData.subtotal.toLocaleString()
            };

            return await this.sendEmail(templateParams, 'invoice');
        } catch (error) {
            console.error('Error sending invoice:', error);
            throw error;
        }
    },

    // Send verification email
    sendVerificationEmail: async function(userData) {
        try {
            const templateParams = {
                to_email: userData.email,
                to_name: `${userData.firstName} ${userData.lastName}`,
                verification_link: `${window.location.origin}/verify-email?token=${userData.verificationToken}`,
                message: `Welcome to N.honest! Please verify your email to activate your account.`
            };

            return await this.sendEmail(templateParams, 'verification');
        } catch (error) {
            console.error('Error sending verification email:', error);
            throw error;
        }
    }
};

// Initialize EmailJS immediately
emailConfig.init().catch(error => {
    console.error('Failed to initialize EmailJS:', error);
});

// Export the configuration
window.emailConfig = emailConfig;
