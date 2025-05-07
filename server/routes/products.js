const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const Category = require('../models/Categories');

// Get base URL from environment or default to localhost:5000
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Create uploads directory if it doesn't exist
const createUploadsDirectory = () => {
    // Create parent uploads directory if it doesn't exist
    const parentDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
        console.log(`Parent uploads directory created: ${parentDir}`);
    }
    
    // Create products uploads directory
    const uploadsDir = path.join(parentDir, 'products');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log(`Products uploads directory created: ${uploadsDir}`);
    }
    
    console.log(`Uploads directory path: ${uploadsDir}`);
    return uploadsDir;
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/products');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            console.log(`Created upload directory: ${uploadDir}`);
        }
        console.log(`Using upload directory for ${file.originalname}: ${uploadDir}`);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp and original extension
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        console.log(`Generated filename for ${file.originalname}: ${uniqueName}`);
        cb(null, uniqueName);
    }
});

// Filter to allow only image files
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    console.log(`Checking file: ${file.originalname}, mimetype: ${file.mimetype}`);
    
    if (extname && mimetype) {
        console.log(`Accepted file: ${file.originalname}`);
        return cb(null, true);
    } else {
        console.log(`Rejected file: ${file.originalname}`);
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Configure multer upload
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit
    }
});

// Log the upload configuration
console.log('Multer configuration:', {
    storageDest: 'Function (dynamic)',
    storageFilename: 'Function (dynamic)',
    fileFilterSet: !!fileFilter,
    fileSizeLimit: '2MB'
});

// Create a wrapped version of the middleware to add logging
const uploadMiddleware = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB (increased from 2MB to be safer)
        fieldSize: 10 * 1024 * 1024 // 10MB field size limit to handle larger forms
    }
});

// Error handling middleware
const handleError = (err, req, res, next) => {
    console.error('API Error:', err);
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: `Upload error: ${err.message}`
        });
    }
    res.status(500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
};

// GET all products
router.get('/', async (req, res, next) => {
    try {
        const products = await Product.find()
            .populate('category', 'name')
            .sort({ createdAt: -1 });
        
        // Transform products to add full URLs to images
        const transformedProducts = products.map(product => {
            const productObj = product.toObject();
            
            if (productObj.featuredImage && !productObj.featuredImage.startsWith('http')) {
                productObj.featuredImage = `${BASE_URL}${productObj.featuredImage}`;
            }
            
            if (productObj.images && productObj.images.length > 0) {
                productObj.images = productObj.images.map(img => 
                    img.startsWith('http') ? img : `${BASE_URL}${img}`
                );
            }
            
            return productObj;
        });
        
        res.json(transformedProducts);
    } catch (err) {
        next(err);
    }
});

// GET single product by ID
router.get('/:id', async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('category', 'name');
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        // Transform product to add full URLs to images
        const productObj = product.toObject();
        
        if (productObj.featuredImage && !productObj.featuredImage.startsWith('http')) {
            productObj.featuredImage = `${BASE_URL}${productObj.featuredImage}`;
        }
        
        if (productObj.images && productObj.images.length > 0) {
            productObj.images = productObj.images.map(img => 
                img.startsWith('http') ? img : `${BASE_URL}${img}`
            );
        }
        
        res.json(productObj);
    } catch (err) {
        next(err);
    }
});

