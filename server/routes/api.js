const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Categories');

// Category Routes
router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.find()
            .populate('parent', 'name')
            .populate('products', 'name');
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
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

router.post('/categories', async (req, res) => {
    try {
        const category = new Category(req.body);
        const savedCategory = await category.save();
        res.status(201).json(savedCategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
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

        await category.remove();
        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Product Routes
router.get('/products', async (req, res) => {
    try {
        const products = await Product.find()
            .populate('category', 'name')
            .populate('subcategory', 'name');
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/products', async (req, res) => {
    try {
        const product = new Product(req.body);
        const savedProduct = await product.save();

        // Update category's products array
        if (product.category) {
            await Category.findByIdAndUpdate(
                product.category,
                { $push: { products: savedProduct._id } }
            );
        }

        res.status(201).json(savedProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
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

        await product.remove();
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 