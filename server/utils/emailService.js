/**
 * Email Service Utility
 * Handles email sending with fallback options between Nodemailer and client-side EmailJS
 */

const nodemailer = require('nodemailer');
const emailjs = require('@emailjs/nodejs');
const crypto = require('crypto');
const { generateInvoicePDF } = require('../../utils/pdfGenerator'); // Add this import
const { google } = require('googleapis');
require('dotenv').config();

// Initialize EmailJS with environment variables
emailjs.init({
    publicKey: process.env.EMAILJS_PUBLIC_KEY,
    privateKey: process.env.EMAILJS_PRIVATE_KEY
});

// OAuth2 configuration
const createOAuth2Client = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const redirectUri = isProduction 
        ? 'https://nhonestsupermarket.com/auth/google/callback'
        : 'http://localhost:5000/auth/google/callback';

    return new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        redirectUri
    );
};

// Initialize transporter as null
let transporter = null;

// Create reusable transporter object using SMTP
const createTransporter = () => {
    try {
        // Validate required environment variables
        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            throw new Error('Missing email configuration. Check EMAIL_USER and EMAIL_APP_PASSWORD in environment variables.');
        }

        // Clean up app password by removing any whitespace
        const appPassword = process.env.EMAIL_APP_PASSWORD.replace(/\s+/g, '');

        // Create configuration object with more secure settings for production
        const config = {
    service: 'gmail',
            host: 'smtp.gmail.com', // Explicitly set host
            port: 465, // Use SSL
            secure: true, // Use SSL
    auth: {
        user: process.env.EMAIL_USER,
                pass: appPassword
            },
            tls: {
                rejectUnauthorized: true, // Enforce SSL in production
                minVersion: "TLSv1.2"
            },
            debug: process.env.NODE_ENV !== 'production',
            maxConnections: 5, // Limit concurrent connections
            maxMessages: Infinity,
            pool: true, // Use pooled connections
            rateDelta: 1000, // Limit to 1 second between messages
            rateLimit: 3 // Maximum 3 messages per rateDelta
        };

        console.log('Creating email transport with config:', {
            user: process.env.EMAIL_USER,
            service: 'gmail',
            environment: process.env.NODE_ENV,
            host: config.host,
            port: config.port,
            secure: config.secure
        });

        // Create and verify the transporter
        const transport = nodemailer.createTransport(config);
        
        // Verify the connection configuration
        return new Promise((resolve, reject) => {
            transport.verify((error, success) => {
                if (error) {
                    console.error('Email transport verification failed:', error);
                    reject(error);
                } else {
                    console.log('Email transport is ready to send messages');
                    resolve(transport);
                }
            });
        });
    } catch (error) {
        console.error('Failed to create email transport:', error);
        throw error;
    }
};

/**
 * Send an email using Nodemailer with retries
 */
