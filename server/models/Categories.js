const mongoose = require('mongoose');
const { isCloudinaryUrl } = require('../utils/urlHelper');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    image: {
        type: String
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    products: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Clear any existing unique index on slug field
// This will run when the model is defined
(async () => {
    try {
        // Wait for mongoose to be connected
        if (mongoose.connection.readyState === 1) { // 1 = connected
            const collection = mongoose.connection.db.collection('categories');
            // Drop any existing index on the slug field
            const indexes = await collection.indexes();
            const slugIndex = indexes.find(index => 
                index.key && index.key.slug
            );
            
            if (slugIndex) {
                console.log('Found index on slug field, dropping it...');
                await collection.dropIndex(slugIndex.name);
                console.log('Dropped index on slug field');
            }
        }
    } catch (error) {
        console.error('Error trying to drop slug index:', error);
    }
})();

// Add text index for search
categorySchema.index({ name: 'text', description: 'text' });

// Updated pre-save hook to ensure unique slugs and normalize image paths
categorySchema.pre('save', function(next) {
    // Handle slug creation
    if (!this.slug || this.isModified('name')) {
        // Create a base slug from the name
        const baseSlug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        
        // Add timestamp to make slug unique
        this.slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;
    }
    
    // Handle image path normalization
    if (this.image && typeof this.image === 'string') {
        // If it's a Cloudinary URL, keep it as is
        if (isCloudinaryUrl(this.image)) {
            console.log('Cloudinary URL detected for category image, keeping as is:', this.image);
        } 
        // Otherwise normalize local file paths
        else if (!this.image.startsWith('http')) {
            // Make sure path starts with /uploads/
            if (!this.image.startsWith('/uploads/')) {
                if (this.image.startsWith('uploads/')) {
                    this.image = '/' + this.image;
                } else if (!this.image.startsWith('/')) {
                    this.image = '/uploads/categories/' + this.image;
                }
            }
        }
    }
    
    this.updatedAt = Date.now();
    next();
});

// Static method to update product count for a category
categorySchema.statics.updateProductCount = async function(categoryId) {
    const Product = mongoose.model('Product');
    const count = await Product.countDocuments({ category: categoryId, status: 'active' });
    
    return this.findByIdAndUpdate(
        categoryId, 
        { products: count },
        { new: true }
    );
};

// Fix existing categories with null slugs
categorySchema.statics.fixNullSlugs = async function() {
    try {
        const categoriesWithNullSlugs = await this.find({ slug: null });
        console.log(`Found ${categoriesWithNullSlugs.length} categories with null slugs`);
        
        for (const category of categoriesWithNullSlugs) {
            const baseSlug = category.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
            
            category.slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;
            await category.save();
            console.log(`Fixed slug for category ${category._id}: ${category.slug}`);
        }
        
        return categoriesWithNullSlugs.length;
    } catch (error) {
        console.error('Error fixing null slugs:', error);
        throw error;
    }
};

// Static method to recalculate all product counts
categorySchema.statics.recalculateAllCounts = async function() {
    const Product = mongoose.model('Product');
    const categories = await this.find();
    
    for (const category of categories) {
        const count = await Product.countDocuments({ 
            category: category._id, 
            status: 'active' 
        });
        
        await this.findByIdAndUpdate(
            category._id,
            { products: count }
        );
    }
    
    console.log('Recalculated product counts for all categories');
    return true;
};

module.exports = mongoose.model('Category', categorySchema);