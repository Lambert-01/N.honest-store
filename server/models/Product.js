const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true
    },
    value: {
        type: String,
        required: true
    },
    sku: {
        type: String,
        required: true
    }
});

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },
    sku: {
        type: String,
        required: [true, 'SKU is required'],
        unique: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Product category is required']
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: 0
    },
    costPrice: {
        type: Number,
        required: [true, 'Cost price is required'],
        min: 0
    },
    stock: {
        type: Number,
        required: [true, 'Stock quantity is required'],
        min: 0,
        default: 0
    },
    images: [String],
    featuredImage: String,
    variants: [variantSchema],
    status: {
        type: String,
        enum: ['active', 'inactive', 'draft'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster queries
productSchema.index({ name: 'text', description: 'text' });

// Virtual for price calculation
productSchema.virtual('profit').get(function() {
    return this.price - this.costPrice;
});

// Method to check if product is in stock
productSchema.methods.isInStock = function() {
    return this.stock > 0;
};

// Add a pre-save hook to ensure the updated timestamp is set
productSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;