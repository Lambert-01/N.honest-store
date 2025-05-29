/**
 * Email Verification Configuration
 * 
 * This file controls the email verification requirements for the application.
 * - In development mode: Email verification is bypassed by default
 * - In production mode: Email verification is required by default
 */

// Load environment variables
require('dotenv').config();

// Configuration object
const verificationConfig = {
    // Whether to require email verification for login
    requireVerification: process.env.NODE_ENV === 'production',
    
    // Whether to auto-verify new accounts (development only)
    autoVerifyAccounts: process.env.NODE_ENV !== 'production',
    
    // Whether to actually send verification emails
    sendVerificationEmails: process.env.SEND_EMAILS !== 'false',
    
    // Verification token expiry time (in hours)
    tokenExpiryHours: 24
};

// Log the current verification configuration
console.log('Email verification config:', {
    environment: process.env.NODE_ENV || 'development',
    requireVerification: verificationConfig.requireVerification,
    autoVerifyAccounts: verificationConfig.autoVerifyAccounts,
    sendVerificationEmails: verificationConfig.sendVerificationEmails
});

module.exports = verificationConfig;
