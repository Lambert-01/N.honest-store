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
        req.tokenExp = decoded.exp;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ 
            success: false,
            error: 'Authentication failed',
            message: error.message 
        });
    }
};

module.exports = { auth }; 