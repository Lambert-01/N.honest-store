const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Increased timeout and retry options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Timeout after 10s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    };

    await mongoose.connect('mongodb://localhost:27017/n_honest_supermarket', options);
    
    // Test that the connection is working
    await mongoose.connection.db.admin().ping();
    
    console.log('MongoDB connected successfully');
    
    // Listen for connection errors after initial connection
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
    
    // Handle application termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error; // Re-throw to be handled by the caller
  }
};

module.exports = connectDB;