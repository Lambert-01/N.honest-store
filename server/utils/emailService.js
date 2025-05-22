/**
 * Email Service Utility
 * Handles email sending with fallback options between Nodemailer and client-side EmailJS
 */

const nodemailer = require('nodemailer');
const verificationConfig = require('../config/verification');

// Email transporter
let transporter;

// Initialize the nodemailer transporter
try {
    transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        },
        tls: {
            rejectUnauthorized: false // Helps with some Gmail connection issues
        }
    });
    
    // Verify the connection configuration
    transporter.verify(function(error, success) {
        if (error) {
            console.error('Email configuration error:', error);
        } else {
            console.log('Email server is ready to send messages');
        }
    });
} catch (error) {
    console.error('Failed to create email transporter:', error);
}

/**
 * Send an email using Nodemailer
 * @param {Object} options - Email options
 * @param {String} options.to - Recipient email
 * @param {String} options.subject - Email subject
 * @param {String} options.html - Email HTML content
 * @param {String} options.text - Email text content (fallback)
 * @returns {Promise} - Promise resolving to email info or error
 */
const sendEmail = async (options) => {
    if (!transporter) {
        throw new Error('Email transport not configured properly');
    }
    
    const mailOptions = {
        from: `"N.Honest Supermarket" <${process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || 'Please view this email in an HTML-compatible email client'
    };
    
    // Add timeout to prevent hanging
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Email sending timed out'));
        }, 10000); // 10 second timeout
        
        transporter.sendMail(mailOptions)
            .then(info => {
                clearTimeout(timeout);
                console.log('Email sent successfully:', info.messageId);
                resolve({
                    success: true,
                    messageId: info.messageId,
                    useClientFallback: false
                });
            })
            .catch(error => {
                clearTimeout(timeout);
                console.error('Error sending email:', error);
                // Indicate that client-side fallback should be used
                resolve({
                    success: false,
                    error: error.message,
                    useClientFallback: true
                });
            });
    });
};

/**
 * Send a verification email to a customer
 * @param {Object} customer - Customer object
 * @param {Object} req - Express request object
 * @returns {Promise} - Promise resolving to email info or error
 */
const sendVerificationEmail = async (customer, req) => {
    // Skip if verification is not required
    if (!verificationConfig.requireVerification || !verificationConfig.sendVerificationEmails) {
        return { success: true, skipped: true };
    }
    
    // Generate verification token if not exists
    if (!customer.verificationToken) {
        const crypto = require('crypto');
        customer.verificationToken = crypto.randomBytes(32).toString('hex');
        await customer.save();
    }
    
    // Build verification URL
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const verificationUrl = `${baseUrl}/api/customer/verify-email?token=${customer.verificationToken}`;
    
    // Email content
    const emailOptions = {
        to: customer.email,
        subject: 'Verify Your N.Honest Account',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
                    <h1>N.Honest Supermarket</h1>
                </div>
                <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
                    <h2>Welcome to N.Honest!</h2>
                    <p>Thank you for creating an account with us. Please verify your email address by clicking the button below:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
                    </div>
                    <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
                    <p><a href="${verificationUrl}">${verificationUrl}</a></p>
                    <p>This link will expire in 24 hours.</p>
                    <p>If you did not create an account, please ignore this email.</p>
                    <p>Thank you,<br>The N.Honest Team</p>
                </div>
            </div>
        `
    };
    
    return sendEmail(emailOptions);
};

/**
 * Generate EmailJS parameters for client-side email sending
 * @param {Object} customer - Customer object
 * @param {String} emailType - Type of email to send (welcome, login, order, etc.)
 * @returns {Object} - EmailJS parameters
 */
const getEmailJSParams = (customer, emailType) => {
    const params = {
        to_name: `${customer.firstName} ${customer.lastName}`,
        to_email: customer.email
    };
    
    switch (emailType) {
        case 'welcome':
            params.subject = 'Welcome to N.Honest Supermarket!';
            params.message = 'Thank you for creating an account with N.honest Supermarket. Your account has been successfully created and you can now log in to start shopping!';
            break;
        case 'login':
            params.subject = 'N.Honest Login Notification';
            params.message = 'You have successfully logged in to your N.honest Supermarket account. If this was not you, please contact us immediately.';
            break;
        case 'order':
            params.subject = 'Your N.Honest Order Confirmation';
            params.message = 'Thank you for your order with N.honest Supermarket. Your order has been received and is being processed.';
            break;
        default:
            params.subject = 'N.Honest Supermarket Notification';
            params.message = 'This is a notification from N.honest Supermarket.';
    }
    
    return params;
};

module.exports = {
    sendEmail,
    sendVerificationEmail,
    getEmailJSParams
};
