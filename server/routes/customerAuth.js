const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Customer = require('../models/Customer');
const verificationConfig = require('../config/verification');
const { sendEmail, sendVerificationEmail, getEmailJSParams } = require('../utils/emailService');
const { OAuth2Client } = require('google-auth-library');

// In-memory token blacklist (in production, use Redis or another persistent store)
const tokenBlacklist = new Set();

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.CLIENT_ID);

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

// NOTE: We're now using the sendVerificationEmail function imported from emailService.js

// Customer signup route
router.post('/signup', async (req, res) => {
    try {
        const { firstName, lastName, email, password, phone, profilePicture } = req.body;

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
            profilePicture,
            // Auto-verify based on configuration
            isVerified: verificationConfig.autoVerifyAccounts,
            // Set default email preferences
            emailPreferences: {
                welcomeEmail: true,
                loginNotifications: true,
                marketingEmails: true,
                orderConfirmations: true
            }
        });
        await customer.save();

        try {
            // Send verification email
            const emailResult = await sendVerificationEmail(customer, req);
            
            if (emailResult.success && !emailResult.skipped) {
                // Email sent successfully via server
                res.status(201).json({
                    message: 'Account created successfully! Please check your email to verify your account.',
                    customer: {
                        _id: customer._id,
                        firstName: customer.firstName,
                        lastName: customer.lastName,
                        email: customer.email,
                        picture: customer.profilePicture || customer.picture,
                        token: jwt.sign({ _id: customer._id }, process.env.JWT_SECRET, {
                            expiresIn: '7d'
                        })
                    }
                });
            } else if (emailResult.useClientFallback || emailResult.skipped) {
                // Server email failed or was skipped, use client-side EmailJS
                const emailJSParams = getEmailJSParams(customer, 'welcome');
                
                res.status(201).json({
                    message: 'Account created successfully! You will be redirected to login.',
                    customer: {
                        _id: customer._id,
                        firstName: customer.firstName,
                        lastName: customer.lastName,
                        email: customer.email,
                        picture: customer.profilePicture || customer.picture,
                        token: jwt.sign({ _id: customer._id }, process.env.JWT_SECRET, {
                            expiresIn: '7d'
                        })
                    },
                    useClientEmail: true,
                    emailJSParams
                });
            }
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            res.status(201).json({
                message: 'Account created successfully! Please check your email to verify your account.',
                customer: {
                    _id: customer._id,
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    email: customer.email,
                    picture: customer.profilePicture || customer.picture,
                    token: jwt.sign({ _id: customer._id }, process.env.JWT_SECRET, {
                        expiresIn: '7d'
                    })
                }
            });
        }
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// Login route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const customer = await Customer.findOne({ email });

        if (!customer) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await customer.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!customer.isVerified) {
            return res.status(401).json({
                error: 'Account not verified',
                verificationNeeded: true,
                email: customer.email
            });
        }

        // Update last login timestamp
        customer.lastLogin = new Date();
        await customer.save();

        const token = jwt.sign({ _id: customer._id }, process.env.JWT_SECRET, {
            expiresIn: '7d'
        });

        res.json({
            message: 'Login successful',
            customer: {
                _id: customer._id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                picture: customer.profilePicture || customer.picture,
                token,
                addresses: customer.addresses,
                cart: customer.cart
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Get customer profile
router.get('/me', customerAuth, async (req, res) => {
    try {
        const customer = await Customer.findById(req.customer._id).select('-password');
        res.json({
            customer: {
                _id: customer._id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                picture: customer.profilePicture || customer.picture,
                phone: customer.phone,
                addresses: customer.addresses,
                cart: customer.cart
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update profile
router.patch('/me', customerAuth, async (req, res) => {
    try {
        const updates = req.body;
        const allowedUpdates = ['firstName', 'lastName', 'phone', 'profilePicture', 'addresses'];
        const updatesToApply = Object.keys(updates).filter(key => allowedUpdates.includes(key));

        const customer = await Customer.findByIdAndUpdate(
            req.customer._id,
            { $set: updatesToApply.reduce((acc, key) => ({ ...acc, [key]: updates[key] }), {}) },
            { new: true, runValidators: true }
        );

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({
            customer: {
                _id: customer._id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                picture: customer.profilePicture || customer.picture,
                phone: customer.phone,
                addresses: customer.addresses,
                cart: customer.cart
            }
        });
    } catch (error) {
        res.status(400).json({ error: 'Failed to update profile' });
    }
});

// Get customer addresses
router.get('/addresses', customerAuth, async (req, res) => {
    try {
        const customer = await Customer.findById(req.customer._id).select('addresses');
        res.json({ addresses: customer.addresses });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch addresses' });
    }
});

// Add new address
router.post('/addresses', customerAuth, async (req, res) => {
    try {
        const { street, city, state, zip, country, isDefault } = req.body;
        const customer = await Customer.findByIdAndUpdate(
            req.customer._id,
            { $push: { addresses: { street, city, state, zip, country, isDefault } } },
            { new: true }
        );
        res.json({ addresses: customer.addresses });
    } catch (error) {
        res.status(400).json({ error: 'Failed to add address' });
    }
});

// Update address
router.put('/addresses/:addressId', customerAuth, async (req, res) => {
    try {
        const { street, city, state, zip, country, isDefault } = req.body;
        const customer = await Customer.findOneAndUpdate(
            { _id: req.customer._id, 'addresses._id': req.params.addressId },
            { $set: { 'addresses.$': { street, city, state, zip, country, isDefault } } },
            { new: true }
        );
        res.json({ addresses: customer.addresses });
    } catch (error) {
        res.status(400).json({ error: 'Failed to update address' });
    }
});

// Delete address
router.delete('/addresses/:addressId', customerAuth, async (req, res) => {
    try {
        const customer = await Customer.findByIdAndUpdate(
            req.customer._id,
            { $pull: { addresses: { _id: req.params.addressId } } },
            { new: true }
        );
        res.json({ addresses: customer.addresses });
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete address' });
    }
});

// Logout route
router.post('/logout', customerAuth, async (req, res) => {
    try {
        // Add token to blacklist
        tokenBlacklist.add(req.token);
        res.json({ message: 'Successfully logged out' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to logout' });
    }
});

// Refresh token route
router.post('/refresh-token', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token || tokenBlacklist.has(token)) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const customer = await Customer.findById(decoded._id);
        if (!customer) {
            return res.status(401).json({ error: 'Customer not found' });
        }

        const newToken = jwt.sign({ _id: customer._id }, process.env.JWT_SECRET, {
            expiresIn: '7d'
        });

        res.json({ token: newToken });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Email verification route
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        
        if (!token) {
            return res.status(400).json({ 
                success: false,
                error: 'Verification token is required' 
            });
        }
        
        // Find customer with matching token
        const customer = await Customer.findOne({
            verificationToken: token
        });
        
        if (!customer) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid verification token' 
            });
        }
        
        // Mark as verified and clear token
        customer.isVerified = true;
        customer.verificationToken = undefined;
        await customer.save();
        
        // Return success response
        res.json({
            success: true,
            message: 'Email verified successfully'
        });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to verify email'
        });
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

        if (!customer.isActive) {
            return res.status(401).json({ error: 'Account is inactive' });
        }

        // Check if email verification is required
        if (verificationConfig.requireVerification && !customer.isVerified) {
            return res.status(403).json({ 
                error: 'Email verification required',
                needsVerification: true
            });
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
                picture: customer.picture,
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
                        <p>You are receiving this email because you (or someone else) has requested a password reset for your account.</p>
                        <p>Please click the button below to reset your password. This link will expire in 1 hour.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
                        </div>
                        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
                        <p>Thank you,<br>The N.Honest Team</p>
                    </div>
                </div>
            `
        };
        
        try {
            // Send email
            await sendEmail(mailOptions);
            res.json({ message: 'Password reset email sent' });
        } catch (emailError) {
            console.error('Error sending password reset email:', emailError);
            res.json({ message: 'Password reset request received. Please check your email.' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reset password route
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        
        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password are required' });
        }
        
        // Find customer with matching token that hasn't expired
        const customer = await Customer.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!customer) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
        
        // Update password and clear token
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
            customer: {
                _id: req.customer._id,
                firstName: req.customer.firstName,
                lastName: req.customer.lastName,
                email: req.customer.email,
                phone: req.customer.phone,
                picture: req.customer.picture,
                address: req.customer.address
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update customer profile
router.patch('/me', customerAuth, async (req, res) => {
    try {
        const updates = req.body;
        const allowedUpdates = ['firstName', 'lastName', 'phone', 'address'];
        
        // Filter out disallowed updates
        const validUpdates = Object.keys(updates)
            .filter(key => allowedUpdates.includes(key))
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
                picture: req.customer.picture,
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

// Register route
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password, phone, profilePicture } = req.body;

        // Check if customer already exists
        const existingCustomer = await Customer.findOne({ email });

        if (existingCustomer) {
            return res.status(400).json({ 
                success: false,
                error: 'Email is already in use' 
            });
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        // Send verification email
        const emailSent = await sendVerificationEmail(email, verificationToken);
        
        if (!emailSent) {
            return res.status(500).json({
                success: false,
                error: 'Failed to send verification email'
            });
        }

        // Create new customer
        const customer = new Customer({ 
            firstName, 
            lastName, 
            email, 
            password,
            phone,
            profilePicture,
            // Auto-verify based on configuration
            isVerified: verificationConfig.autoVerifyAccounts,
            // Set default email preferences
            emailPreferences: {
                welcomeEmail: true,
                loginNotifications: true,
                marketingEmails: true,
                orderConfirmations: true
            }
        });
        await customer.save();

        res.status(201).json({
            success: true,
            message: 'Account created successfully! Please check your email to verify your account.',
            customer: {
                _id: customer._id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                picture: customer.profilePicture || customer.picture,
                token: jwt.sign({ _id: customer._id }, process.env.JWT_SECRET, {
                    expiresIn: '7d'
                })
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = { router, customerAuth };
