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
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google authentication route (login)
router.post('/login', async (req, res) => {
    try {
        const { credential } = req.body;
        
        // Verify the Google token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        const { email, given_name, family_name, picture, sub } = payload;
        
        // Check if customer exists
        let customer = await Customer.findOne({ email });
        
        if (!customer) {
            // If customer doesn't exist, return error - they should sign up first
            return res.status(404).json({ 
                error: 'No account found with this email. Please sign up first.'
            });
        }
        
        // Update customer's Google ID if not already set
        if (!customer.googleId) {
            customer.googleId = sub;
            await customer.save();
        }
        
        // Generate JWT token
        const token = jwt.sign({ _id: customer._id }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        });
        
        // Return customer data and token
        res.json({
            message: 'Login successful',
            token,
            customer: {
                _id: customer._id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                phone: customer.phone,
                picture: customer.profilePicture || picture,
                isVerified: customer.isVerified
            }
        });
    } catch (error) {
        console.error('Google authentication error:', error);
        res.status(401).json({ error: 'Google authentication failed' });
    }
});

// Google signup route
router.post('/signup', async (req, res) => {
    try {
        const { credential } = req.body;
        
        // Verify the Google token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        const { email, given_name, family_name, picture, sub } = payload;
        
        // Check if customer already exists
        let customer = await Customer.findOne({ email });
        
        if (customer) {
            return res.status(400).json({ 
                error: 'An account with this email already exists. Please login instead.'
            });
        }
        
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
        res.status(500).json({ error: 'Failed to create account with Google' });
    }
});

module.exports = router;
