#!/bin/bash

# Install all dependencies
echo "Installing project dependencies..."
npm install

# Install specific missing packages
echo "Making sure critical packages are installed..."
npm install morgan cors express mongoose dotenv bcryptjs jsonwebtoken multer

echo "Dependencies installation complete!"
echo "You can now start the server with: npm start"