const express = require('express');
const router = express.Router();
const searchRouter = express.Router(); // Create a separate router for search
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Product = require('../models/Product');
const Category = require('../models/Categories');
const { getBaseUrl, ensureAbsoluteUrl, transformItemUrls } = require('../utils/urlHelper');
const { uploadProductImage, handleMulterError, useCloudinary } = require('../utils/multer');

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
const storage = useCloudinary ? null : {
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
};

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

// Configure multer upload with better options for JSON handling
const upload = useCloudinary ? uploadProductImage : multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB 
        fieldSize: 10 * 1024 * 1024 // 10MB field size to handle larger forms with JSON data
    }
}).single('featuredImage'); // Use single instead of the middleware directly

// Log the upload configuration
console.log('Multer configuration:', {
    storageDest: 'Function (dynamic)',
    storageFilename: 'Function (dynamic)',
    fileFilterSet: !!fileFilter,
    fileSizeLimit: '5MB'
});

// Create a wrapped version of the middleware to add logging
const uploadMiddleware = useCloudinary ? uploadProductImage : multer({
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
        
        // Transform products to add full URLs to images using our helper
        const transformedProducts = products.map(product => transformItemUrls(product));
        
        res.json(transformedProducts);
    } catch (err) {
        next(err);
    }
});

// Filter products by category - IMPORTANT: This route must be defined BEFORE the GET by ID route
router.get('/category/:categoryId', async (req, res, next) => {
    try {
        console.log(`GET /products/category/${req.params.categoryId} - Filtering products by category`);
        const categoryId = req.params.categoryId;
        
        if (!categoryId || categoryId.trim() === '') {
            console.error('Invalid category ID provided:', categoryId);
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid category ID' 
            });
        }
        
        console.log(`Looking for products with category ID: ${categoryId}`);
        
        // First, check if the category exists
        const categoryExists = await Category.findById(categoryId);
        if (!categoryExists) {
            console.error(`Category with ID ${categoryId} not found in database`);
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        
        console.log(`Found category: ${categoryExists.name}`);
        
        // Find products with this category
        const products = await Product.find({ 
            category: categoryId,
            status: 'active'
        }).populate('category', 'name');
        
        console.log(`Found ${products.length} products in category "${categoryExists.name}" (${categoryId})`);
        
        if (products.length === 0) {
            console.log(`No products found in category ${categoryId}`);
        } else {
            console.log(`First product in category: ${products[0].name}`);
        }
        
        // Transform products to add full URLs to images using our helper
        const transformedProducts = products.map(product => transformItemUrls(product));
        
        res.json(transformedProducts);
    } catch (err) {
        console.error('Error filtering products by category:', err);
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
        
        // Transform product to add full URLs to images using our helper
        const transformedProduct = transformItemUrls(product);
        
        res.json(transformedProduct);
    } catch (err) {
        next(err);
    }
});

