const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Product name is required'],
    trim: true 
  },
  price: { 
    type: Number, 
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative'] 
  },
  stock: { 
    type: Number, 
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0 
  },
  description: { 
    type: String,
    default: '' 
  },
  category: { 
    type: String, 
    required: [true, 'Product category is required'],
    enum: [
      'beverages', 
      'packaged-foods', 
      'dairy-products', 
      'household-supplies', 
      'personal-care', 
      'cleaning-products', 
      'baby-care', 
      'pet-supplies'
    ]
  },
  image: { 
    type: String,
    default: null 
  },
  rating: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 5 
  },
  reviews: { 
    type: Number, 
    default: 0,
    min: 0 
  }
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;