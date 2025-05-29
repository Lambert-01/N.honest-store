const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// In-memory token blacklist (in production, use Redis or another persistent store)
const tokenBlacklist = new Set();

// Middleware to verify JWT token
const auth = async (req, res, next) => {
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
        const user = await User.findOne({ _id: decoded._id, isActive: true });

        if (!user) {
            throw new Error('Please authenticate');
        }

        req.token = token;
        req.user = user;
        req.tokenExp = decoded.exp;
        next();
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};

// Login route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !await user.comparePassword(password)) {
            return res.status(401).json({ error: 'Invalid login credentials' });
        }

        if (!user.isActive) {
            return res.status(401).json({ error: 'Account is inactive' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token with expiration time
        const token = jwt.sign(
            { 
                _id: user._id.toString(),
                role: user.role,
                // Add a random token identifier to help with blacklisting
                jti: Math.random().toString(36).substring(2)
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Shorter token lifetime for better security
        );

        // Get token expiry time
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const tokenExpiry = decodedToken.exp;

        res.json({
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                exp: tokenExpiry
            },
            token
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Signup route
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ 
                    error: 'Email is already in use' 
                });
            } else {
                return res.status(400).json({ 
                    error: 'Username is already taken' 
                });
            }
        }

        // Create new user with the specified role or default to staff
        const user = new User({ 
            username, 
            email, 
            password,
            role: role || 'staff'  // Default to staff if not specified
        });
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { 
                _id: user._id.toString(),
                role: user.role,
                jti: Math.random().toString(36).substring(2)
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Get token expiry time
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const tokenExpiry = decodedToken.exp;

        res.status(201).json({
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                exp: tokenExpiry
            },
            token
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
    try {
        res.json({
            _id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logout route - blacklist the token
router.post('/logout', auth, async (req, res) => {
    try {
        // Add token to blacklist
        tokenBlacklist.add(req.token);
        
        // In a production environment, you would store this in Redis
        // with an expiry time matching the token expiration
        
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Token refresh endpoint
router.post('/refresh-token', auth, async (req, res) => {
    try {
        const user = req.user;
        
        // Blacklist the old token to prevent reuse
        tokenBlacklist.add(req.token);
        
        // Generate a new token with a new JTI
        const newToken = jwt.sign(
            { 
                _id: user._id.toString(),
                role: user.role,
                jti: Math.random().toString(36).substring(2)
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Get token expiry time
        const decodedToken = jwt.verify(newToken, process.env.JWT_SECRET);
        const tokenExpiry = decodedToken.exp;
        
        res.json({
            message: 'Token refreshed successfully',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                exp: tokenExpiry
            },
            token: newToken
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Token validation endpoint
router.get('/validate-token', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ isValid: false, message: 'No token provided' });
        }

        // Check if token is blacklisted
        if (tokenBlacklist.has(token)) {
            return res.status(401).json({ isValid: false, message: 'Token has been revoked' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded._id, isActive: true });

        if (!user) {
            return res.status(401).json({ isValid: false, message: 'Invalid user' });
        }

        // Check if token is about to expire (less than 10 minutes remaining)
        const currentTime = Math.floor(Date.now() / 1000);
        const tokenExpiryTime = decoded.exp;
        const timeRemaining = tokenExpiryTime - currentTime;
        
        let shouldRefresh = timeRemaining < 600; // 10 minutes
        
        res.json({
            isValid: true,
            message: 'Token is valid',
            shouldRefresh,
            expiresIn: timeRemaining
        });
    } catch (error) {
        // If token verification fails
        return res.status(401).json({ 
            isValid: false, 
            message: 'Invalid token',
            error: error.message 
        });
    }
});

// Password change endpoint
router.post('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = req.user;
        
        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        
        // Update the password
        user.password = newPassword;
        await user.save();
        
        // Blacklist the current token to force re-login with new credentials
        tokenBlacklist.add(req.token);
        
        res.json({ message: 'Password changed successfully. Please log in again.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available user permissions (based on role)
router.get('/permissions', auth, async (req, res) => {
    try {
        const user = req.user;
        let permissions = [];
        
        // Define role-based permissions
        if (user.role === 'admin') {
            permissions = [
                'dashboard.view',
                'products.view', 'products.edit', 'products.create', 'products.delete',
                'categories.view', 'categories.edit', 'categories.create', 'categories.delete',
                'orders.view', 'orders.process', 'orders.cancel',
                'customers.view', 'customers.edit',
                'inventory.view', 'inventory.edit',
                'reports.view',
                'settings.view', 'settings.edit',
                'users.view', 'users.edit', 'users.create', 'users.delete'
            ];
        } else if (user.role === 'staff') {
            permissions = [
                'dashboard.view',
                'products.view', 'products.edit',
                'categories.view',
                'orders.view', 'orders.process',
                'customers.view',
                'inventory.view',
                'reports.view'
            ];
        }
        
        res.json({ permissions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = { router, auth };