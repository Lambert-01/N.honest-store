require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./db');
const { router: authRouter, auth } = require('./routes/auth');
const { router: customerAuthRouter, customerAuth } = require('./routes/customerAuth');
const googleAuthRoutes = require('./routes/googleAuth');
const categoriesRoutes = require('./routes/categories');
const { router: productsRouter, searchRouter: productsSearchRouter } = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const apiRoutes = require('./routes/api');
const { sendInvoiceEmail } = require('./utils/emailService');
const Product = require('./models/Product');
const { transformItemUrls } = require('./utils/urlHelper');


// Initialize Express app
const app = express();

// Email verification configuration
const emailVerificationConfig = {
    environment: process.env.NODE_ENV,
    requireVerification: true,
    autoVerifyAccounts: false,
    sendVerificationEmails: true
};

console.log('Email verification config:', emailVerificationConfig);

// Create necessary upload directories
const createUploadDirs = () => {
    try {
        // Determine base directory - use absolute path for cPanel compatibility
        const baseDir = process.env.NODE_ENV === 'production' 
            ? path.resolve(process.env.UPLOAD_PATH || 'uploads')
            : path.join(__dirname, '../uploads');
        
        console.log('Base uploads directory:', baseDir);
        
        // Main uploads dir
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
            console.log('Directory created:', baseDir);
        } else {
            console.log('Directory already exists:', baseDir);
        }
        
        // Product uploads dir
        const productUploadsDir = path.join(baseDir, 'products');
        if (!fs.existsSync(productUploadsDir)) {
            fs.mkdirSync(productUploadsDir, { recursive: true });
            console.log('Directory created:', productUploadsDir);
        } else {
            console.log('Directory already exists:', productUploadsDir);
        }
        
        // Category uploads dir
        const categoryUploadsDir = path.join(baseDir, 'categories');
        if (!fs.existsSync(categoryUploadsDir)) {
            fs.mkdirSync(categoryUploadsDir, { recursive: true });
            console.log('Directory created:', categoryUploadsDir);
        } else {
            console.log('Directory already exists:', categoryUploadsDir);
        }

        // Make sure the directories are writable
        fs.access(baseDir, fs.constants.W_OK, (err) => {
            if (err) {
                console.error('ERROR: uploads directory is not writable!', err);
            } else {
                console.log('Uploads directory is writable');
            }
        });
        
        // Verify permissions
        const testFile = path.join(baseDir, 'test.txt');
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
    origin: process.env.NODE_ENV === 'production' 
        ? [
            'https://nhonestsupermarket.com', 
            'https://www.nhonestsupermarket.com',
            'http://nhonestsupermarket.com',
            'http://www.nhonestsupermarket.com'
        ] 
        : ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:5000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With']
}));

// Log all API requests in production to help debug
app.use('/api', (req, res, next) => {
    console.log(`API Request: ${req.method} ${req.originalUrl}`);
    console.log('Request Body:', JSON.stringify(req.body));
    console.log('Request Headers:', JSON.stringify(req.headers));
    next();
});

// Add a specific logging middleware for Google auth routes
app.use('/api/customer/google', (req, res, next) => {
    console.log(`Google Auth Request: ${req.method} ${req.originalUrl}`);
    console.log('Google Auth Body:', JSON.stringify(req.body));
    next();
});

// Increase payload size limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from various directories
app.use(express.static(path.join(__dirname, '../public')));
app.use('/css', express.static(path.join(__dirname, '../css')));
app.use('/js', express.static(path.join(__dirname, '../js')));
app.use('/images', express.static(path.join(__dirname, '../images')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve admin files
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// Admin routes
app.use('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/login.html'));
});
app.use('/signup.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/signup.html'));
});
app.use('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/admin.html'));
});

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

// Redirect root to index.html in public
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

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
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Login routes
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin/login.html'));
});

app.get('/client-login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/client-login.html'));
});

app.get('/client-signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/client-signup.html'));
});

app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/reset-password.html'));
});

// Verify email route
app.get('/verify-email', (req, res) => {
    // This route will be handled by the API, just redirect to it
    res.redirect(`/api/customer/verify-email?token=${req.query.token}`);
});

// Admin routes
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin/admin.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin/signup.html'));
});

