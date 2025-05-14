const mongoose = require('mongoose');

// Define the variant schema
const variantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    combination: {
        type: Array,
        default: []
    },
    sku: {
        type: String
    },
    price: {
        type: Number,
        required: true
    },
    stock: {
        type: Number,
        required: true,
        default: 0
    }
});

// Define the product schema
const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    sku: {
        type: String,
        unique: true,
        sparse: true
    },
    description: {
        type: String
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    costPrice: {
        type: Number,
        required: true
    },
    stock: {
        type: Number,
        required: true,
        default: 0
    },
    images: {
        type: [String],
        default: []
    },
    featuredImage: {
        type: String
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    variants: {
        type: [variantSchema],
        default: []
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

// Helper method to get full image URL
productSchema.methods.getImageUrl = function() {
    if (!this.featuredImage) return null;
    
    // Check if already a full URL
    if (this.featuredImage.startsWith('http')) {
        return this.featuredImage;
    }
    
    // Get base URL from env or default
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    
    // Ensure path starts with /
    const imagePath = this.featuredImage.startsWith('/') 
        ? this.featuredImage 
        : '/' + this.featuredImage;
    
    return `${baseUrl}${imagePath}`;
};

// Virtual to get full image URL
productSchema.virtual('imageUrl').get(function() {
    return this.getImageUrl();
});

// Add a pre-save hook to ensure the updated timestamp is set
productSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Add a pre-save hook to handle variants
productSchema.pre('save', function(next) {
    console.log("Processing variants in pre-save hook");
    
    if (this.variants && Array.isArray(this.variants)) {
        console.log(`Pre-save: Processing ${this.variants.length} variants`);
        
        // Filter out invalid variants and ensure proper structure
        this.variants = this.variants
            .filter(variant => variant && typeof variant === 'object')
            .map(variant => {
                console.log(`Processing variant: ${JSON.stringify(variant).substring(0, 100)}`);
                
                // Handle all possible formats that might come from the frontend
                
                // Format 1: New format with combination array
                if (variant.combination && Array.isArray(variant.combination)) {
                    console.log(`Variant has combination array with ${variant.combination.length} items`);
                    return {
                        name: variant.name || `Variant ${variant.sku || ''}`,
                        combination: variant.combination,
                        sku: variant.sku || `${this.sku}-variant`,
                        price: parseFloat(variant.price) || this.price,
                        stock: parseInt(variant.stock, 10) || 0
                    };
                } 
                // Format 2: Old format with type and value properties
                else if (variant.type && variant.value) {
                    console.log(`Variant has type/value format: ${variant.type}:${variant.value}`);
                    return {
                        name: `${variant.type}: ${variant.value}`,
                        combination: [{ attribute: variant.type, value: variant.value }],
                        sku: variant.sku || `${this.sku}-${variant.value.replace(/\s+/g, '-')}`,
                        price: parseFloat(variant.price) || this.price,
                        stock: parseInt(variant.stock, 10) || 0
                    };
                }
                // Format 3: Simple name and price format
                else if (variant.name) {
                    console.log(`Variant has name only: ${variant.name}`);
                    return {
                        name: variant.name,
                        combination: [],
                        sku: variant.sku || `${this.sku}-simple`,
                        price: parseFloat(variant.price) || this.price,
                        stock: parseInt(variant.stock, 10) || 0
                    };
                }
                // Skip invalid variants
                else {
                    console.log('Invalid variant format, skipping');
                    return null;
                }
            })
            .filter(Boolean); // Remove any null entries
        
        console.log(`Pre-save: Finished processing variants. Final count: ${this.variants.length}`);
    } else {
        console.log('Pre-save: No variants array found or not an array');
    }
    
    next();
});

// Add a pre-save hook to normalize image paths
productSchema.pre('save', function(next) {
    // Ensure featuredImage starts with /uploads/ if it exists
    if (this.featuredImage && typeof this.featuredImage === 'string') {
        // Remove any domain prefixes
        if (this.featuredImage.includes('http')) {
            this.featuredImage = this.featuredImage.replace(/^https?:\/\/[^\/]+/, '');
        }
        
        // Make sure path starts with /uploads/
        if (!this.featuredImage.startsWith('/uploads/')) {
            if (this.featuredImage.startsWith('uploads/')) {
                this.featuredImage = '/' + this.featuredImage;
            } else if (!this.featuredImage.startsWith('/')) {
                this.featuredImage = '/uploads/products/' + this.featuredImage;
            }
        }
    }
    
    // Also normalize additional images if any
    if (this.images && Array.isArray(this.images)) {
        this.images = this.images.map(imagePath => {
            if (!imagePath) return imagePath;
            
            // Remove any domain prefixes
            if (imagePath.includes('http')) {
                imagePath = imagePath.replace(/^https?:\/\/[^\/]+/, '');
            }
            
            // Make sure path starts with /uploads/
            if (!imagePath.startsWith('/uploads/')) {
                if (imagePath.startsWith('uploads/')) {
                    return '/' + imagePath;
                } else if (!imagePath.startsWith('/')) {
                    return '/uploads/products/' + imagePath;
                }
            }
            
            return imagePath;
        });
    }
    
    next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
