const express = require('express');
const router = express.Router();
const Category = require('../models/Categories');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for category image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(__dirname, '../../uploads/categories');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `category-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const isValidType = allowedTypes.test(file.mimetype) && 
                          allowedTypes.test(path.extname(file.originalname).toLowerCase());
        
        if (isValidType) return cb(null, true);
        cb(new Error('Only image files are allowed!'));
    }
});

// Check if category name exists
router.get('/check', async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) {
            return res.status(400).json({ message: 'Category name is required' });
        }
        
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        });
        
        res.json({ exists: Boolean(existingCategory) });
    } catch (error) {
        console.error('Error checking category:', error);
        res.status(500).json({ message: `Server error: ${error.message}` });
    }
});

// Get all categories
router.get('/', async (req, res) => {
    try {
        const categories = await Category.find();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
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

// Get a single category
router.get('/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (category) {
            res.json(category);
        } else {
            res.status(404).json({ message: 'Category not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a new category with image upload
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const categoryData = {
            name: req.body.name,
            description: req.body.description,
            status: req.body.status,
            slug: req.body.slug || req.body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '')
        };

        // Add image path if an image was uploaded
        if (req.file) {
            categoryData.image = `/uploads/categories/${req.file.filename}`;
        }

        const category = new Category(categoryData);
        const newCategory = await category.save();
        res.status(201).json(newCategory);
    } catch (error) {
        // If there was an error and an image was uploaded, remove it
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(400).json({ message: error.message });
    }
});

// Update a category with image upload
router.put('/:id', upload.single('image'), async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            // If an image was uploaded but category doesn't exist, remove it
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({ message: 'Category not found' });
        }

        // Update category properties if provided
        if (req.body.name) category.name = req.body.name;
        if (req.body.description !== undefined) category.description = req.body.description;
        if (req.body.status) category.status = req.body.status;
        if (req.body.slug) category.slug = req.body.slug;

        // If new image is uploaded, delete the old one (if exists) and update the path
        if (req.file) {
            if (category.image && category.image.startsWith('/uploads/')) {
                const oldImagePath = path.join(__dirname, '../../', category.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            category.image = `/uploads/categories/${req.file.filename}`;
        }

        const updatedCategory = await category.save();
        res.json(updatedCategory);
    } catch (error) {
        // If there was an error and a new image was uploaded, remove it
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(400).json({ message: error.message });
    }
});

// Delete a category
router.delete('/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Delete associated image if exists
        if (category.image && category.image.startsWith('/uploads/')) {
            const imagePath = path.join(__dirname, '../../', category.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await Category.deleteOne({ _id: req.params.id });
        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
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

module.exports = router;