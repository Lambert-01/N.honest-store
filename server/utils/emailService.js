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

// Create reusable transporter object using SMTP
const createTransporter = () => {
    // Create configuration object
    const config = {
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD?.replace(/\s+/g, '') // Remove any spaces from app password
        }
    };

    console.log('Creating email transport with config:', {
        user: process.env.EMAIL_USER,
        service: 'gmail'
    });

    // Create the transporter
    return nodemailer.createTransport(config);
};

// Initialize transporter
let transporter = createTransporter();

/**
 * Send an email using Nodemailer
 */
const sendEmail = async (options) => {
    try {
        // Ensure we have a transporter
        if (!transporter) {
            transporter = createTransporter();
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
            attachments: options.attachments
        };

        console.log('Attempting to send email to:', options.to);

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        console.error('Error sending email:', error);
        // Try to recreate transporter
        transporter = createTransporter();
        throw new Error(`Failed to send email: ${error.message}`);
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
 * Send an invoice email
 */
const sendInvoiceEmail = async (order, invoiceHtml) => {
    try {
        // Generate PDF
        const pdfBuffer = await generateInvoicePDF(order);
        
        // Create invoice email HTML
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>Order Confirmation - #${order.orderNumber}</h1>
                <p>Dear ${order.customer.fullName},</p>
                <p>Thank you for your order. Please find your invoice attached.</p>
                ${invoiceHtml}
                <p>Payment Instructions:</p>
                <ul>
                    <li>MTN Mobile Money: Dial *182*8*1#</li>
                    <li>Merchant code: 430020</li>
                    <li>Amount: RWF ${order.total.toLocaleString()}</li>
                </ul>
                <p>If you have any questions, please contact us at info@nhonestsupermarket.com</p>
            </div>
        `;

        // Create company copy email HTML
        const companyEmailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>New Order Received - #${order.orderNumber}</h1>
                <p>A new order has been received from ${order.customer.fullName}</p>
                <p>Customer Details:</p>
                <ul>
                    <li>Name: ${order.customer.fullName}</li>
                    <li>Email: ${order.customer.email}</li>
                    <li>Phone: ${order.customer.phone}</li>
                    <li>Address: ${order.customer.address}</li>
                    <li>City: ${order.customer.city}</li>
                    <li>Sector: ${order.customer.sector}</li>
                </ul>
                ${invoiceHtml}
                <p>Order Total: RWF ${order.total.toLocaleString()}</p>
                <p>Payment Method: ${order.paymentMethod}</p>
            </div>
        `;

        // Send email to customer
        const customerMailOptions = {
            to: order.customer.email,
            subject: `N.Honest - Order Confirmation #${order.orderNumber}`,
            html: emailHtml,
            attachments: [{
                filename: `invoice-${order.orderNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        };

        // Send email to company
        const companyMailOptions = {
            to: 'info@nhonestsupermarket.com',
            subject: `New Order Received - #${order.orderNumber}`,
            html: companyEmailHtml,
            attachments: [{
                filename: `invoice-${order.orderNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        };

        // Send both emails
        const [customerEmailResult, companyEmailResult] = await Promise.all([
            sendEmail(customerMailOptions),
            sendEmail(companyMailOptions)
        ]);

        console.log('Invoice emails sent successfully:', {
            customerEmail: customerEmailResult.messageId,
            companyEmail: companyEmailResult.messageId
        });

        return {
            success: true,
            customerEmailId: customerEmailResult.messageId,
            companyEmailId: companyEmailResult.messageId
        };

    } catch (error) {
        console.error('Failed to send invoice email:', error);
        throw new Error(`Failed to send invoice email: ${error.message}`);
    }
};

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendInvoiceEmail,
    getEmailJSParams
};
