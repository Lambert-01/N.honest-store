const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Categories');
const path = require('path');
const fs = require('fs');
const { ensureAbsoluteUrl, transformItemUrls, BASE_URL } = require('../utils/urlHelper');
const { uploadProductImage, uploadCategoryImage, useCloudinary } = require('../utils/multer');

// Configure Multer for file uploads
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         const uploadDir = path.join(__dirname, '../../uploads/products');
//         if (!fs.existsSync(uploadDir)) {
//             fs.mkdirSync(uploadDir, { recursive: true });
//             console.log(`Created upload directory: ${uploadDir}`);
//         }
//         console.log(`Using upload directory for ${file.originalname}: ${uploadDir}`);
//         cb(null, uploadDir);
//     },
//     filename: (req, file, cb) => {
//         // Generate unique filename with timestamp and original extension
//         const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
//         console.log(`Generated filename for ${file.originalname}: ${uniqueName}`);
//         cb(null, uniqueName);
//     }
// });

// Filter to allow only image files
// const fileFilter = (req, file, cb) => {
//     const allowedTypes = /jpeg|jpg|png|gif|webp/;
//     const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = allowedTypes.test(file.mimetype);
    
//     console.log(`Checking file: ${file.originalname}, mimetype: ${file.mimetype}`);
    
//     if (extname && mimetype) {
//         console.log(`Accepted file: ${file.originalname}`);
//         return cb(null, true);
//     } else {
//         console.log(`Rejected file: ${file.originalname}`);
//         cb(new Error('Only image files are allowed!'), false);
//     }
// };

// Configure multer upload
// const upload = multer({
//     storage: storage,
//     fileFilter: fileFilter,
//     limits: {
//         fileSize: 2 * 1024 * 1024 // 2MB limit
//     }
// });

