const express = require('express');
const multer = require('multer');
const Product = require('../models/Product');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Add a new product
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, price, oldPrice, discount, description, category } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const product = new Product({
      name,
      price,
      oldPrice,
      discount,
      description,
      category,
      image: imagePath,
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().lean();
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Get products by category
router.get('/:category', async (req, res) => {
  try {
    const category = req.params.category;
    const products = await Product.find({ category }).lean();
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Delete a product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndDelete(id);
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Update a product
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, oldPrice, discount, description, category } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const product = await Product.findByIdAndUpdate(
      id,
      {
        name,
        price,
        oldPrice,
        discount,
        description,
        category,
        image: imagePath || req.body.image,
      },
      { new: true }
    );

    res.status(200).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

module.exports = router;