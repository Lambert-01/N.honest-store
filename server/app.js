const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const connectDB = require('./db'); // Import your database connection function
const productRoutes = require('./routes/products'); // Import your product routes

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/products', productRoutes);

// Serve frontend pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin.html'));
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});