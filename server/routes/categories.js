const express = require('express');
const router = express.Router();
const Category = require('../models/Categories');
const path = require('path');
const fs = require('fs');
const { auth } = require('./auth'); // Import the auth middleware
const { ensureAbsoluteUrl, transformItemUrls } = require('../utils/urlHelper');
const { uploadCategoryImage, handleMulterError, useCloudinary } = require('../utils/multer');

// Get base URL from environment or default to localhost:5000
const BASE_URL = ''; // Just use relative path

// Configure multer for file uploads
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         const uploadDir = path.join(__dirname, '../../uploads/categories');
//         if (!fs.existsSync(uploadDir)) {
//             fs.mkdirSync(uploadDir, { recursive: true });
//             console.log(`Created upload directory: ${uploadDir}`);
//         }
//         console.log(`Using upload directory: ${uploadDir}`);
//         cb(null, uploadDir);
//     },
//     filename: (req, file, cb) => {
//         const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
//         console.log(`Generated filename for category image: ${uniqueName}`);
//         cb(null, uniqueName);
//     }
// });

// const fileFilter = (req, file, cb) => {
//     const allowedTypes = /jpeg|jpg|png|gif|webp/;
//     const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = allowedTypes.test(file.mimetype);
    
//     console.log(`Validating file: ${file.originalname}, mimetype: ${file.mimetype}`);
    
//     if (extname && mimetype) {
//         console.log(`File accepted: ${file.originalname}`);
//         return cb(null, true);
//     } else {
//         console.log(`File rejected: ${file.originalname}, invalid type`);
//         cb(new Error('Only image files are allowed!'), false);
//     }
// };

// const upload = multer({
//     storage: storage,
//     fileFilter: fileFilter,
//     limits: {
//         fileSize: 2 * 1024 * 1024 // 2MB
//     }
// });

// GET all categories
router.get('/', async (req, res, next) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });
        
        // Add full URLs to images using our helper function
        const categoriesWithFullUrls = categories.map(category => transformItemUrls(category));
        
        res.json(categoriesWithFullUrls);
    } catch (err) {
        next(err);
    }
});

// Check if category exists
router.get('/check', async (req, res, next) => {
    try {
        const { name } = req.query;
        const category = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        res.json({ exists: !!category });
    } catch (err) {
        next(err);
    }
});

// GET single category
router.get('/:id', async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        
        // Transform URLs using our helper function
        const transformedCategory = transformItemUrls(category);
        
        res.json(transformedCategory);
    } catch (err) {
        next(err);
    }
});

