/**
 * EmailJS Configuration for client-side usage
 */
const emailConfig = {
    serviceID: 'service_3hekbvk',
    templateID: {
        welcome: 'template_zpxvfqs',
        order: 'template_ahcpezh',
        verification: 'template_zpxvfqs'
    },
    publicKey: 'WOcO2ZGCFwjylrI2f',
    
    // Initialize EmailJS
    init() {
        if (typeof emailjs !== 'undefined') {
            emailjs.init(this.publicKey);
            console.log('EmailJS initialized successfully');
        } else {
            console.error('EmailJS library not loaded');
        }
    },

    // Send email helper function
    async sendEmail(params, templateType = 'welcome') {
        if (typeof emailjs === 'undefined') {
            throw new Error('EmailJS not initialized');
        }
        
        return emailjs.send(
            this.serviceID,
            this.templateID[templateType] || this.templateID.welcome,
            params
        );
    }
};

// Initialize when the script loads
document.addEventListener('DOMContentLoaded', () => emailConfig.init());

export default emailConfig;
