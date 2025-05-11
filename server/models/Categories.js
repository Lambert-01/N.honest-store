const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
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
                index.key && index.key.slug && (index.unique === true)
            );
            
            if (slugIndex) {
                console.log('Found unique index on slug field, dropping it...');
                await collection.dropIndex('slug_1');
                console.log('Dropped unique index on slug field');
            }
        }
    } catch (error) {
        console.error('Error trying to drop slug index:', error);
    }
})();

// Add text index for search
categorySchema.index({ name: 'text', description: 'text' });

// Updated pre-save hook to ensure unique slugs
categorySchema.pre('save', function(next) {
    if (this.isModified('name')) {
        // Create a base slug from the name
        const baseSlug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        
        // Add timestamp to make slug unique
        this.slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;
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

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;