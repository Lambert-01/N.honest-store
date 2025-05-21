const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Customer = require('../models/Customer');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const verificationConfig = require('../config/verification');

// In-memory token blacklist (in production, use Redis or another persistent store)
const tokenBlacklist = new Set();

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Email configuration
let transporter;

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

// Middleware to verify customer JWT token
const customerAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            throw new Error('Please authenticate');
        }

        // Check if token is blacklisted
        if (tokenBlacklist.has(token)) {
            throw new Error('Token has been revoked');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const customer = await Customer.findOne({ 
            _id: decoded._id, 
            isActive: true 
        });

        if (!customer) {
            throw new Error('Please authenticate');
        }

        req.token = token;
        req.customer = customer;
        req.tokenExp = decoded.exp;
        next();
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};

// Helper function to send verification email
const sendVerificationEmail = async (customer, req) => {
    // Create verification token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set token and expiration (24 hours)
    customer.verificationToken = token;
    customer.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    await customer.save();
    
    // Get base URL from request or use default
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    // Create verification URL
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
    
    // Email content
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: customer.email,
        subject: 'N.Honest - Verify Your Email Address',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #4CAF50; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">N.Honest Supermarket</h1>
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
    
    // Send email
    if (!transporter) {
        throw new Error('Email transport not configured properly');
    }
    
    // Add timeout to prevent hanging
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Email sending timed out'));
        }, 10000); // 10 second timeout
        
        transporter.sendMail(mailOptions)
            .then(info => {
                clearTimeout(timeout);
                console.log('Verification email sent:', info.messageId);
                resolve(info);
            })
            .catch(error => {
                clearTimeout(timeout);
                console.error('Error sending verification email:', error);
                reject(error);
            });
    });
};