// POST create new product
router.post('/', (req, res) => {
    console.log('=== PRODUCT CREATION REQUEST RECEIVED ===');
    console.log('Content-Type:', req.headers['content-type']);
    
    // Use single file upload for featuredImage
    upload.single('featuredImage')(req, res, async (err) => {
        if (err) {
            console.error('Multer error:', err);
            return res.status(400).json({
                success: false,
                message: err.message || 'File upload error'
            });
        }
        
        try {
            console.log('=== FILE UPLOAD SUCCESSFUL ===');
            console.log('Uploaded file:', req.file);
            console.log('Form data:', req.body);
            
            // Extract and validate form data
            const { name, sku, category, price, costPrice, stock, description, status } = req.body;
            
            if (!name || !sku || !category || !price || !costPrice) {
                console.error('Missing required fields:', { name, sku, category, price, costPrice });
                return res.status(400).json({
                    success: false,
                    message: 'Required fields are missing'
                });
            }
            
            // Create new product object
            const product = new Product({
                name,
                sku,
                description: description || '',
                category,
                price: parseFloat(price),
                costPrice: parseFloat(costPrice),
                stock: parseInt(stock || 0),
                status: status || 'active'
            });
            
            // Handle variants if present
            if (req.body.variants) {
                try {
                    product.variants = JSON.parse(req.body.variants);
                } catch (e) {
                    console.error('Error parsing variants:', e);
                }
            }
            
            // Process uploaded image if present
            if (req.file) {
                console.log('Processing image:', req.file.filename);
                    
                // Store relative path in database
                const imagePath = `/uploads/products/${req.file.filename}`;
                product.featuredImage = imagePath;
                
                console.log('Image path saved to product:', imagePath);
            }
            
            // Save product to database
            console.log('Saving product to database:', product);
            const savedProduct = await product.save();
            console.log('Product saved successfully:', savedProduct._id);
            
            // Add full URLs to response
            const productResponse = savedProduct.toObject();
            
            if (productResponse.featuredImage) {
                productResponse.featuredImage = `${BASE_URL}${productResponse.featuredImage}`;
            }
            
            res.status(201).json({
                success: true,
                message: 'Product created successfully',
                product: productResponse
            });
            
        } catch (error) {
            console.error('Error creating product:', error);
            
            // Clean up the uploaded file if there was an error
            if (req.file) {
                try {
                    fs.unlinkSync(req.file.path);
                    console.log('Deleted file after error:', req.file.path);
                } catch (e) {
                    console.error('Error deleting file:', e);
                }
            }
            
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to create product'
            });
        }
    });
});

// PUT update product
router.put('/:id', (req, res, next) => {
    upload(req, res, async (err) => {
        if (err) {
            return handleError(err, req, res, next);
        }

        try {
            const productId = req.params.id;
            
            // Find the product
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Product not found'
                });
            }
            
            // Check if SKU is being changed and if new SKU already exists
            if (req.body.sku && req.body.sku !== product.sku) {
                const existingSku = await Product.findOne({ 
                    sku: req.body.sku,
                    _id: { $ne: productId }
                });
                
                if (existingSku) {
                    return res.status(400).json({ 
                        success: false,
                        message: 'Product with this SKU already exists'
                    });
                }
            }
            
            // Handle images
            let featuredImage = product.featuredImage;
            let images = product.images;
            
            if (req.files) {
                if (req.files.featuredImage && req.files.featuredImage.length > 0) {
                    // Delete old featured image
                    if (product.featuredImage) {
                        const oldImagePath = path.join(__dirname, '../..', product.featuredImage);
                        if (fs.existsSync(oldImagePath)) {
                            try {
                                fs.unlinkSync(oldImagePath);
                            } catch (error) {
                                console.error('Error deleting old featured image:', error);
                            }
                        }
                    }
                    featuredImage = `/uploads/products/${req.files.featuredImage[0].filename}`;
                }
                
                if (req.files.images && req.files.images.length > 0) {
                    // Delete old additional images
                    product.images.forEach(image => {
                        const oldImagePath = path.join(__dirname, '../..', image);
                        if (fs.existsSync(oldImagePath)) {
                            try {
                                fs.unlinkSync(oldImagePath);
                            } catch (error) {
                                console.error('Error deleting old image:', error);
                            }
                        }
                    });
                    images = req.files.images.map(file => `/uploads/products/${file.filename}`);
                }
            }

            // Handle variants
            let productVariants = product.variants || [];
            if (req.body.variants) {
                try {
                    // Parse variants if it's a string
                    const parsedVariants = typeof req.body.variants === 'string' 
                        ? JSON.parse(req.body.variants) 
                        : req.body.variants;
                    
                    // If variants is an array, make sure each variant has the required fields
                    if (Array.isArray(parsedVariants)) {
                        productVariants = parsedVariants.map(variant => ({
                            type: variant.type,
                            value: variant.value,
                            sku: variant.sku
                        }));
                    }
                } catch (err) {
                    console.error('Error parsing variants during update:', err);
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid variants format'
                    });
                }
            }
            
            // Update product fields
            product.name = req.body.name || product.name;
            product.sku = req.body.sku || product.sku;
            product.description = req.body.description !== undefined ? req.body.description : product.description;
            product.category = req.body.category || product.category;
            product.price = req.body.price ? parseFloat(req.body.price) : product.price;
            product.costPrice = req.body.costPrice ? parseFloat(req.body.costPrice) : product.costPrice;
            product.stock = req.body.stock !== undefined ? parseInt(req.body.stock) : product.stock;
            product.featuredImage = featuredImage;
            product.images = images;
            product.variants = productVariants;
            product.status = req.body.status || product.status;
            product.updatedAt = Date.now();
            
            // Save updated product
            const updatedProduct = await product.save();

            // Transform product to add full URLs to images for the response
            const productObj = updatedProduct.toObject();
            
            if (productObj.featuredImage) {
                productObj.featuredImage = `${BASE_URL}${productObj.featuredImage}`;
            }
            
            if (productObj.images && productObj.images.length > 0) {
                productObj.images = productObj.images.map(img => `${BASE_URL}${img}`);
            }

            res.json({
                success: true,
                message: 'Product updated successfully',
                product: productObj
            });
        } catch (error) {
            // Clean up uploaded files if there was an error
            if (req.files) {
                Object.values(req.files).flat().forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                    } catch (unlinkError) {
                        console.error('Error deleting file:', unlinkError);
                    }
                });
            }
            next(error);
        }
    });
});

