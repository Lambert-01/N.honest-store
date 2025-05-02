const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const Category = require('../models/Categories');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp and original extension
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// Filter to allow only image files
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({ 
  storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB file size limit
    }
});

// Error handling middleware
const handleError = (err, req, res, next) => {
    console.error('API Error:', err);
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
        
        res.json(products);
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
        
        res.json(product);
    } catch (err) {
        next(err);
    }
});

// POST create new product
router.post('/', upload.single('featuredImage'), async (req, res, next) => {
    try {
        console.log('Creating new product with body:', req.body);
        console.log('Uploaded file:', req.file);
        
        // Validate required fields
        const { name, sku, category, price, costPrice, stock } = req.body;
        
        if (!name || !sku || !category || !price || !costPrice || !stock) {
            return res.status(400).json({ 
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // Check if SKU already exists
        const existingSku = await Product.findOne({ sku });
        if (existingSku) {
            return res.status(400).json({
                success: false,
                message: 'Product with this SKU already exists'
            });
        }
        
        // Check if category exists
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(400).json({ 
                success: false,
                message: 'Selected category does not exist'
            });
        }
        
        // Handle featured image
        let featuredImage = null;
        if (req.file) {
            // Generate full URL path for the image
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            featuredImage = `${baseUrl}/uploads/${req.file.filename}`;
            console.log('Featured image path:', featuredImage);
        }
        
        // Handle variants
        let variants = [];
        if (req.body.variants) {
            try {
                variants = JSON.parse(req.body.variants);
            } catch (err) {
                console.error('Error parsing variants:', err);
            }
        }
        
        // Create product
        const product = new Product({
            name,
            sku,
            description: req.body.description,
            category,
            price: parseFloat(price),
            costPrice: parseFloat(costPrice),
            stock: parseInt(stock),
            featuredImage,
            variants,
            status: req.body.status || 'active'
        });
        
        // Save product to database
        const savedProduct = await product.save();
        console.log('Saved product:', savedProduct);
        
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            product: savedProduct
        });
    } catch (err) {
        console.error('Error creating product:', err);
        next(err);
    }
});

// PUT update product
router.put('/:id', upload.single('featuredImage'), async (req, res, next) => {
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
        
        // Handle featured image
        let featuredImage = product.featuredImage;
        if (req.file) {
            // Generate URL path for the new image
            featuredImage = `/uploads/${req.file.filename}`;
            
            // Delete old image if it exists
            if (product.featuredImage) {
                const oldImagePath = path.join(__dirname, '../../', product.featuredImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }

        // Handle variants
        let variants = product.variants;
        if (req.body.variants) {
            try {
                variants = JSON.parse(req.body.variants);
            } catch (err) {
                console.error('Error parsing variants:', err);
            }
        }
        
        // Update product fields
        product.name = req.body.name || product.name;
        product.sku = req.body.sku || product.sku;
        product.description = req.body.description || product.description;
        product.category = req.body.category || product.category;
        product.price = req.body.price ? parseFloat(req.body.price) : product.price;
        product.costPrice = req.body.costPrice ? parseFloat(req.body.costPrice) : product.costPrice;
        product.stock = req.body.stock ? parseInt(req.body.stock) : product.stock;
        product.featuredImage = featuredImage;
        product.variants = variants;
        product.status = req.body.status || product.status;
        product.updatedAt = Date.now();
        
        // Save updated product
        await product.save();

    res.json({
            success: true,
      message: 'Product updated successfully',
            product
        });
    } catch (err) {
        next(err);
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
        
        // Delete product image if it exists
        if (product.featuredImage) {
            const imagePath = path.join(__dirname, '../../', product.featuredImage);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
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
        
        res.json(products);
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
        
        res.json(products);
    } catch (err) {
        next(err);
    }
});

// Register error handling middleware
router.use(handleError);

module.exports = router;