// Test email configuration
app.get('/test-email', async (req, res) => {
    try {
        const testOrder = {
            customer: {
                email: 'test@example.com',
                fullName: 'Test User'
            },
            orderNumber: 'TEST-001',
            total: 1000
        };
        
        const result = await sendInvoiceEmail(testOrder);
        res.json({ success: true, message: 'Test email sent', result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/customer', customerAuthRouter);
app.use('/api/customer/google', googleAuthRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products/search', productsSearchRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRoutes);
app.use('/api', apiRoutes);

// Public product search endpoint that doesn't require authentication
app.get('/api/products/active', async (req, res) => {
    try {
        const products = await Product.find({ status: 'active' })
            .populate('category')
            .select('-__v');
        res.json(products);
    } catch (error) {
        console.error('Error fetching active products:', error);
        res.status(500).json({ message: 'Error fetching products' });
    }
});

// Add auth middleware for protected routes
app.use('/api', (req, res, next) => {
    // Skip auth for public endpoints
    if (req.path.startsWith('/products/search') || req.path.startsWith('/categories')) {
        return next();
    }
    auth(req, res, next);
});

// Protected routes
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRoutes);
app.use('/api', apiRoutes);

// Add a route for sending invoice emails
app.post('/api/send-invoice', async (req, res) => {
    try {
        const { order } = req.body;
        if (!order) {
            return res.status(400).json({ error: 'Order data is required' });
        }

        const result = await sendInvoiceEmail(order);
        res.json({ success: true, result });
    } catch (error) {
        console.error('Error sending invoice:', error);
        res.status(500).json({ error: error.message });
    }
});

// Simple ping endpoint for connectivity checks
app.head('/api/ping', (req, res) => {
    // Add CORS headers for ping endpoint
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'HEAD, GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
});

// Add GET endpoint for ping as well to ensure compatibility
app.get('/api/ping', (req, res) => {
    // Add CORS headers for ping endpoint
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'HEAD, GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).json({ status: 'ok', message: 'Server is online' });
});

// Add timeout middleware
app.use((req, res, next) => {
    // Set timeout to 3 minutes
    req.setTimeout(180000);
    res.setTimeout(180000);
    next();
});

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            error: 'Request entity too large'
        });
    }
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, '../')));
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));
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

// Add detailed logging for order requests
app.use('/api/orders', (req, res, next) => {
    console.log(`[${new Date().toISOString()}] Order API Request:`, {
        method: req.method,
        url: req.url,
        body: req.body,
        headers: req.headers
    });
    
    // Log response
    const oldWrite = res.write;
    const oldEnd = res.end;
    
    const chunks = [];
    
    res.write = function (chunk) {
        chunks.push(chunk);
        return oldWrite.apply(res, arguments);
    };
    
    res.end = function (chunk) {
        if (chunk) chunks.push(chunk);
        
        const responseBody = Buffer.concat(chunks).toString('utf8');
        console.log(`[${new Date().toISOString()}] Order API Response:`, {
            statusCode: res.statusCode,
            body: responseBody.substring(0, 1000) // Log first 1000 chars only
        });
        
        oldEnd.apply(res, arguments);
    };
    
    next();
});

// Connect to MongoDB
const startServer = async () => {
  try {
    await connectDB();
    console.log('MongoDB Connected...');
    
    // Fix any existing categories with null slugs
    try {
      const Category = require('./models/Categories');
      console.log('Attempting to fix categories with null slugs...');
      const fixedCount = await Category.fixNullSlugs();
      console.log(`Fixed ${fixedCount} categories with null slugs`);
    } catch (slugError) {
      console.error('Error fixing category slugs:', slugError);
    }
    
    // Attempt to drop SKU index from products collection
    try {
      console.log('Attempting to drop SKU index from products collection...');
      const db = mongoose.connection.db;
      const collection = db.collection('products');
      const indexes = await collection.indexes();
      const skuIndex = indexes.find(index => index.key && index.key.sku);
      
      if (skuIndex) {
        await collection.dropIndex(skuIndex.name);
        console.log('Successfully dropped SKU index from products collection');
      } else {
        console.log('No SKU index found in products collection');
      }
    } catch (error) {
      console.error('Error dropping SKU index:', error);
    }
    
    const PORT = process.env.PORT || 3000;
    
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
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    // Don't exit in production, allow the app to start with limited functionality
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

startServer();

module.exports = app;
