/**
 * URL Helper Utility
 * Provides consistent URL handling between development and production environments
 */

/**
 * Gets the base URL for the application based on the environment
 * @returns {string} The base URL to use for constructing absolute URLs
 */
function getBaseUrl() {
  // For Render deployment
  if (process.env.NODE_ENV === 'production') {
    // Use RENDER_EXTERNAL_URL if available (provided by Render)
    if (process.env.RENDER_EXTERNAL_URL) {
      return process.env.RENDER_EXTERNAL_URL;
    }
    
    // Use BASE_URL from environment if set
    if (process.env.BASE_URL) {
      return process.env.BASE_URL;
    }
    
    // Fallback to known domain for N.Honest
    return 'https://n-honest.onrender.com';
  }
  
  // For local development
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

/**
 * Checks if a URL is from Cloudinary
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL is from Cloudinary
 */
function isCloudinaryUrl(url) {
  return url && (
    url.includes('cloudinary.com') || 
    url.includes('res.cloudinary.com')
  );
}

/**
 * Ensures a URL is absolute by adding the base URL if needed
 * @param {string} url - The URL to check and possibly transform
 * @returns {string} An absolute URL
 */
function ensureAbsoluteUrl(url) {
  if (!url) return '';
  
  // If it's already an absolute URL (including Cloudinary URLs), return it as is
  if (url.startsWith('http://') || url.startsWith('https://') || isCloudinaryUrl(url)) {
    return url;
  }
  
  const baseUrl = getBaseUrl();
  
  // Make sure we have the correct format with no double slashes
  if (url.startsWith('/')) {
    return `${baseUrl}${url}`;
  } else {
    return `${baseUrl}/${url}`;
  }
}

/**
 * Transforms a product or category object by converting relative image URLs to absolute
 * @param {Object} item - The object containing image URLs to transform
 * @returns {Object} The transformed object with absolute image URLs
 */
function transformItemUrls(item) {
  if (!item) return item;
  
  const transformed = typeof item.toObject === 'function' ? item.toObject() : { ...item };
  
  // Handle featured image (for products)
  if (transformed.featuredImage) {
    // Don't modify Cloudinary URLs
    if (!isCloudinaryUrl(transformed.featuredImage)) {
      transformed.featuredImage = ensureAbsoluteUrl(transformed.featuredImage);
    }
  }
  
  // Handle regular image (for categories)
  if (transformed.image) {
    // Don't modify Cloudinary URLs
    if (!isCloudinaryUrl(transformed.image)) {
      transformed.image = ensureAbsoluteUrl(transformed.image);
    }
  }
  
  // Handle multiple images array (for products)
  if (transformed.images && Array.isArray(transformed.images)) {
    transformed.images = transformed.images.map(img => 
      isCloudinaryUrl(img) ? img : ensureAbsoluteUrl(img)
    );
  }
  
  return transformed;
}

/**
 * Generates a verification URL for email verification
 * @param {string} token - The token to include in the verification URL
 * @returns {string} The generated verification URL
 */
function generateVerificationUrl(token) {
  return `${getBaseUrl()}/verify-email?token=${token}`;
}

/**
 * Generates a password reset URL
 * @param {string} token - The token to include in the password reset URL
 * @returns {string} The generated password reset URL
 */
function generatePasswordResetUrl(token) {
  return `${getBaseUrl()}/reset-password?token=${token}`;
}

module.exports = {
  getBaseUrl,
  ensureAbsoluteUrl,
  transformItemUrls,
  isCloudinaryUrl,
  generateVerificationUrl,
  generatePasswordResetUrl
};