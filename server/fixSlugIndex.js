/**
 * Run this script once to fix the duplicate slug index issue
 * Usage: node server/fixSlugIndex.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db');

async function fixSlugIndex() {
    try {
        console.log('Connecting to MongoDB...');
        await connectDB();
        console.log('Connected to MongoDB');

        console.log('Looking for Categories collection...');
        const collections = await mongoose.connection.db.listCollections().toArray();
        const categoriesCollection = collections.find(c => c.name === 'categories');
        
        if (!categoriesCollection) {
            console.log('Categories collection not found. No action needed.');
            process.exit(0);
        }

        const collection = mongoose.connection.db.collection('categories');
        
        // Check if the unique index exists
        console.log('Checking for slug index...');
        const indexes = await collection.indexes();
        console.log('Current indexes:', indexes);
        
        const slugIndex = indexes.find(index => 
            index.key && index.key.slug && (index.unique === true)
        );
        
        if (slugIndex) {
            console.log('Found unique index on slug field:', slugIndex);
            
            // Drop the index
            console.log('Dropping unique slug index...');
            await collection.dropIndex('slug_1');
            console.log('Successfully dropped unique slug index');
            
            // Verify it's gone
            const updatedIndexes = await collection.indexes();
            console.log('Updated indexes:', updatedIndexes);
            console.log('Fix completed successfully');
        } else {
            console.log('No unique slug index found. No action needed.');
        }
    } catch (error) {
        console.error('Error fixing slug index:', error);
    } finally {
        // Close the connection
        console.log('Closing MongoDB connection...');
        await mongoose.connection.close();
        console.log('Connection closed');
        process.exit(0);
    }
}

// Run the function
fixSlugIndex(); 