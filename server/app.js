require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const connectDB = require('./db');
const categoriesRoutes = require('./routes/categories');

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// === STATIC FILE HANDLING WITH CARE ===
// Do NOT use express.static for the entire root folder
// Instead, we manually serve index.html and admin.html
// And let other assets be handled later for clarity

// Main site route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Admin panel route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin.html'));
});

// Optional: All API routes go before static asset fallback
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', categoriesRoutes);
app.use('/api/orders', require('./routes/orders'));

// Optional: Fallback for static assets (CSS, JS, images, icons.svg)
app.use((req, res, next) => {
    const filePath = path.join(__dirname, '../', req.path);
    // Only serve known static files explicitly
    if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.svg') || req.path.endsWith('.png')) {
        return res.sendFile(filePath, { headers: { 'Cache-Control': 'no-cache' } });
    }
    next();
});

// Final fallback: Don't send index.html for unknown paths
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'API route not found' });
    }

    // Prevent serving index.html unless explicitly requested through '/'
    res.status(404).send('Page not found');
});

// DB Connection & Server Start
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});