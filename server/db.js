const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const connectDB = async () => {
  try {
    // Try to load MongoDB URI from different sources
    let mongoURI = process.env.MONGODB_URI;
    
    // If not found in env vars, try to read from atlas.txt file (for cPanel deployment)
    if (!mongoURI) {
      try {
        const atlasPath = path.join(__dirname, '../atlas.txt');
        if (fs.existsSync(atlasPath)) {
          const fileContent = fs.readFileSync(atlasPath, 'utf8');
          const lines = fileContent.split('\n');
          // First line should contain the MongoDB connection string
          mongoURI = lines[0].trim();
          console.log('MongoDB URI loaded from atlas.txt file');
          
          // Also set other environment variables from the file
          lines.forEach(line => {
            if (line.includes('=')) {
              const [key, value] = line.split('=');
              if (key && value && !process.env[key]) {
                process.env[key] = value.trim();
              }
            }
          });
        }
      } catch (fileError) {
        console.error('Error reading atlas.txt file:', fileError.message);
      }
    }
    
    // Fallback to local MongoDB if no connection string is found
    if (!mongoURI) {
      mongoURI = 'mongodb://127.0.0.1:27017/n_honest_supermarket';
      console.warn('No MongoDB URI found in environment variables or atlas.txt. Using local MongoDB.');
    }

    console.log('Connecting to MongoDB...');
    
    // Modified connection options for better reliability
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
      socketTimeoutMS: 45000, // Increase socket timeout
      connectTimeoutMS: 30000, // Connection timeout
      // Enable buffering to allow operations before connection is complete
      bufferCommands: true,
      autoIndex: false, // Don't build indexes automatically in production
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 2, // Maintain at least 2 socket connections
      retryWrites: true, // Enable retryable writes
      retryReads: true // Enable retryable reads
    });

    // Set up connection error handlers
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected successfully');
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    console.error('Stack trace:', error.stack);
    
    if (error.message.includes('IP that isn\'t whitelisted')) {
      console.error(`
==========================================================
IMPORTANT: You need to whitelist your server IP address in MongoDB Atlas!
Current server IP: ${process.env.SERVER_IP || '34.174.145.10'}
Go to MongoDB Atlas > Network Access > Add IP Address
==========================================================
      `);
    }
    
    // Don't exit the process in production, allow fallback to local files
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    } else {
      console.warn('Running in production without database connection - limited functionality available');
      return null;
    }
  }
};

module.exports = connectDB;