@echo off
echo Cleaning npm cache...
call npm cache clean --force

echo Deleting node_modules folder...
if exist node_modules (
  rmdir /s /q node_modules
)

echo Deleting package-lock.json...
if exist package-lock.json (
  del package-lock.json
)

echo Reinstalling dependencies...
call npm install

echo Installing morgan specifically...
call npm install morgan --save

echo NPM fix complete!
echo You can now try running: npm start
pause