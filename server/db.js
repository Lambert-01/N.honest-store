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
        const atlasPath = path.joi(__dirname, '../atlas.txt');
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
      mongoURI = 'mongodb://localhost:27017/n_honest_supermarket';
      console.warn('No MongoDB URI found in environment variables or atlas.txt. Using local MongoDB.');
    }

    console.log('Connecting to MongoDB...');
    
    // Modified connection options for cPanel environment
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
      socketTimeoutMS: 45000, // Increase socket timeout
      connectTimeoutMS: 30000, // Connection timeout
      // CHANGED: Enable buffering to allow operations before connection is complete
      bufferCommands: process.env.MONGOOSE_BUFFCOMMANDS === 'true',
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Disable auto index for performance
    mongoose.set('autoIndex', false);
    
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    
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