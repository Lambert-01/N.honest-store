const express = require('express');
const router = express.Router();
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
        const { name, category, price, costPrice, stock, description, status } = req.body;
        
        if (!name || !category || !price || !costPrice) {
            console.error('Missing required fields:', { name, category, price, costPrice });
            return res.status(400).json({
                success: false,
                message: 'Required fields are missing'
            });
        }
        
        // Create new product object
        const product = new Product({
            name,
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
                console.log('Processing variants from form submission');
                console.log('Variants data type:', typeof req.body.variants);
                
                let parsedVariants;
                
                // Handle case where variants is already an object (parsed JSON)
                if (typeof req.body.variants === 'object' && !Array.isArray(req.body.variants)) {
                    console.log('Variants is already an object, using directly');
                    parsedVariants = req.body.variants;
                }
                // Handle case where variants is an array of strings (form posts data differently)
                else if (Array.isArray(req.body.variants)) {
                    console.log('Variants is an array with', req.body.variants.length, 'items');
                    
                    // If it's a single item array with a valid JSON string, use that
                    if (req.body.variants.length === 1) {
                        try {
                            parsedVariants = JSON.parse(req.body.variants[0]);
                            console.log('Parsed variants from single array item');
                        } catch (e) {
                            console.log('Single item is not valid JSON:', e.message);
                        }
                    }
                    
                    // If we still don't have valid variants, try each array item
                    if (!parsedVariants) {
                        // Find the first item that's a valid JSON array
                        for (const item of req.body.variants) {
                            try {
                                if (typeof item === 'string') {
                                    const parsed = JSON.parse(item);
                                    if (Array.isArray(parsed)) {
                                        parsedVariants = parsed;
                                        console.log('Found valid variants JSON in array item');
                                        break;
                                    }
                                }
                            } catch (err) {
                                console.log('Not valid JSON:', typeof item === 'string' ? item.substring(0, 50) : typeof item);
                                // Continue to next item
                            }
                        }
                    }
                    
                    // If we still couldn't find valid JSON, try the last item
                    if (!parsedVariants && req.body.variants.length > 0) {
                        try {
                            const lastItem = req.body.variants[req.body.variants.length - 1];
                            if (typeof lastItem === 'string') {
                                parsedVariants = JSON.parse(lastItem);
                                console.log('Parsed variants from last array item');
                            }
                        } catch (err) {
                            console.error('Could not parse last item either:', err);
                        }
                    }
                } 
                // Handle case where variants is a string (needs to be parsed)
                else if (typeof req.body.variants === 'string') {
                    try {
                        parsedVariants = JSON.parse(req.body.variants);
                        console.log('Parsed variants from string');
                    } catch (e) {
                        console.error('Error parsing variants JSON string:', e);
                    }
                }
                
                // Log what we found
                if (parsedVariants) {
                    console.log(`Parsed variants: ${Array.isArray(parsedVariants) ? 
                        'Array with ' + parsedVariants.length + ' items' : 
                        'Object of type ' + typeof parsedVariants}`);
                    console.log('First variant (if available):', 
                        Array.isArray(parsedVariants) && parsedVariants.length > 0 ? 
                        JSON.stringify(parsedVariants[0]) : 'None');
                } else {
                    console.log('Failed to parse any variants data');
                }
                
                // Validate variants structure
                if (Array.isArray(parsedVariants)) {
                    product.variants = parsedVariants.map(variant => ({
                        name: variant.name || (variant.type ? `${variant.type}: ${variant.value}` : 'Unnamed Variant'),
                        combination: variant.combination || 
                            (variant.type && variant.value ? [{ attribute: variant.type, value: variant.value }] : []),
                        sku: variant.sku || null,
                        price: parseFloat(variant.price) || product.price, // Default to product price
                        stock: parseInt(variant.stock, 10) || 0
                    }));
                    
                    console.log(`Added ${product.variants.length} variants to product`);
                    if (product.variants.length > 0) {
                        console.log('First variant example:', JSON.stringify(product.variants[0]));
                    }
                } else {
                    console.error('Invalid variants format - expected array');
                }
            } catch (e) {
                console.error('Error parsing variants:', e);
                console.log('Raw variants data:', typeof req.body.variants === 'string' ? 
                    req.body.variants.substring(0, 200) : 
                    JSON.stringify(req.body.variants).substring(0, 200));
            }
        } else {
            console.log('No variants data found in form submission');
        }
        
        // Process uploaded image if present
        if (req.file) {
            console.log('Processing image:', req.file);
            
            if (useCloudinary) {
                // For Cloudinary, use the secure URL provided by Cloudinary
                // Check if secure_url exists, otherwise use path (which is where Cloudinary puts the URL)
                product.featuredImage = req.file.secure_url || req.file.path;
                console.log('Cloudinary image URL saved:', product.featuredImage);
                
                // Also add to images array for consistency
                if (product.featuredImage && !product.images.includes(product.featuredImage)) {
                    product.images.push(product.featuredImage);
                    console.log('Added featured image to images array');
                }
            } else {
                // For local storage, use the relative path
                const imagePath = `/uploads/products/${req.file.filename}`;
                product.featuredImage = imagePath;
                console.log('Local image path saved:', imagePath);
                
                // Also add to images array for consistency
                if (!product.images.includes(imagePath)) {
                    product.images.push(imagePath);
                    console.log('Added featured image to images array');
                }
            }
        }
        
        // Save product to database
        console.log('Saving product to database. Has variants:', product.variants && product.variants.length);
        const savedProduct = await product.save();
        console.log('Product saved successfully:', savedProduct._id);
        console.log('Saved product has variants:', savedProduct.variants.length);
        
        // Update the category's product count
        try {
            await Category.updateProductCount(product.category);
            console.log(`Updated product count for category ${product.category}`);
        } catch (countError) {
            console.error('Error updating category product count:', countError);
            // Don't fail the request if count update fails
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
        
        // Clean up the uploaded file if there was an error and we're using local storage
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
                // For Cloudinary, use the secure URL provided by Cloudinary
                // Check if secure_url exists, otherwise use path (which is where Cloudinary puts the URL)
                featuredImage = req.file.secure_url || req.file.path;
                console.log('Updated with Cloudinary image:', featuredImage);
                
                // Also add to images array for consistency
                if (featuredImage && !product.images.includes(featuredImage)) {
                    product.images.push(featuredImage);
                    console.log('Added featured image to images array');
                }
            } else {
                // For local storage, delete old image and use new path
                if (product.featuredImage && !product.featuredImage.includes('cloudinary')) {
                    const oldImagePath = path.join(__dirname, '../..', product.featuredImage);
                    if (fs.existsSync(oldImagePath)) {
                        try {
                            fs.unlinkSync(oldImagePath);
                        } catch (error) {
                            console.error('Error deleting old featured image:', error);
                        }
                    }
                }
                featuredImage = `/uploads/products/${req.file.filename}`;
                
                // Also add to images array for consistency
                if (!product.images.includes(featuredImage)) {
                    product.images.push(featuredImage);
                    console.log('Added featured image to images array');
                }
            }
        }

        // Handle variants
        let productVariants = product.variants || [];
        if (req.body.variants) {
            try {
                // Check if variants is an array of strings (form posts data differently)
                let parsedVariants;
                if (Array.isArray(req.body.variants)) {
                    // If it's already an array, find the valid JSON string
                    console.log('Variants is an array with', req.body.variants.length, 'items');
                    
                    // Find the first item that's a valid JSON array
                    for (const item of req.body.variants) {
                        try {
                            const parsed = JSON.parse(item);
                            if (Array.isArray(parsed)) {
                                parsedVariants = parsed;
                                console.log('Found valid variants JSON in array item');
                                break;
                            }
                        } catch (err) {
                            console.log('Not valid JSON:', item.substring(0, 50));
                            // Continue to next item
                        }
                    }
                    
                    // If we couldn't find valid JSON, try the last item as it's likely the one we want
                    if (!parsedVariants && req.body.variants.length > 0) {
                        try {
                            const lastItem = req.body.variants[req.body.variants.length - 1];
                            parsedVariants = JSON.parse(lastItem);
                            console.log('Parsed variants from last array item');
                        } catch (err) {
                            console.error('Could not parse last item either:', err);
                        }
                    }
                } else {
                    // It's a string, parse normally
                    parsedVariants = JSON.parse(req.body.variants);
                    console.log('Parsed variants from string');
                }
                
                // Validate variants structure
                if (Array.isArray(parsedVariants)) {
                    productVariants = parsedVariants.map(variant => ({
                        name: variant.name,
                        combination: variant.combination || [],
                        sku: variant.sku || null,
                        price: parseFloat(variant.price) || product.price, // Default to product price
                        stock: parseInt(variant.stock, 10) || 0
                    }));
                    
                    console.log(`Added ${productVariants.length} variants to product`);
                } else {
                    console.error('Invalid variants format - expected array');
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid variants format - expected array'
                    });
                }
            } catch (e) {
                console.error('Error parsing variants:', e);
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
        product.description = req.body.description !== undefined ? req.body.description : product.description;
        
        // Check if category is changing
        if (req.body.category && req.body.category !== oldCategoryId.toString()) {
            categoryChanged = true;
            product.category = req.body.category;
        }
        
        product.price = req.body.price ? parseFloat(req.body.price) : product.price;
        product.costPrice = req.body.costPrice ? parseFloat(req.body.costPrice) : product.costPrice;
        product.stock = req.body.stock !== undefined ? parseInt(req.body.stock) : product.stock;
        product.featuredImage = featuredImage;
        product.variants = productVariants;
        product.status = req.body.status || product.status;
        product.updatedAt = Date.now();
        
        // Save updated product
        const updatedProduct = await product.save();
        
        // Update category product counts if the category was changed
        if (categoryChanged) {
            try {
                // Update old category count (decrement)
                await Category.updateProductCount(oldCategoryId);
                console.log(`Updated product count for old category ${oldCategoryId}`);
                
                // Update new category count (increment)
                await Category.updateProductCount(product.category);
                console.log(`Updated product count for new category ${product.category}`);
            } catch (countError) {
                console.error('Error updating category product counts:', countError);
                // Don't fail the request if count update fails
            }
        } else if (product.status !== req.body.status && req.body.status) {
            // If status changed, this might affect the product count
            try {
                await Category.updateProductCount(product.category);
                console.log(`Updated product count for category ${product.category} after status change`);
            } catch (countError) {
                console.error('Error updating category product count after status change:', countError);
            }
        }

        // Transform product to add full URLs to images for the response
        const transformedProduct = transformItemUrls(updatedProduct);

        res.json({
            success: true,
            message: 'Product updated successfully',
            product: transformedProduct
        });
    } catch (error) {
        console.error('Error updating product:', error);
        
        // Clean up the uploaded file if there was an error and we're using local storage
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
        
        // Transform products to add full URLs to images using our helper
        const transformedProducts = products.map(product => transformItemUrls(product));
        
        res.json(transformedProducts);
    } catch (err) {
        next(err);
    }
});

// Register error handling middleware
router.use(handleError);

module.exports = router;
