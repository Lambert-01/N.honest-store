const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    slug: {
        type: String,
        lowercase: true,
        // Remove unique constraint to prevent duplicate key errors
        unique: false
    },
    image: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    productsCount: {
        type: Number,
        default: 0
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

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;