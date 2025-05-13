@echo off
echo Installing project dependencies...
call npm install

echo Making sure critical packages are installed...
call npm install morgan cors express mongoose dotenv bcryptjs jsonwebtoken multer

echo Dependencies installation complete!
echo You can now start the server with: npm start
pause