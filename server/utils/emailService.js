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

/**
 * Send an invoice email to a customer
 * @param {Object} order - Order object with customer and items information
 * @param {String} invoiceHtml - HTML content of the invoice
 * @returns {Promise} - Promise resolving to email info or error
 */
const sendInvoiceEmail = async (order, invoiceHtml) => {
    console.log('Attempting to send invoice email for order:', order.reference);
    
    // Validate inputs
    if (!order || !order.customer || !order.customer.email) {
        console.error('Invalid order data: Missing customer email');
        throw new Error('Invalid order data: Missing customer email');
    }
    
    // Get customer name (fallback to email if no name available)
    const customerName = order.customer.fullName || 
                       `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || 
                       order.customer.email.split('@')[0];
    
    // Format date properly
    const orderDate = order.date ? new Date(order.date).toLocaleDateString() : 
                     new Date().toLocaleDateString();
    
    // Format total amount with proper currency
    const totalAmount = typeof order.total === 'number' ? 
                       `RWF ${order.total.toFixed(2)}` : 
                       order.total || 'See invoice details';
    
    console.log(`Preparing invoice email for ${order.customer.email}`);
    
    const emailOptions = {
        to: order.customer.email,
        subject: `Your N.Honest Invoice #${order.reference}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
                    <h1>N.Honest Supermarket</h1>
                    <h2>Invoice #${order.reference}</h2>
                </div>
                
                <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <h3 style="color: #4CAF50; margin-top: 0;">Order Confirmation</h3>
                        <p>Dear <strong>${customerName}</strong>,</p>
                        <p>Thank you for shopping with N.Honest Supermarket. Your order has been received and is being processed.</p>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <h3 style="color: #4CAF50; margin-top: 0;">Order Summary</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Order Number:</strong></td>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${order.orderNumber || order.reference}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Order Date:</strong></td>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${orderDate}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Total Amount:</strong></td>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${totalAmount}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Payment Status:</strong></td>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${order.paymentStatus || 'Pending'}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <p>Please find your detailed invoice below. You can make payment using the instructions provided in the invoice.</p>
                        <p>If you have any questions about your order, please contact our customer service:</p>
                        <p>Email: <a href="mailto:support@nhonest.com">support@nhonest.com</a> | Phone: <a href="tel:+250788633739">+250 788 633 739</a></p>
                    </div>
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <p style="color: #6c757d; font-size: 14px;">Thank you for choosing N.Honest Supermarket!</p>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 30px;">
                ${invoiceHtml}
            </div>
        `
    };
    
    try {
        console.log('Sending invoice email...');
        const result = await sendEmail(emailOptions);
        console.log('Invoice email sent successfully:', result);
        return result;
    } catch (error) {
        console.error('Failed to send invoice email:', error);
        
        // Try fallback to EmailJS if server-side email fails
        console.log('Attempting fallback to client-side EmailJS...');
        return {
            success: false,
            error: error.message,
            useClientFallback: true
        };
    }
};

module.exports = {
    sendEmail,
    sendVerificationEmail,
    getEmailJSParams,
    sendInvoiceEmail
};
