require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./db');
const { router: authRouter, auth } = require('./routes/auth');
const categoriesRoutes = require('./routes/categories');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const apiRoutes = require('./routes/api');

// Initialize Express app
const app = express();

// Create necessary upload directories
const createUploadDirs = () => {
    try {
        // Main uploads dir
        const uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
            console.log('Directory created:', uploadsDir);
        } else {
            console.log('Directory already exists:', uploadsDir);
        }
        
        // Product uploads dir
        const productUploadsDir = path.join(__dirname, '../uploads/products');
        if (!fs.existsSync(productUploadsDir)) {
            fs.mkdirSync(productUploadsDir);
            console.log('Directory created:', productUploadsDir);
        } else {
            console.log('Directory already exists:', productUploadsDir);
        }
        
        // Category uploads dir
        const categoryUploadsDir = path.join(__dirname, '../uploads/categories');
        if (!fs.existsSync(categoryUploadsDir)) {
            fs.mkdirSync(categoryUploadsDir);
            console.log('Directory created:', categoryUploadsDir);
        } else {
            console.log('Directory already exists:', categoryUploadsDir);
        }

        // Make sure the directories are writable
        fs.access(uploadsDir, fs.constants.W_OK, (err) => {
            if (err) {
                console.error('ERROR: uploads directory is not writable!', err);
            } else {
                console.log('uploads directory is writable');
            }
        });
        
        // Verify permissions
        const testFile = path.join(__dirname, '../uploads/test.txt');
        try {
            fs.writeFileSync(testFile, 'test write permission');
            fs.unlinkSync(testFile);
            console.log('Write permissions verified for uploads directory');
        } catch (error) {
            console.error('ERROR: Cannot write to uploads directory!', error);
            console.error('Images uploads will fail - please check folder permissions');
        }
        
        console.log('All upload directories created and verified successfully');
    } catch (error) {
        console.error('Error creating upload directories:', error);
        // Don't throw - just log the error. The server should still try to start.
    }
};

// Create upload directories on startup
createUploadDirs();

// Configure CORS properly
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Custom request logger middleware (replacing morgan)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
});

// Body parsers with reasonable limits
app.use(express.json({ limit: process.env.REQUEST_LIMIT || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_LIMIT || '10mb' }));

// Simplified static file serving for uploads
const uploadsDir = process.env.UPLOAD_PATH || 'uploads';
const uploadsPath = path.join(__dirname, '..', uploadsDir);

// Removed duplicate declaration of createUploadDirs

// Serve static files from uploads with proper headers
app.use(`/${uploadsDir}`, (req, res, next) => {
    // Set appropriate CORS headers for images
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache
    
    // Set content type based on file extension
    const ext = path.extname(req.path).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : `image/${ext.substring(1)}`;
        res.setHeader('Content-Type', contentType);
    }
    
    next();
}, express.static(uploadsPath));

// Serve static files from root directory
app.use(express.static(path.join(__dirname, '../')));

// HTML routes - simplified
const htmlRoutes = ['/', '/login', '/signup', '/admin'];
htmlRoutes.forEach(route => {
    app.get(route, (req, res) => {
        const page = route === '/' ? 'index.html' : `${route.substring(1)}.html`;
        res.sendFile(path.join(__dirname, '..', page));
    });
});

// API Routes - organized by resource
app.use('/api/auth', authRouter);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api', apiRoutes);

// Health check endpoints
app.head('/api/ping', (req, res) => res.status(200).end());
app.get('/api/ping', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        message: 'Server is online',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// Improved error handling middleware
app.use((err, req, res, next) => {
    console.error('API Error:', err);
    
    // Handle specific error types
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ 
            success: false,
            message: 'Invalid token or no token provided'
        });
    }
    
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
        const errors = {};
        for (let field in err.errors) {
            errors[field] = err.errors[field].message;
        }
        
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors
        });
    }
    
    // Handle file size limit errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: `File too large, maximum size is ${process.env.MAX_FILE_SIZE || '5MB'}`
        });
    }
    
    // Generic error response
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});

// Set proper content types for static assets
const contentTypes = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
};

Object.entries(contentTypes).forEach(([ext, type]) => {
    app.get(`*${ext}`, (req, res, next) => {
        res.set('Content-Type', type);
        next();
    });
});

// Final fallback for API routes and unknown paths
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ 
            success: false,
            message: 'API endpoint not found' 
        });
    }
    res.status(404).send('Page not found');
});

// DB Connection & Server Start
connectDB().then(() => {
    const PORT = process.env.PORT || 5000;
    
    // Create placeholder image if it doesn't exist
    const placeholderPath = path.join(__dirname, '../images/placeholder.png');
    if (!fs.existsSync(placeholderPath)) {
        try {
            const placeholderDir = path.dirname(placeholderPath);
            if (!fs.existsSync(placeholderDir)) {
                fs.mkdirSync(placeholderDir, { recursive: true });
            }
            
            // Simple transparent GIF
            const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
            fs.writeFileSync(placeholderPath, transparentGif);
            console.log('Placeholder image created successfully');
        } catch (err) {
            console.error('Error creating placeholder image:', err);
        }
    }
    
    app.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`API URL: http://localhost:${PORT}/api`);
    });
}).catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1);
});

module.exports = app;
