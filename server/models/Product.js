const mongoose = require('mongoose');
const { isCloudinaryUrl } = require('../utils/urlHelper');

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
    
    // Check if already a full URL or Cloudinary URL
    if (this.featuredImage.startsWith('http') || isCloudinaryUrl(this.featuredImage)) {
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
                        name: variant.name || 'Unnamed Variant',
                        combination: variant.combination,
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
    // Skip normalization for Cloudinary URLs
    if (this.featuredImage && typeof this.featuredImage === 'string') {
        // If it's a Cloudinary URL, keep it as is
        if (isCloudinaryUrl(this.featuredImage)) {
            console.log('Cloudinary URL detected, keeping as is:', this.featuredImage);
        } 
        // Otherwise normalize local file paths
        else if (!this.featuredImage.startsWith('http')) {
            // Make sure path starts with /uploads/
            if (!this.featuredImage.startsWith('/uploads/')) {
                if (this.featuredImage.startsWith('uploads/')) {
                    this.featuredImage = '/' + this.featuredImage;
                } else if (!this.featuredImage.startsWith('/')) {
                    this.featuredImage = '/uploads/products/' + this.featuredImage;
                }
            }
        }
    }
    
    // Also normalize additional images if any
    if (this.images && Array.isArray(this.images)) {
        this.images = this.images.map(imagePath => {
            if (!imagePath) return imagePath;
            
            // Skip Cloudinary URLs
            if (isCloudinaryUrl(imagePath)) {
                return imagePath;
            }
            
            // Remove any domain prefixes for local files
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

// Static method to drop the SKU index
productSchema.statics.dropSkuIndex = async function() {
  try {
    console.log('Attempting to drop SKU index from products collection...');
    
    // Set a timeout for the operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Dropping SKU index timed out after 5 seconds')), 5000);
    });
    
    // Try to get the collection indexes
    const getIndexesPromise = new Promise(async (resolve, reject) => {
      try {
        const indexes = await this.collection.indexes();
        resolve(indexes);
      } catch (error) {
        reject(error);
      }
    });
    
    // Race the promises to handle timeout
    const indexes = await Promise.race([getIndexesPromise, timeoutPromise]);
    
    // Look for the SKU index
    const skuIndex = indexes.find(index => 
      index.name === 'sku_1' || 
      (index.key && index.key.sku)
    );
    
    // Look for the variants.sku index
    const variantSkuIndex = indexes.find(index => 
      index.name === 'variants.sku_1' || 
      (index.key && index.key['variants.sku'])
    );
    
    if (skuIndex) {
      console.log('Found SKU index, dropping it...');
      await this.collection.dropIndex(skuIndex.name);
      console.log('SKU index dropped successfully');
    } else {
      console.log('No SKU index found, nothing to drop');
    }
    
    if (variantSkuIndex) {
      console.log('Found variants.sku index, dropping it...');
      await this.collection.dropIndex(variantSkuIndex.name);
      console.log('variants.sku index dropped successfully');
    } else {
      console.log('No variants.sku index found, nothing to drop');
    }
    
    return true;
  } catch (error) {
    // Don't throw an error, just log it and continue
    console.warn(`Warning: Could not drop SKU index: ${error.message}`);
    return false;
  }
};

const Product = mongoose.model('Product', productSchema);

// Drop the existing SKU index to allow multiple null values
(async () => {
    try {
        const dropped = await Product.dropSkuIndex();
        if (dropped) {
            console.log('SKU indexes dropped successfully');
        } else {
            console.log('Failed to drop SKU indexes');
        }
    } catch (error) {
        console.error('Error dropping SKU indexes:', error);
    }
})();

module.exports = Product;
