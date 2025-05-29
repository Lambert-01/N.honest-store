const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const customerSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    googleId: {
        type: String,
        sparse: true,
        index: true
    },
    picture: {
        type: String,
        default: function() {
            // Generate a profile image URL based on the user's email using Gravatar or UI Avatars
            const emailHash = require('crypto').createHash('md5').update(this.email.toLowerCase().trim()).digest('hex');
            return `https://www.gravatar.com/avatar/${emailHash}?d=https://ui-avatars.com/api/?name=${encodeURIComponent(this.firstName + '+' + this.lastName)}&background=random&color=fff&size=200`;
        }
    },
    profilePicture: {
        type: String,
        default: null
    },
    phone: {
        type: String,
        trim: true
    },
    addresses: [{
        street: String,
        city: String,
        state: String,
        zip: String,
        country: String,
        isDefault: {
            type: Boolean,
            default: false
        }
    }],
    verificationToken: {
        type: String,
        default: undefined
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    emailPreferences: {
        welcomeEmail: {
            type: Boolean,
            default: true
        },
        loginNotifications: {
            type: Boolean,
            default: true
        },
        marketingEmails: {
            type: Boolean,
            default: true
        },
        orderConfirmations: {
            type: Boolean,
            default: true
        }
    },
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    },
    lastLogin: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    },
    cart: {
        items: [{
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product'
            },
            quantity: Number
        }],
        total: Number
    }
}, {
    timestamps: true
});

// Hash password before saving
customerSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
customerSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const Customer = mongoose.model('Customer', customerSchema);
module.exports = Customer;
