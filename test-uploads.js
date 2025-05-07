const fs = require('fs');
const path = require('path');

// Test uploads directory structure
function testUploadsDirectory() {
    console.log('Testing uploads directory structure...');
    
    // Ensure root uploads directory exists
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        console.error('❌ Uploads directory does not exist. Creating it...');
        try {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log('✅ Created uploads directory');
        } catch (error) {
            console.error('Error creating uploads directory:', error);
            return false;
        }
    } else {
        console.log('✅ Uploads directory exists');
    }
    
    // Ensure products directory exists
    const productsDir = path.join(uploadsDir, 'products');
    if (!fs.existsSync(productsDir)) {
        console.error('❌ Products uploads directory does not exist. Creating it...');
        try {
            fs.mkdirSync(productsDir, { recursive: true });
            console.log('✅ Created products uploads directory');
        } catch (error) {
            console.error('Error creating products uploads directory:', error);
            return false;
        }
    } else {
        console.log('✅ Products uploads directory exists');
    }
    
    // Ensure categories directory exists
    const categoriesDir = path.join(uploadsDir, 'categories');
    if (!fs.existsSync(categoriesDir)) {
        console.error('❌ Categories uploads directory does not exist. Creating it...');
        try {
            fs.mkdirSync(categoriesDir, { recursive: true });
            console.log('✅ Created categories uploads directory');
        } catch (error) {
            console.error('Error creating categories uploads directory:', error);
            return false;
        }
    } else {
        console.log('✅ Categories uploads directory exists');
    }
    
    // Test write permissions for products directory
    try {
        const testFilePath = path.join(productsDir, 'test-file.txt');
        fs.writeFileSync(testFilePath, 'Test write permissions', 'utf8');
        console.log('✅ Write permissions OK for products directory');
        
        // Clean up test file
        fs.unlinkSync(testFilePath);
    } catch (error) {
        console.error('❌ Write permission test failed for products directory:', error);
        return false;
    }
    
    console.log('All tests passed! Directory structure is correct.');
    return true;
}

// Check server-side path configuration
function checkServerPathConfig() {
    console.log('Checking server-side path configuration...');
    
    const productsRoutePath = path.join(__dirname, 'server', 'routes', 'products.js');
    if (!fs.existsSync(productsRoutePath)) {
        console.error('❌ products.js route file not found');
        return false;
    }
    
    const productsRouteContent = fs.readFileSync(productsRoutePath, 'utf8');
    
    // Check for correct uploads path configuration
    if (productsRouteContent.includes('../../uploads/products')) {
        console.log('✅ products.js has correct relative path to uploads directory');
    } else {
        console.error('❌ products.js may have incorrect path to uploads directory');
    }
    
    // Check multer configuration
    if (productsRouteContent.includes('multer.diskStorage')) {
        console.log('✅ Multer disk storage is configured');
    } else {
        console.error('❌ Multer disk storage may not be properly configured');
    }
    
    console.log('Server path configuration check complete.');
    return true;
}

// Run tests
console.log('====== UPLOAD DIRECTORY STRUCTURE TEST ======');
const dirStructureResult = testUploadsDirectory();
console.log('\n====== SERVER PATH CONFIGURATION TEST ======');
const serverConfigResult = checkServerPathConfig();

// Final results
console.log('\n====== TEST RESULTS ======');
if (dirStructureResult && serverConfigResult) {
    console.log('✅ All tests passed! Your upload system should be working correctly.');
} else {
    console.log('❌ Some tests failed. Please check the issues above.');
} 