// DELETE product
router.delete('/:id', async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({ 
                success: false,
                message: 'Product not found'
            });
        }
        
        // Delete product images
        if (product.featuredImage) {
            const imagePath = path.join(__dirname, '../..', product.featuredImage);
            if (fs.existsSync(imagePath)) {
                try {
                    fs.unlinkSync(imagePath);
                } catch (error) {
                    console.error('Error deleting featured image:', error);
                }
            }
        }
        
        if (product.images && product.images.length > 0) {
            product.images.forEach(image => {
                const imagePath = path.join(__dirname, '../..', image);
                if (fs.existsSync(imagePath)) {
                    try {
                        fs.unlinkSync(imagePath);
                    } catch (error) {
                        console.error('Error deleting image:', error);
                    }
                }
            });
        }
        
        // Delete product from database
        await Product.findByIdAndDelete(req.params.id);
    
        res.json({ 
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (err) {
        next(err);
    }
});

// Search products
router.get('/search/:term', async (req, res, next) => {
    try {
        const searchTerm = req.params.term;
        
        const products = await Product.find({
            $or: [
                { name: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
                { sku: { $regex: searchTerm, $options: 'i' } }
            ]
        }).populate('category', 'name');
        
        // Transform products to add full URLs to images
        const transformedProducts = products.map(product => {
            const productObj = product.toObject();
            
            if (productObj.featuredImage && !productObj.featuredImage.startsWith('http')) {
                productObj.featuredImage = `${BASE_URL}${productObj.featuredImage}`;
            }
            
            if (productObj.images && productObj.images.length > 0) {
                productObj.images = productObj.images.map(img => 
                    img.startsWith('http') ? img : `${BASE_URL}${img}`
                );
            }
            
            return productObj;
        });
        
        res.json(transformedProducts);
    } catch (err) {
        next(err);
    }
});

// Filter products by category
router.get('/category/:categoryId', async (req, res, next) => {
    try {
        const categoryId = req.params.categoryId;
        
        const products = await Product.find({ category: categoryId })
            .populate('category', 'name');
        
        // Transform products to add full URLs to images
        const transformedProducts = products.map(product => {
            const productObj = product.toObject();
            
            if (productObj.featuredImage && !productObj.featuredImage.startsWith('http')) {
                productObj.featuredImage = `${BASE_URL}${productObj.featuredImage}`;
            }
            
            if (productObj.images && productObj.images.length > 0) {
                productObj.images = productObj.images.map(img => 
                    img.startsWith('http') ? img : `${BASE_URL}${img}`
                );
            }
            
            return productObj;
        });
        
        res.json(transformedProducts);
    } catch (err) {
        next(err);
    }
});

// Register error handling middleware
router.use(handleError);

module.exports = router;