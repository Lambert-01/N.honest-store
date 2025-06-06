/**
 * Email Service Utility
 * Handles email sending with Resend API and Google authentication
 */

const { Resend } = require('resend');
const { google } = require('googleapis');
const crypto = require('crypto');
const { generateInvoicePDF } = require('./pdfGenerator');
require('dotenv').config();

// Constants
const COMPANY_NAME = 'N.honest Supermarket';
const COMPANY_EMAIL = process.env.BUSINESS_EMAIL || 'info@nhonestsupermarket.com';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const TEST_EMAIL = 'nhonestsp@gmail.com';
const DEFAULT_FROM = `${COMPANY_NAME} <${COMPANY_EMAIL}>`;

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Validate email configuration
if (!process.env.RESEND_API_KEY) {
    console.error('WARNING: RESEND_API_KEY is not set. Email functionality will not work.');
}

// OAuth2 configuration for Google login (keeping this for authentication)
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

/**
 * Send an email using Resend API with retries
 */
const sendEmail = async (options, retries = 3) => {
    console.log(`Attempting to send email to ${options.to} with subject: ${options.subject}`);
    
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured');
    }

    try {
        const emailData = {
            from: DEFAULT_FROM,
            to: options.to,
            subject: options.subject,
            html: options.html,
            attachments: options.attachments
        };

        // Add a note in development mode
        if (!IS_PRODUCTION) {
            emailData.html = `
                <div style="background: #ffeb3b; padding: 10px; margin-bottom: 20px;">
                    ⚠️ DEVELOPMENT MODE: Original recipient would have been ${options.to}
                </div>
                ${emailData.html}
            `;
        }

        const response = await resend.emails.send(emailData);
        console.log('Email sent successfully:', response);
        return response;
    } catch (error) {
        console.error('Error sending email:', error);
        
        if (retries > 0) {
            console.log(`Retrying... ${retries} attempts remaining`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return sendEmail(options, retries - 1);
        }
        
        throw new Error(`Resend API error: ${error.message}`);
    }
};

/**
 * Send a verification email to a customer
 */
const sendVerificationEmail = async (customer, req) => {
    if (!customer.verificationToken) {
        customer.verificationToken = crypto.randomBytes(32).toString('hex');
        await customer.save();
    }
    
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const verificationUrl = `${baseUrl}/api/customer/verify-email?token=${customer.verificationToken}`;
    
    return sendEmail({
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
    });
};

/**
 * Send an invoice email
 */
const sendInvoiceEmail = async (order) => {
    console.log(`Starting invoice email process for order: ${order.reference}`);
    
    try {
        // Generate PDF
        console.log('Generating PDF...');
        const pdfBuffer = await generateInvoicePDF(order);
        console.log('PDF generated successfully');

        // Prepare email content
        const customerEmailContent = `
            <h2>Thank you for your order!</h2>
            <p>Dear ${order.customer.fullName},</p>
            <p>We have received your order #${order.reference}. Please find your invoice attached.</p>
            <p>Order Details:</p>
            <ul>
                <li>Order Number: ${order.orderNumber}</li>
                <li>Total Amount: RWF ${order.total.toLocaleString()}</li>
                <li>Payment Method: ${order.paymentMethod}</li>
            </ul>
            <p>If you have any questions, please contact us at ${COMPANY_EMAIL}</p>
            <p>Best regards,<br>${COMPANY_NAME} Team</p>
        `;

        const businessEmailContent = `
            <h2>New Order Received</h2>
            <p>Order Details:</p>
            <ul>
                <li>Order Number: ${order.orderNumber}</li>
                <li>Reference: ${order.reference}</li>
                <li>Customer: ${order.customer.fullName}</li>
                <li>Email: ${order.customer.email}</li>
                <li>Phone: ${order.customer.phone}</li>
                <li>Total Amount: RWF ${order.total.toLocaleString()}</li>
                <li>Payment Method: ${order.paymentMethod}</li>
            </ul>
            <p>Please find the invoice attached.</p>
        `;

        // Send to customer
        console.log('Sending email to customer:', order.customer.email);
        await sendEmail({
            to: order.customer.email,
            subject: `${COMPANY_NAME} - Order Confirmation #${order.reference}`,
            html: customerEmailContent,
            attachments: [
                {
                    filename: `invoice-${order.reference}.pdf`,
                    content: pdfBuffer
                }
            ]
        });

        // Send to business
        console.log('Sending email to business');
        await sendEmail({
            to: COMPANY_EMAIL,
            subject: `New Order Received - #${order.reference}`,
            html: businessEmailContent,
            attachments: [
                {
                    filename: `invoice-${order.reference}.pdf`,
                    content: pdfBuffer
                }
            ]
        });

        console.log('All invoice emails sent successfully');
        return true;
    } catch (error) {
        console.error('Error sending invoice email:', error);
        // Don't throw error to allow order creation to continue
        return false;
    }
};

/**
 * Check if email service is properly configured
 */
const checkEmailService = async () => {
    try {
        if (!process.env.RESEND_API_KEY) {
            return {
                status: 'error',
                message: 'RESEND_API_KEY is not configured'
            };
        }

        // Try to send a test email
        await sendEmail({
            to: COMPANY_EMAIL,
            subject: 'Email Service Test',
            html: '<p>This is a test email to verify the email service configuration.</p>'
        });

        return {
            status: 'success',
            message: 'Email service is properly configured'
        };
    } catch (error) {
        return {
            status: 'error',
            message: `Email service configuration error: ${error.message}`
        };
    }
};

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendInvoiceEmail,
    checkEmailService,
    createOAuth2Client
};