// POST create new product
router.post('/', uploadProductImage.single('featuredImage'), async (req, res) => {
    try {
        console.log('=== PRODUCT CREATION REQUEST RECEIVED ===');
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Uploaded file:', req.file);
        console.log('Form data:', req.body);
        
        // Extract and validate form data
        const { name, category, price, status } = req.body;
        
        if (!name || !category || !price) {
            console.error('Missing required fields:', { name, category, price });
            return res.status(400).json({
                success: false,
                message: 'Required fields are missing'
            });
        }
        
        // Create new product object
        const product = new Product({
            name,
            category,
            price: parseFloat(price),
            status: status || 'active'
        });
        
        // Handle variants if present
        if (req.body.variants) {
            try {
                let parsedVariants;
                if (Array.isArray(req.body.variants)) {
                    parsedVariants = req.body.variants;
                } else {
                    parsedVariants = JSON.parse(req.body.variants);
                }
                
                if (Array.isArray(parsedVariants)) {
                    product.variants = parsedVariants.map(variant => ({
                        name: variant.name,
                        combination: variant.combination || [],
                        price: parseFloat(variant.price) || product.price
                    }));
                }
            } catch (e) {
                console.error('Error parsing variants:', e);
            }
        }
        
        // Process uploaded image if present
        if (req.file) {
            console.log('Processing image:', req.file);
            
            if (useCloudinary) {
                product.featuredImage = req.file.secure_url || req.file.path;
                console.log('Cloudinary image URL saved:', product.featuredImage);
                
                if (product.featuredImage && !product.images.includes(product.featuredImage)) {
                    product.images.push(product.featuredImage);
                }
            } else {
                const imagePath = `/uploads/products/${req.file.filename}`;
                product.featuredImage = imagePath;
                console.log('Local image path saved:', imagePath);
                
                if (!product.images.includes(imagePath)) {
                    product.images.push(imagePath);
                }
            }
        }
        
        // Save product to database
        const savedProduct = await product.save();
        
        // Update the category's product count
        try {
            await Category.updateProductCount(product.category);
        } catch (countError) {
            console.error('Error updating category product count:', countError);
        }
        
        // Return response with transformed URLs
        const productResponse = transformItemUrls(savedProduct);
        
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            product: productResponse
        });
        
    } catch (error) {
        console.error('Error creating product:', error);
        
        if (req.file && !useCloudinary) {
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

// PUT update product
router.put('/:id', uploadProductImage.single('featuredImage'), async (req, res, next) => {
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
        
        // Handle image
        let featuredImage = product.featuredImage;
        
        if (req.file) {
            if (useCloudinary) {
                featuredImage = req.file.secure_url || req.file.path;
                console.log('Updated with Cloudinary image:', featuredImage);
                
                if (featuredImage && !product.images.includes(featuredImage)) {
                    product.images.push(featuredImage);
                }
            } else {
                if (product.featuredImage) {
                    const oldImagePath = path.join(__dirname, '../..', product.featuredImage);
                    if (fs.existsSync(oldImagePath)) {
                        try {
                            fs.unlinkSync(oldImagePath);
                            console.log('Deleted old image:', oldImagePath);
                        } catch (e) {
                            console.error('Error deleting old image:', e);
                        }
                    }
                }
                
                const imagePath = `/uploads/products/${req.file.filename}`;
                featuredImage = imagePath;
                console.log('Updated with local image:', imagePath);
                
                if (!product.images.includes(imagePath)) {
                    product.images.push(imagePath);
                }
            }
        }

        // Handle variants
        let productVariants = product.variants || [];
        if (req.body.variants) {
            try {
                let parsedVariants;
                
                if (Array.isArray(req.body.variants)) {
                    parsedVariants = req.body.variants;
                } else {
                    parsedVariants = JSON.parse(req.body.variants);
                }
                
                if (Array.isArray(parsedVariants)) {
                    productVariants = parsedVariants.map(variant => ({
                        name: variant.name,
                        combination: variant.combination || [],
                        price: parseFloat(variant.price) || product.price
                    }));
                } else {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid variants format - expected array'
                    });
                }
            } catch (e) {
                return res.status(400).json({
                    success: false,
                    message: 'Error parsing variants: ' + e.message
                });
            }
        }
        
        // Store the old category ID for product count update
        const oldCategoryId = product.category;
        let categoryChanged = false;
        
        // Update product fields
        product.name = req.body.name || product.name;
        
        // Check if category is changing
        if (req.body.category && req.body.category !== oldCategoryId.toString()) {
            categoryChanged = true;
            product.category = req.body.category;
        }
        
        product.price = req.body.price ? parseFloat(req.body.price) : product.price;
        product.featuredImage = featuredImage;
        product.variants = productVariants;
        product.status = req.body.status || product.status;
        product.updatedAt = Date.now();
        
        // Save updated product
        const updatedProduct = await product.save();
        
        // Update category product counts if the category was changed
        if (categoryChanged) {
            try {
                await Category.updateProductCount(oldCategoryId);
                await Category.updateProductCount(product.category);
            } catch (countError) {
                console.error('Error updating category product counts:', countError);
            }
        }

        // Transform URLs to absolute URLs
        const transformedProduct = transformItemUrls(updatedProduct);

        res.json({
            success: true,
            message: 'Product updated successfully',
            product: transformedProduct
        });
    } catch (error) {
        console.error('Error updating product:', error);
        
        if (req.file && !useCloudinary) {
            try {
                fs.unlinkSync(req.file.path);
                console.log('Deleted file after error:', req.file.path);
            } catch (e) {
                console.error('Error deleting file:', e);
            }
        }
        
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update product'
        });
    }
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
        
        // Store category ID before deleting the product
        const categoryId = product.category;
        
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
        
        // Update category product count
        try {
            await Category.updateProductCount(categoryId);
            console.log(`Updated product count for category ${categoryId} after product deletion`);
        } catch (countError) {
            console.error('Error updating category product count after deletion:', countError);
            // Don't fail the request if count update fails
        }
    
        res.json({ 
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (err) {
        next(err);
    }
});

// Search products endpoint
searchRouter.get('/', async (req, res) => {
    try {
        const searchTerm = req.query.search;
        console.log('=== PRODUCT SEARCH START ===');
        console.log('Search term:', searchTerm);

        if (!searchTerm) {
            console.log('No search term provided');
            return res.status(400).json({
                success: false,
                message: 'Search term is required'
            });
        }

        // Create a case-insensitive search regex
        const searchRegex = new RegExp(searchTerm, 'i');
        console.log('Search regex:', searchRegex);

        // First find categories that match the search term
        console.log('Searching categories...');
        let categoryIds = [];
        try {
            const matchingCategories = await Category.find({
                name: searchRegex
            });
            console.log('Matching categories:', matchingCategories.map(c => c.name));
            categoryIds = matchingCategories.map(cat => cat._id);
        } catch (categoryError) {
            console.error('Error searching categories:', categoryError);
            // Continue with product search even if category search fails
        }
        console.log('Category IDs:', categoryIds);

        // Build the search query
        const searchQuery = {
            $or: [
                { name: searchRegex }
            ],
            status: 'active'
        };

        // Only add category filter if we found matching categories
        if (categoryIds.length > 0) {
            searchQuery.$or.push({ category: { $in: categoryIds } });
        }

        console.log('Final search query:', JSON.stringify(searchQuery, null, 2));

        // Search in name and matching category IDs
        const products = await Product.find(searchQuery)
            .populate('category', 'name')
            .select('-__v');

        console.log(`Found ${products.length} products matching "${searchTerm}"`);
        if (products.length > 0) {
            console.log('First matching product:', {
                name: products[0].name,
                category: products[0].category?.name
            });
        }
        
        // Transform products to add full URLs
        const transformedProducts = products.map(product => transformItemUrls(product));
        
        console.log('=== PRODUCT SEARCH COMPLETE ===');
        res.json({
            success: true,
            products: transformedProducts,
            total: transformedProducts.length
        });

    } catch (error) {
        console.error('=== PRODUCT SEARCH ERROR ===');
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error searching products',
            error: error.message
        });
    }
});

// Register error handling middleware
router.use(handleError);

module.exports = { router, searchRouter };