// POST create new category
router.post('/', uploadCategoryImage.single('image'), async (req, res) => {
    try {
        console.log('\n=== CATEGORY CREATION START ===');
        console.log('Request headers:', req.headers);
        console.log('Content type:', req.headers['content-type']);
        console.log('Request body:', req.body);
        console.log('File details:', req.file ? {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path
        } : 'No file uploaded');

        // Check if we have the required fields
        const name = req.body.name;
        const description = req.body.description || '';
        const status = req.body.status || 'active';
        
        console.log('Extracted data:', { name, description, status });
        
        if (!name || name.trim() === '') {
            console.log('Error: Missing category name');
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }
        
        // Check if category exists
        const existingCategory = await Category.findOne({
            name: new RegExp(`^${name.trim()}$`, 'i')
        });
        
        if (existingCategory) {
            console.log('Error: Category already exists');
            return res.status(400).json({
                success: false,
                message: 'A category with this name already exists'
            });
        }
        
        // Prepare image path if file was uploaded
        let imagePath = null;
        if (req.file) {
            if (useCloudinary) {
                // For Cloudinary, the path is in req.file.path for local uploads, but in req.file.secure_url for Cloudinary
                imagePath = req.file.secure_url || req.file.path;
                console.log('Cloudinary image URL:', imagePath);
            } else {
                // For local storage, use the relative path
                imagePath = `/uploads/categories/${req.file.filename}`;
                console.log('Local image path:', imagePath);
                
                // Verify the file was actually saved
                const fullPath = path.join(__dirname, '../../uploads/categories', req.file.filename);
                const fileExists = fs.existsSync(fullPath);
                console.log(`Checking if file exists at ${fullPath}: ${fileExists}`);
                
                if (!fileExists) {
                    console.error('Warning: File was processed but not found on disk');
                }
            }
        }
        
        try {
            // Create and save the category
            const category = new Category({
                name: name.trim(),
                description: description.trim(),
                status,
                image: imagePath,
                // Always set a slug explicitly to avoid null slugs
                slug: `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-6)}`
            });
            
            console.log('Saving category with data:', {
                name: category.name,
                description: category.description,
                status: category.status,
                image: category.image,
                slug: category.slug
            });
            
            const savedCategory = await category.save();
            console.log('Category saved successfully with ID:', savedCategory._id);
            
            // Return success response with transformed image URL
            const transformedCategory = transformItemUrls(savedCategory);
            
            res.status(201).json({
                success: true,
                message: 'Category created successfully',
                category: transformedCategory
            });
        } catch (saveError) {
            console.error('Error saving category:', saveError);
            
            // Check for duplicate key error and handle it gracefully
            if (saveError.code === 11000) {
                // If this is a duplicate slug error, let's try again with a more unique slug
                if (saveError.message.includes('slug')) {
                    // Create a completely unique category with timestamp
                    const uniqueCategory = new Category({
                        name: name.trim(),
                        description: description.trim(),
                        status,
                        image: imagePath,
                        // Force a unique slug with timestamp
                        slug: `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`
                    });
                    
                    console.log('Retrying with forced unique slug:', uniqueCategory.slug);
                    
                    // Try saving again
                    const savedCategory = await uniqueCategory.save();
                    
                    // Return success response with transformed image URL
                    const transformedCategory = transformItemUrls(savedCategory);
                    
                    return res.status(201).json({
                        success: true,
                        message: 'Category created successfully',
                        category: transformedCategory
                    });
                }
                
                // For other duplicate key errors
                return res.status(400).json({
                    success: false,
                    message: 'A category with this information already exists'
                });
            }
            
            // Re-throw to be caught by the outer catch
            throw saveError;
        }
        
    } catch (error) {
        console.error('=== CATEGORY CREATION ERROR ===');
        console.error(error);
        
        // Clean up any uploaded file if there was an error and we're using local storage
        if (req.file && !useCloudinary) {
            try {
                const filePath = path.join(__dirname, '../../uploads/categories', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log('Deleted uploaded file after error:', filePath);
                }
            } catch (err) {
                console.error('Error deleting file:', err);
            }
        }
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error: ' + error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// PUT update category
router.put('/:id', uploadCategoryImage.single('image'), async (req, res, next) => {
    try {
        const categoryId = req.params.id;
        const { name, description, status } = req.body;
        
        // Find the category
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        
        // Check if new name already exists (excluding current category)
        if (name && name !== category.name) {
            const existingCategory = await Category.findOne({
                name: { $regex: new RegExp(`^${name}$`, 'i') },
                _id: { $ne: categoryId }
            });
            
            if (existingCategory) {
                return res.status(400).json({
                    success: false,
                    message: 'Category name already exists'
                });
            }
        }
        
        // Handle image
        let image = category.image;
        if (req.file) {
            if (useCloudinary) {
                // For Cloudinary, use the secure URL
                image = req.file.secure_url;
                console.log('Updated with Cloudinary image:', image);
            } else {
                // For local storage, delete old image and use new path
                if (category.image) {
                    const oldImagePath = path.join(__dirname, '../..', category.image);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                }
                image = `/uploads/categories/${req.file.filename}`;
            }
        }
        
        // Update category
        category.name = name || category.name;
        category.description = description || category.description;
        category.image = image;
        category.status = status || category.status;
        category.updatedAt = Date.now();
        
        // Save updated category
        const updatedCategory = await category.save();
        
        // Transform URLs using our helper function
        const transformedCategory = transformItemUrls(updatedCategory);
        
        res.json({
            success: true,
            message: 'Category updated successfully',
            category: transformedCategory
        });
    } catch (error) {
        // Clean up uploaded file if there was an error and we're using local storage
        if (req.file && !useCloudinary) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                console.error('Error deleting file:', e);
            }
        }
        next(error);
    }
});

// DELETE category
router.delete('/:id', async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);
        
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        
        // Delete category image if exists locally
        if (category.image && !useCloudinary && !category.image.includes('cloudinary')) {
            const imagePath = path.join(__dirname, '../..', category.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        await Category.findByIdAndDelete(req.params.id);
        
        res.json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (err) {
        next(err);
    }
});

// Get category tree
router.get('/tree', async (req, res) => {
    try {
        const categories = await Category.find({ status: 'active' });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching category tree:', error);
        res.status(500).json({ message: `Server error: ${error.message}` });
    }
});

// Search categories
router.get('/search/:query', async (req, res) => {
    try {
        const searchQuery = req.params.query;
        const categories = await Category.find({
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ]
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Recalculate all category product counts
router.post('/recalculate-counts', async (req, res, next) => {
    try {
        console.log('Recalculating all category product counts...');
        await Category.recalculateAllCounts();
        res.json({
            success: true,
            message: 'Product counts recalculated for all categories'
        });
    } catch (err) {
        console.error('Error recalculating category product counts:', err);
        next(err);
    }
});

module.exports = router;
