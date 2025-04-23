const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

// Configure multer for file uploads with proper file naming
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Configure multer
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Add a new product
router.post('/', upload.single('image'), async (req, res) => {
  try {
    console.log('POST /api/products - Request body:', req.body);
    console.log('File:', req.file);
    
    const { name, price, stock, category } = req.body;
    if (!name || !price || !stock || !category) {
      return res.status(400).json({ message: 'Required fields missing: name, price, stock, and category are required' });
    }

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    console.log('Image path:', imagePath);

    const product = new Product({
      name,
      price: Number(price),
      stock: Number(stock),
      description: req.body.description || '',
      category,
      image: imagePath,
    });

    console.log('Saving product:', product);
    
    await product.save();
    console.log('Product saved successfully with ID:', product._id);

    res.status(201).json(product);
  } catch (error) {
    console.error('Error saving product:', error);
    res.status(500).send('Server error: ' + error.message);
  }
});

// Get all products
router.get('/', async (req, res) => {
  try {
    console.log('Received query:', req.query); // Debug log
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const skip = (page - 1) * limit;
    const filter = {};
    const sort = {};

    // Apply category filter
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Apply search
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }

    // Sorting logic
    if (req.query.sort === 'price-asc') {
      sort.price = 1;
    } else if (req.query.sort === 'price-desc') {
      sort.price = -1;
    } else if (req.query.sort === 'name-asc') {
      sort.name = 1;
    } else if (req.query.sort === 'name-desc') {
      sort.name = -1;
    }

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ total, products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error: ' + error.message });
}
});
// Get a single product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      console.log(`Product with ID ${req.params.id} not found`);
      return res.status(404).json({ message: 'Product not found' });
    }
    console.log('Found product:', product);
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).send('Server error: ' + error.message);
  }
});

// Get products by category
router.get('/category/:category', async (req, res) => {
  try {
    const category = req.params.category;
    console.log(`GET /api/products/category/${category} - Fetching products by category`);
    const products = await Product.find({ category });
    console.log(`Found ${products.length} products in category ${category}`);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).send('Server error: ' + error.message);
  }
});

// Delete a product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`DELETE /api/products/${id} - Deleting product`);
    
    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
      console.log(`Product with ID ${id} not found for deletion`);
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // If product has an image, delete it from the uploads folder
    if (deletedProduct.image) {
      const imagePath = path.join(__dirname, '../..', deletedProduct.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`Deleted image file: ${imagePath}`);
      }
    }
    
    console.log(`Product with ID ${id} deleted successfully`);
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).send('Server error: ' + error.message);
  }
});

// Update a product
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`PUT /api/products/${id} - Updating product`);
    console.log('Request body:', req.body);
    console.log('File:', req.file);
    
    const { name, price, stock, category } = req.body;
    if (!name || !price || !stock || !category) {
      return res.status(400).json({ message: 'Required fields missing: name, price, stock, and category are required' });
    }

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      console.log(`Product with ID ${id} not found for update`);
      return res.status(404).json({ message: 'Product not found' });
    }

    let imagePath = existingProduct.image; // Default to existing image
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`; // Use new image if uploaded
      
      // Delete the old image file if it exists
      if (existingProduct.image) {
        const oldImagePath = path.join(__dirname, '../..', existingProduct.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log(`Deleted old image file: ${oldImagePath}`);
        }
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        price: Number(price),
        stock: Number(stock),
        description: req.body.description || '',
        category,
        image: imagePath,
      },
      { new: true }
    );

    console.log('Product updated successfully:', updatedProduct);
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).send('Server error: ' + error.message);
  }
});

module.exports = router;