// Category Routes
router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.find({ status: 'active' });
        // Transform all URLs to absolute URLs
        const transformedCategories = categories.map(category => transformItemUrls(category));
        res.json(transformedCategories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/categories/main', async (req, res) => {
    try {
        const mainCategories = await Category.find({ level: 1 });
        res.json(mainCategories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Check if category name exists
router.get('/categories/check', async (req, res) => {
    try {
        const { name } = req.query;
        
        if (!name) {
            return res.status(400).json({ message: 'Name parameter is required' });
        }
        
        const category = await Category.findOne({ name: name });
        res.json({ exists: !!category });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Categories JSON API endpoint (for when images aren't being uploaded)
router.post('/categories', async (req, res) => {
    try {
        console.log('=== WARNING: USING FALLBACK CATEGORY ROUTE IN API.JS ===');
        console.log('This route is being used instead of the dedicated /api/categories route.');
        console.log('For image uploads, use the dedicated /api/categories endpoint instead.');
        console.log('API categories JSON post request body:', req.body);
        
        // Check if we're dealing with JSON or form data
        const contentType = req.headers['content-type'] || '';
        console.log('Content-Type:', contentType);
        
        // THIS IS A FALLBACK ROUTE - The dedicated /api/categories route should be used,
        // especially for image uploads. This route is kept for backward compatibility.
        
        // Validate required fields
        if (!req.body.name || req.body.name.trim() === '') {
            return res.status(400).json({ 
                success: false,
                message: 'Category name is required - please provide a name for the category',
            });
        }
        
        // Check if category with same name already exists
        const existingCategory = await Category.findOne({ 
            name: { $regex: new RegExp(`^${req.body.name.trim()}$`, 'i') } 
        });
        
        if (existingCategory) {
            return res.status(400).json({ 
                success: false,
                message: 'Category with this name already exists',
            });
        }
        
        // Create the category
        const category = new Category({
            name: req.body.name.trim(),
            description: req.body.description ? req.body.description.trim() : '',
            status: req.body.status || 'active',
            // No image for JSON requests
        });
        
        console.log('Creating category with data:', {
            name: category.name,
            description: category.description,
            status: category.status
        });
        
        const savedCategory = await category.save();
        console.log('Category saved with ID:', savedCategory._id);
        
        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            category: savedCategory
        });
    } catch (error) {
        console.error('Error creating category:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                success: false,
                message: error.message,
            });
        }
        
        res.status(500).json({ 
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Check if category has products
        if (category.products && category.products.length > 0) {
            return res.status(400).json({ message: 'Cannot delete category with products' });
        }

        await Category.findByIdAndDelete(category._id);
        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Product Routes
router.get('/products', async (req, res) => {
    try {
        const products = await Product.find({ status: 'active' }).populate('category');
        // Transform all URLs to absolute URLs
        const transformedProducts = products.map(product => transformItemUrls(product));
        res.json(transformedProducts);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get products by category - This must be defined BEFORE the product ID route
router.get('/products/category/:categoryId', async (req, res) => {
    try {
        console.log(`GET /api/products/category/${req.params.categoryId} - Fetching products by category`);
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
        }).populate('category');
        
        console.log(`Found ${products.length} products in category "${categoryExists.name}" (${categoryId})`);
        
        if (products.length === 0) {
            console.log(`No products found in category ${categoryId}`);
            // Still return empty array rather than error
        } else {
            console.log(`First product in category: ${products[0].name}`);
        }
        
        // Transform all URLs to absolute URLs
        const transformedProducts = products.map(product => transformItemUrls(product));
        res.json(transformedProducts);
    } catch (error) {
        console.error('Error fetching products by category:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get product by ID - This must be defined AFTER more specific routes
router.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('category');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        } 
        // Transform URLs to absolute URLs
        const transformedProduct = transformItemUrls(product);
        res.json(transformedProduct);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Check if product name exists
router.get('/products/check-name', async (req, res) => {
    try {
        const { name } = req.query;
        
        if (!name) {
            return res.status(400).json({ message: 'Name parameter is required' });
        }
        
        const product = await Product.findOne({ name: name });
        res.json({ exists: !!product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/products', uploadProductImage.single('featuredImage'), async (req, res) => {
    try {
        console.log('=== PRODUCT CREATION START ===');
        console.log('Request headers:', req.headers);
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        
        // Log detailed information about each field
        console.log('Form data details:');
        for (const key in req.body) {
            console.log(`${key}: ${req.body[key]} (${typeof req.body[key]})`);
        }
        
        // Validate required fields
        const requiredFields = ['name', 'price', 'category'];
        const missingFields = {};
        
        requiredFields.forEach(field => {
            if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === '')) {
                missingFields[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
                console.log(`Missing required field: ${field}`);
            }
        });
        
        if (Object.keys(missingFields).length > 0) {
            console.log('Validation failed - missing fields:', missingFields);
            return res.status(400).json({
                message: `Product validation failed: ${Object.keys(missingFields).join(', ')}`,
                errors: missingFields
            });
        }
        
        // Create product object with explicit type conversion
        const product = new Product({
            name: String(req.body.name),
            category: req.body.category,
            price: parseFloat(req.body.price),
            status: req.body.status || 'active'
        });
        
        console.log('Created product object:', {
            name: product.name,
            category: product.category,
            price: product.price,
        });
        
        // Handle variants if present
        if (req.body.variants) {
            try {
                console.log('Processing variants from form submission');
                console.log('Variants data type:', typeof req.body.variants);
                console.log('Variants raw value:', req.body.variants);
                
                let parsedVariants;
                
                // Handle case where variants is already an object (parsed JSON)
                if (typeof req.body.variants === 'object' && !Array.isArray(req.body.variants)) {
                    console.log('Variants is already an object, using directly');
                    parsedVariants = req.body.variants;
                }
                // Handle case where variants is an array of strings (form posts data differently)
                else if (Array.isArray(req.body.variants)) {
                    console.log('Variants is an array with', req.body.variants.length, 'items');
                    // Try to join and parse if it contains multiple JSON fragments
                    try {
                        const joinedString = req.body.variants.join('');
                        parsedVariants = JSON.parse(joinedString);
                        console.log('Successfully parsed joined array of variants');
                    } catch (e) {
                        console.error('Error parsing joined variants array:', e);
                        // Try to parse each item individually
                        parsedVariants = req.body.variants.map(item => {
                            try {
                                return typeof item === 'string' ? JSON.parse(item) : item;
                            } catch (e) {
                                console.error('Error parsing variant item:', e);
                                return null;
                            }
                        }).filter(item => item !== null);
                        
                        if (parsedVariants.length === 0) {
                            throw new Error('Could not parse any variant items');
                        }
                    }
                }
                // Handle case where variants is a string (most common)
                else if (typeof req.body.variants === 'string') {
                    console.log('Variants is a string, attempting to parse');
                    try {
                        parsedVariants = JSON.parse(req.body.variants);
                        console.log('Successfully parsed variants string to:', Array.isArray(parsedVariants) ? 'array' : typeof parsedVariants);
                    } catch (e) {
                        console.error('Failed to parse variants JSON string:', e);
                        throw e;
                    }
                }
                
                // Validate the variants structure
                if (parsedVariants) {
                    if (Array.isArray(parsedVariants)) {
                        console.log('Parsed variants is an array with', parsedVariants.length, 'items');
                        
                        product.variants = parsedVariants.map(variant => {
                            const mappedVariant = {
                                name: variant.name || '',
                                combination: variant.combination || [],
                                price: parseFloat(variant.price) || product.price,
                                stock: parseInt(variant.stock, 10) || 0
                            };
                            console.log('Mapped variant:', mappedVariant);
                            return mappedVariant;
                        });
                        
                        console.log('Final variants array has', product.variants.length, 'items');
                    } else {
                        console.error('Invalid variants format - expected array but got:', typeof parsedVariants);
                        throw new Error('Invalid variants format - expected array');
                    }
                } else {
                    console.error('Failed to parse variants data');
                    throw new Error('Failed to parse variants data');
                }
            } catch (e) {
                console.error('Error processing variants:', e);
                console.error('Original variants value:', req.body.variants);
            }
        } else {
            console.log('No variants data provided in request');
            product.variants = [];
        }
        
        // Handle uploaded image if present
        if (req.file) {
            if (useCloudinary) {
                // For Cloudinary, use the secure URL provided by Cloudinary
                product.featuredImage = req.file.secure_url;
                console.log('Cloudinary image URL saved:', product.featuredImage);
            } else {
                // For local storage, use the relative path
                const imagePath = `/uploads/products/${req.file.filename}`;
                product.featuredImage = imagePath;
                console.log('Local image path saved:', imagePath);
            }
        }
        
        // Save product to database
        console.log('Saving product to database...');
        const savedProduct = await product.save();
        console.log('Product saved successfully with ID:', savedProduct._id);
        
        // Transform to add full URLs to images
        const productObj = transformItemUrls(savedProduct);
        
        console.log('=== PRODUCT CREATION COMPLETE ===');
        return res.status(201).json({
            success: true,
            message: 'Product created successfully',
            product: productObj
        });
    } catch (error) {
        console.error('=== PRODUCT CREATION ERROR ===');
        console.error(error);
        
        // Clean up uploaded file if there was an error and we're using local storage
        if (req.file && !useCloudinary) {
            try {
                const filePath = path.join(__dirname, '../..', `/uploads/products/${req.file.filename}`);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log('Deleted file after error:', filePath);
                }
            } catch (e) {
                console.error('Error deleting file:', e);
            }
        }
        
        // Detailed error response
        if (error.name === 'ValidationError') {
            const errors = {};
            for (const field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            console.log('Mongoose validation errors:', errors);
            return res.status(400).json({ 
                message: 'Validation failed: ' + error.message,
                errors
            });
        }
        
        return res.status(500).json({ 
            message: 'Server error: ' + error.message
        });
    }
});

router.delete('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Remove product from category's products array
        if (product.category) {
            await Category.findByIdAndUpdate(
                product.category,
                { $pull: { products: product._id } }
            );
        }

        await Product.findByIdAndDelete(product._id);
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 
