const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const multer = require('multer');
const path = require('path');

// Set up multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images/products');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Get all products (with optional category filter)
router.get('/', async (req, res) => {
  try {
    const { category } = req.query; // Optional query parameter for filtering by category

    let query = {};
    if (category) {
      query.category = category; // Filter products by category
    }

    const products = await Product.find(query);
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err.message);
    res.status(500).json({ message: 'Server error while fetching products' });
  }
});

// Add a new product
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, price, description, category } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ message: 'Name, price, and category are required' });
    }

    const product = new Product({
      name,
      price,
      description,
      category,
      image: req.file ? `/images/products/${req.file.filename}` : '' // Save image path
    });

    const newProduct = await product.save();
    res.status(201).json(newProduct);
  } catch (err) {
    console.error('Error adding product:', err.message);
    res.status(400).json({ message: 'Failed to add product', error: err.message });
  }
});

// Get a single product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err.message);
    res.status(500).json({ message: 'Server error while fetching product' });
  }
});

// Update a product by ID
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, price, description, category } = req.body;

    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Update fields
    product.name = name || product.name;
    product.price = price || product.price;
    product.description = description || product.description;
    product.category = category || product.category;

    // Update image if a new one is uploaded
    if (req.file) {
      product.image = `/images/products/${req.file.filename}`;
    }

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (err) {
    console.error('Error updating product:', err.message);
    res.status(400).json({ message: 'Failed to update product', error: err.message });
  }
});

// Delete a product by ID
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndRemove(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err.message);
    res.status(500).json({ message: 'Server error while deleting product' });
  }
});

module.exports = router;