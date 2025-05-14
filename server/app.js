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

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 'https://n-honest.onrender.com' : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure Express to serve static files from uploads folder with proper debug info
app.use('/uploads', (req, res, next) => {
  console.log(`Accessing uploads file: ${req.path}`);
  // Check if file exists to help debug issues
  const fullPath = path.join(__dirname, '..', 'uploads', req.path);
  if (fs.existsSync(fullPath)) {
    console.log(`File exists on disk: ${fullPath}`);
    // For image files, set the correct content type
    if (req.path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      const ext = path.extname(req.path).toLowerCase().substring(1);
      const contentType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      res.setHeader('Content-Type', contentType);
      console.log(`Set content-type for image: ${contentType}`);
    }
  } else {
    console.log(`File NOT found on disk: ${fullPath}`);
    // If file doesn't exist, check if the folder exists
    console.log(`Looking in these locations:`);
    console.log(`1. ${fullPath}`);
    // Check in uploads/products folder directly
    const productPath = path.join(__dirname, '..', 'uploads', 'products', path.basename(req.path));
    console.log(`2. ${productPath}`);
    if (fs.existsSync(productPath)) {
      console.log(`File found at alternative location: ${productPath}`);
      return res.sendFile(productPath);
    }
  }
  // Add CORS headers specifically for images
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Add cache control
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
  next();
}, express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, filePath) => {
    console.log(`Serving static file: ${filePath}`);
  }
}));

// Configure Express to serve static files from the root directory
app.use(express.static(path.join(__dirname, '../')));

// For specific product images
app.use('/uploads/products', express.static(path.join(__dirname, '../uploads/products'), {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.png') || filePath.endsWith('.gif') || filePath.endsWith('.webp')) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
            const ext = path.extname(filePath).slice(1);
            const contentType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
            res.setHeader('Content-Type', contentType);
            console.log(`Serving product image: ${filePath} as ${contentType}`);
        }
    }
}));

// For category images
app.use('/uploads/categories', express.static(path.join(__dirname, '../uploads/categories'), {
    maxAge: '1d'
}));

// Handle any URLs with /uploads/ pattern to check if file exists locally
app.use('/uploads/*', (req, res, next) => {
    const requestedPath = req.path;
    const localPath = path.join(__dirname, '..', requestedPath);
    
    console.log(`Upload request for: ${requestedPath}`);
    console.log(`Looking for file at: ${localPath}`);
    
    // Check if file exists locally
    if (fs.existsSync(localPath)) {
        console.log(`File found, serving: ${localPath}`);
        
        // Set appropriate content type based on file extension
        const ext = path.extname(localPath).toLowerCase();
        if (ext === '.jpg' || ext === '.jpeg') {
            res.setHeader('Content-Type', 'image/jpeg');
        } else if (ext === '.png') {
            res.setHeader('Content-Type', 'image/png');
        } else if (ext === '.gif') {
            res.setHeader('Content-Type', 'image/gif');
        } else if (ext === '.webp') {
            res.setHeader('Content-Type', 'image/webp');
        }
        
        // Add cache headers
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        
        return res.sendFile(localPath);
    }
    
    // If file doesn't exist locally, log and pass to next middleware
    console.log(`File not found locally: ${localPath}`);
    next();
});

// === STATIC FILE HANDLING WITH CARE ===
// Main site route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Login route
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../login.html'));
});

// Signup route
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../signup.html'));
});

// Admin panel route (protected)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin.html'));
});

// API Routes - Order matters! Put specific routes before general ones
app.use('/api/auth', authRouter);

// Protected API routes - require authentication - These should come BEFORE the general API route
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);

// Register general API router - This should come AFTER specific routes
app.use('/api', apiRoutes);

// Simple ping endpoint for connectivity checks
app.head('/api/ping', (req, res) => {
    res.status(200).end();
});

// Add GET endpoint for ping as well to ensure compatibility
app.get('/api/ping', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is online' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('API Error:', err);
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
        
        console.log('Validation error details:', errors);
        
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors
        });
    }
    
    // Handle file size limit errors from multer
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: 'File too large, maximum size is 5MB'
        });
    }
    
    res.status(500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, '../')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve static assets explicitly to ensure they have proper content types
app.get('*.js', (req, res, next) => {
    res.set('Content-Type', 'application/javascript');
    next();
});

app.get('*.css', (req, res, next) => {
    res.set('Content-Type', 'text/css');
    next();
});

app.get('*.png', (req, res, next) => {
    res.set('Content-Type', 'image/png');
    next();
});

app.get('*.jpg', (req, res, next) => {
    res.set('Content-Type', 'image/jpeg');
    next();
});

app.get('*.svg', (req, res, next) => {
    res.set('Content-Type', 'image/svg+xml');
    next();
});

// Optional: Fallback for static assets (CSS, JS, images, icons.svg)
app.use((req, res, next) => {
    const filePath = path.join(__dirname, '../', req.path);
    // Only serve known static files explicitly
    if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.svg') || 
        req.path.endsWith('.png') || req.path.endsWith('.jpg') || req.path.endsWith('.jpeg')) {
        return res.sendFile(filePath, { headers: { 'Cache-Control': 'no-cache' } });
    }
    next();
});

// Final fallback: Don't send index.html for unknown paths
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'API route not found' });
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
            console.log('Creating placeholder image for product images');
            // Generate a simple placeholder image - transparent 1x1 PNG
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
        console.log(`✅ Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1);
});

module.exports = app;