const sendEmail = async (options, retries = 3) => {
    try {
        // Ensure we have a transporter
    if (!transporter) {
            transporter = await createTransporter();
        }
    
        // Validate required fields
        if (!options.to || !options.subject || (!options.html && !options.text)) {
            throw new Error('Missing required email fields (to, subject, and html/text)');
    }
    
    const mailOptions = {
            from: {
                name: 'N.Honest Supermarket',
                address: process.env.EMAIL_USER
            },
        to: options.to,
            cc: options.cc,
        subject: options.subject,
        html: options.html,
            text: options.text || 'Please view this email in an HTML-compatible email client',
            attachments: options.attachments,
            headers: {
                'X-Environment': process.env.NODE_ENV,
                'X-Mailer': 'N.Honest Mailer',
                'X-Priority': '1', // High priority
                'X-MSMail-Priority': 'High'
            }
        };

        console.log(`Attempting to send email to: ${options.to} (${process.env.NODE_ENV} environment)`);

        const info = await transporter.sendMail(mailOptions);
                console.log('Email sent successfully:', info.messageId);
        return {
                    success: true,
            messageId: info.messageId
        };
    } catch (error) {
                console.error('Error sending email:', error);
        
        // Check for specific Gmail errors
        if (error.code === 'EAUTH') {
            console.error('Authentication failed. Please check your Gmail credentials.');
            transporter = null; // Reset transporter
        } else if (error.code === 'ESOCKET') {
            console.error('Network error occurred while sending email.');
            transporter = null; // Reset transporter
        }
        
        // Retry logic
        if (retries > 0) {
            console.log(`Retrying email send... (${retries} attempts remaining)`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            return sendEmail(options, retries - 1);
        }
        
        throw new Error(`Failed to send email after multiple attempts: ${error.message}`);
    }
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

/**
 * Send an invoice email with retries
 */
const sendInvoiceEmail = async (order, retries = 3) => {
    try {
        // Validate order data
        if (!order || !order.customer || !order.customer.email) {
            throw new Error('Invalid order data: missing customer email');
        }

        // Generate PDF
        const pdfBuffer = await generateInvoicePDF(order);
        
        // Create invoice email HTML
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>Order Confirmation - #${order.reference || order.orderNumber}</h1>
                <p>Dear ${order.customer.fullName},</p>
                <p>Thank you for your order with N.Honest Supermarket. Please find your invoice attached.</p>
                <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
                    <h3>Order Summary</h3>
                    <p><strong>Order Number:</strong> ${order.reference || order.orderNumber}</p>
                    <p><strong>Order Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Total Amount:</strong> RWF ${order.total.toLocaleString()}</p>
                </div>
                <div style="background-color: #e9ecef; padding: 20px; margin: 20px 0; border-radius: 5px;">
                    <h3>Payment Instructions</h3>
                    <p><strong>MTN Mobile Money:</strong></p>
                    <ol>
                        <li>Dial *182*8*1#</li>
                        <li>Enter merchant code: 430020</li>
                        <li>Amount: RWF ${order.total.toLocaleString()}</li>
                        <li>Reference: ${order.reference || order.orderNumber}</li>
                    </ol>
                </div>
                <p>If you have any questions, please contact us at:</p>
                <p>Email: info@nhonestsupermarket.com<br>Phone: +250 788 633 739</p>
            </div>
        `;

        // Send email to customer with retry logic
        const customerMailOptions = {
            to: order.customer.email,
            subject: `N.Honest - Order Confirmation #${order.reference || order.orderNumber}`,
            html: emailHtml,
            attachments: [{
                filename: `invoice-${order.reference || order.orderNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        };

        // Send email to company (for records)
        const companyMailOptions = {
            to: process.env.ADMIN_EMAIL || 'info@nhonestsupermarket.com',
            subject: `New Order Received - #${order.reference || order.orderNumber}`,
            html: `
                <h2>New Order Received</h2>
                <p><strong>Customer:</strong> ${order.customer.fullName}</p>
                <p><strong>Email:</strong> ${order.customer.email}</p>
                <p><strong>Phone:</strong> ${order.customer.phone}</p>
                <p><strong>Amount:</strong> RWF ${order.total.toLocaleString()}</p>
            `,
            attachments: [{
                filename: `invoice-${order.reference || order.orderNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        };

        // Send both emails with retries
        const [customerEmailResult, companyEmailResult] = await Promise.all([
            sendEmail(customerMailOptions, retries),
            sendEmail(companyMailOptions, retries)
        ]);

        console.log('Invoice emails sent successfully:', {
            customerEmail: customerEmailResult.messageId,
            companyEmail: companyEmailResult.messageId,
            environment: process.env.NODE_ENV
        });

        return {
            success: true,
            customerEmailId: customerEmailResult.messageId,
            companyEmailId: companyEmailResult.messageId
        };

    } catch (error) {
        console.error('Failed to send invoice email:', error);
        
        // Retry logic for the entire invoice email process
        if (retries > 0) {
            console.log(`Retrying invoice email send... (${retries} attempts remaining)`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            return sendInvoiceEmail(order, retries - 1);
        }
        
        throw error;
    }
};

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendInvoiceEmail,
    getEmailJSParams
};
