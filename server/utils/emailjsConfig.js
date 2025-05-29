/**
 * EmailJS Configuration Utility
 * Provides access to EmailJS credentials from environment variables
 */

// Get EmailJS credentials from environment variables or use defaults
const emailjsConfig = {
    serviceId: process.env.EMAILJS_SERVICE_ID || 'service_3hekbvk',
    templateId: process.env.EMAILJS_TEMPLATE_ID || 'template_zpxvfqs',
    publicKey: process.env.EMAILJS_PUBLIC_KEY || 'WOcO2ZGCFwjylrI2f',
    userId: process.env.EMAILJS_USER_ID || 'WOcO2ZGCFwjylrI2f'
};

/**
 * Generate HTML meta tags for EmailJS configuration
 * @returns {string} HTML meta tags with EmailJS configuration
 */
const getEmailJSMetaTags = () => {
    return `
    <meta name="emailjs-service-id" content="${emailjsConfig.serviceId}">
    <meta name="emailjs-template-id" content="${emailjsConfig.templateId}">
    <meta name="emailjs-public-key" content="${emailjsConfig.publicKey}">
    `;
};

module.exports = {
    emailjsConfig,
    getEmailJSMetaTags
};
