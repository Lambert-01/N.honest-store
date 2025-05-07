const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            throw new Error('Please authenticate');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded._id, isActive: true });

        if (!user) {
            throw new Error('Please authenticate');
        }

        req.token = token;
        req.user = user;
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

        // Generate JWT token
        const token = jwt.sign(
            { _id: user._id.toString() },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
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
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (existingUser) {
            return res.status(400).json({ 
                error: 'User with this email or username already exists' 
            });
        }

        // Create new user
        const user = new User({ username, email, password });
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { _id: user._id.toString() },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
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

// Logout route
router.post('/logout', auth, async (req, res) => {
    try {
        // In a real application, you might want to blacklist the token
        // For now, we'll just send a success response
        res.json({ message: 'Logged out successfully' });
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

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded._id, isActive: true });

        if (!user) {
            return res.status(401).json({ isValid: false, message: 'Invalid user' });
        }

        // Check if token is about to expire (less than 1 hour remaining)
        const currentTime = Math.floor(Date.now() / 1000);
        const tokenExpiryTime = decoded.exp;
        const timeRemaining = tokenExpiryTime - currentTime;
        
        let refreshedToken = null;
        
        // If token expires in less than 1 hour (3600 seconds), refresh it
        if (timeRemaining < 3600) {
            refreshedToken = jwt.sign(
                { _id: user._id.toString() },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
        }

        res.json({
            isValid: true,
            message: 'Token is valid',
            refreshedToken,
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

module.exports = { router, auth }; 