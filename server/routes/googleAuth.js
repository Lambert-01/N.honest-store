/**
 * Google OAuth Authentication Routes
 * Handles Google Sign-In and Sign-Up functionality
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const Customer = require('../models/Customer');
const { sendEmail } = require('../utils/emailService');

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GMAIL_CLIENT_ID);

// Log the Google Client ID to verify it's loaded correctly
console.log('Google Client ID loaded:', process.env.GMAIL_CLIENT_ID ? 'Yes (hidden for security)' : 'No');

// Helper function to validate Google token
async function verifyGoogleToken(credential) {
    try {
        console.log('Verifying Google token...');
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GMAIL_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        console.log('Google token verified successfully');
        return payload;
    } catch (error) {
        console.error('Google token verification failed:', error);
        throw new Error('Invalid Google token');
    }
}

// Google authentication route (login)
router.post('/login', async (req, res) => {
    try {
        const { credential } = req.body;
        
        if (!credential) {
            return res.status(400).json({ error: 'No credential provided' });
        }

        // Verify the Google token
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GMAIL_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { email, given_name, family_name, picture, sub: googleId } = payload;

        // Find or create customer
        let customer = await Customer.findOne({ email });

        if (!customer) {
            // Create new customer
            customer = new Customer({
                firstName: given_name,
                lastName: family_name,
                email,
                googleId,
                picture,
                password: Math.random().toString(36).slice(-8), // Random password for Google users
                isVerified: true // Google users are automatically verified
            });
            await customer.save();
        } else {
            // Update existing customer's Google info
            customer.googleId = googleId;
            customer.picture = picture;
            await customer.save();
        }

        // Generate JWT token
        const token = jwt.sign(
            { _id: customer._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Return success response
        res.json({
            success: true,
            token,
            customer: {
                _id: customer._id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                picture: customer.picture
            }
        });

    } catch (error) {
        console.error('Google auth error:', error);
        res.status(401).json({
            error: 'Authentication failed',
            details: error.message
        });
    }
});

// Google signup route
router.post('/signup', async (req, res) => {
    console.log('Google signup route hit');
    try {
        const { credential } = req.body;
        
        if (!credential) {
            console.error('No credential provided in signup request');
            return res.status(400).json({ error: 'Google credential is required' });
        }
        
        console.log('Signup credential received, verifying...');
        
        // Verify the Google token using our helper function
        const payload = await verifyGoogleToken(credential);
        const { email, given_name, family_name, picture, sub } = payload;
        
        console.log(`Google signup user verified: ${email}`);
        
        // Check if customer already exists
        let customer = await Customer.findOne({ email });
        console.log('Customer already exists in database:', customer ? 'Yes' : 'No');
        
        if (customer) {
            console.log('Customer already exists, returning login suggestion');
            return res.status(400).json({ 
                error: 'An account with this email already exists. Please login instead.'
            });
        }
        
        console.log('Creating new customer account from Google signup');
        // Create new customer
        customer = new Customer({
            firstName: given_name,
            lastName: family_name,
            email,
            googleId: sub,
            profilePicture: picture,
            isVerified: true, // Auto-verify Google accounts
            // Generate a random password (they'll use Google to login)
            password: crypto.randomBytes(16).toString('hex'),
            // Set default email preferences
            emailPreferences: {
                welcomeEmail: true,
                loginNotifications: true,
                marketingEmails: true,
                orderConfirmations: true
            }
        });
        
        await customer.save();
        console.log('New customer account created successfully from signup:', customer._id);
        
        // Generate JWT token
        const token = jwt.sign({ _id: customer._id }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        });
        
        // Try to send welcome email
        try {
            await sendEmail({
                to: email,
                subject: 'Welcome to N.honest Supermarket!',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
                            <h1>N.Honest Supermarket</h1>
                        </div>
                        <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
                            <h2>Welcome to N.Honest!</h2>
                            <p>Hello ${given_name},</p>
                            <p>Thank you for creating an account with N.honest Supermarket. Your account has been successfully created with Google Sign-In.</p>
                            <p>You can now start shopping and enjoy our products!</p>
                            <p>Thank you,<br>The N.Honest Team</p>
                        </div>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Error sending welcome email:', emailError);
            // Continue even if email fails
        }
        
        // Return success response
        res.status(201).json({
            message: 'Account created successfully with Google!',
            token,
            customer: {
                _id: customer._id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                picture: customer.profilePicture
            }
        });
    } catch (error) {
        console.error('Google signup error:', error);
        console.error('Signup error details:', error.stack);
        
        // Provide more detailed error message based on the error type
        let errorMessage = 'Failed to create account with Google';
        let statusCode = 500;
        
        if (error.message === 'Invalid Google token') {
            errorMessage = 'The Google authentication token is invalid or expired';
            statusCode = 401;
        } else if (error.message.includes('audience')) {
            errorMessage = 'Google Client ID mismatch. Please ensure the correct Client ID is configured';
            statusCode = 401;
        } else if (error.message.includes('duplicate key') || error.code === 11000) {
            errorMessage = 'An account with this email already exists. Please login instead.';
            statusCode = 400;
        } else if (error.message.includes('validation failed')) {
            errorMessage = 'Invalid account information provided';
            statusCode = 400;
        }
        
        res.status(statusCode).json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