// Customer signup route
router.post('/signup', async (req, res) => {
    try {
        const { firstName, lastName, email, password, phone } = req.body;

        // Check if customer already exists
        const existingCustomer = await Customer.findOne({ email });

        if (existingCustomer) {
            return res.status(400).json({ 
                error: 'Email is already in use' 
            });
        }

        // Create new customer
        const customer = new Customer({ 
            firstName, 
            lastName, 
            email, 
            password,
            phone,
            // Auto-verify based on configuration
            isVerified: verificationConfig.autoVerifyAccounts
        });
        await customer.save();

        try {
            // Send verification email
            await sendVerificationEmail(customer, req);
            
            res.status(201).json({
                message: 'Account created successfully! Please check your email to verify your account.',
                customer: {
                    _id: customer._id,
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    email: customer.email
                }
            });
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            
            // Still return success but with a different message
            res.status(201).json({
                message: 'Account created successfully! Email verification is currently unavailable. You can log in and request verification later.',
                emailError: true,
                customer: {
                    _id: customer._id,
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    email: customer.email
                }
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Email verification route
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        
        if (!token) {
            return res.status(400).json({ error: 'Verification token is required' });
        }
        
        // Find customer with matching token that hasn't expired
        const customer = await Customer.findOne({
            verificationToken: token,
            verificationTokenExpires: { $gt: Date.now() }
        });
        
        if (!customer) {
            return res.status(400).json({ 
                error: 'Invalid or expired verification token' 
            });
        }
        
        // Mark customer as verified and clear token
        customer.isVerified = true;
        customer.verificationToken = undefined;
        customer.verificationTokenExpires = undefined;
        await customer.save();
        
        // Redirect to login page with success message
        res.redirect('/client-login.html?verified=true');
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;
        
        const customer = await Customer.findOne({ email });
        
        if (!customer) {
            return res.status(404).json({ error: 'No account found with that email address' });
        }
        
        if (customer.isVerified) {
            return res.status(400).json({ error: 'This account is already verified' });
        }
        
        // Send new verification email
        await sendVerificationEmail(customer, req);
        
        res.json({ message: 'Verification email has been resent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Customer login route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const customer = await Customer.findOne({ email });

        if (!customer || !await customer.comparePassword(password)) {
            return res.status(401).json({ error: 'Invalid login credentials' });
        }

        // Check if email verification is required based on config
        if (verificationConfig.requireVerification && !customer.isVerified) {
            return res.status(401).json({ 
                error: 'Please verify your email before logging in',
                needsVerification: true
            });
        } else if (!customer.isVerified) {
            // If verification not required but account is unverified, auto-verify it
            console.log(`Auto-verifying user ${customer.email} (verification not required in current environment)`);
            
            // Auto-verify the account
            customer.isVerified = true;
            await customer.save();
        }

        if (!customer.isActive) {
            return res.status(401).json({ error: 'Account is inactive' });
        }

        // Update last login
        customer.lastLogin = new Date();
        await customer.save();

        // Generate JWT token with expiration time
        const token = jwt.sign(
            { 
                _id: customer._id.toString(),
                type: 'customer',
                // Add a random token identifier to help with blacklisting
                jti: Math.random().toString(36).substring(2)
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' } // Longer token lifetime for customers
        );

        // Get token expiry time
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const tokenExpiry = decodedToken.exp;

        res.json({
            customer: {
                _id: customer._id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                exp: tokenExpiry
            },
            token
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Forgot password route
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const customer = await Customer.findOne({ email });
        
        if (!customer) {
            // For security reasons, don't reveal that the email doesn't exist
            return res.json({ message: 'If your email is registered, you will receive a password reset link' });
        }
        
        // Generate reset token
        const token = crypto.randomBytes(32).toString('hex');
        customer.resetPasswordToken = token;
        customer.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await customer.save();
        
        // Get base URL from request or use default
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
        // Create reset URL
        const resetUrl = `${baseUrl}/reset-password.html?token=${token}`;
        
        // Email content
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: customer.email,
            subject: 'N.Honest - Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #4CAF50; padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0;">N.Honest Supermarket</h1>
                    </div>
                    <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
                        <h2>Password Reset Request</h2>
                        <p>You requested a password reset for your N.Honest account. Click the button below to reset your password:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
                        </div>
                        <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
                        <p><a href="${resetUrl}">${resetUrl}</a></p>
                        <p>This link will expire in 1 hour.</p>
                        <p>If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
                        <p>Thank you,<br>The N.Honest Team</p>
                    </div>
                </div>
            `
        };
        
        // Send email
        await transporter.sendMail(mailOptions);
        
        res.json({ message: 'If your email is registered, you will receive a password reset link' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reset password route
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        
        const customer = await Customer.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!customer) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
        
        // Update password and clear reset token
        customer.password = password;
        customer.resetPasswordToken = undefined;
        customer.resetPasswordExpires = undefined;
        await customer.save();
        
        res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get current customer profile
router.get('/me', customerAuth, async (req, res) => {
    try {
        res.json({
            _id: req.customer._id,
            firstName: req.customer.firstName,
            lastName: req.customer.lastName,
            email: req.customer.email,
            phone: req.customer.phone,
            address: req.customer.address
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update customer profile
router.patch('/profile', customerAuth, async (req, res) => {
    try {
        const updates = req.body;
        const allowedUpdates = ['firstName', 'lastName', 'phone', 'address'];
        
        // Filter out disallowed updates
        const validUpdates = Object.keys(updates)
            .filter(update => allowedUpdates.includes(update))
            .reduce((obj, key) => {
                obj[key] = updates[key];
                return obj;
            }, {});
            
        // Apply updates
        Object.assign(req.customer, validUpdates);
        await req.customer.save();
        
        res.json({
            message: 'Profile updated successfully',
            customer: {
                _id: req.customer._id,
                firstName: req.customer.firstName,
                lastName: req.customer.lastName,
                email: req.customer.email,
                phone: req.customer.phone,
                address: req.customer.address
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Change password
router.post('/change-password', customerAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Verify current password
        const isMatch = await req.customer.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        
        // Update password
        req.customer.password = newPassword;
        await req.customer.save();
        
        // Blacklist current token
        tokenBlacklist.add(req.token);
        
        res.json({ message: 'Password changed successfully. Please log in again.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logout route
router.post('/logout', customerAuth, async (req, res) => {
    try {
        // Add the token to the blacklist
        tokenBlacklist.add(req.token);
        
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Google Sign-In route
router.post('/google-signin', async (req, res) => {
    try {
        const { token } = req.body;
        
        // Verify Google token
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        const googleId = payload.sub;
        
        // Check if user exists
        let customer = await Customer.findOne({ googleId });
        
        if (!customer) {
            // Create new customer if not exists
            customer = new Customer({
                googleId,
                firstName: payload.given_name,
                lastName: payload.family_name,
                email: payload.email,
                picture: payload.picture,
                isVerified: true // Google accounts are already verified
            });
            
            await customer.save();
        } else {
            // Update customer info if needed
            customer.firstName = payload.given_name;
            customer.lastName = payload.family_name;
            customer.picture = payload.picture;
            customer.lastLogin = new Date();
            
            await customer.save();
        }
        
        // Generate JWT token
        const jwtToken = jwt.sign(
            { 
                _id: customer._id.toString(),
                type: 'customer',
                jti: Math.random().toString(36).substring(2)
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Get token expiry time
        const decodedToken = jwt.verify(jwtToken, process.env.JWT_SECRET);
        const tokenExpiry = decodedToken.exp;
        
        res.json({
            customer: {
                _id: customer._id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                picture: customer.picture,
                exp: tokenExpiry
            },
            token: jwtToken
        });
    } catch (error) {
        console.error('Google Sign-In error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

module.exports = { router, customerAuth };
