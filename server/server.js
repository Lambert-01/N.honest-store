// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads'))); 