// This file is kept for compatibility but EmailJS functionality is removed
console.log('Email configuration loaded - server-side email handling only');

// Export empty configuration
module.exports = {
  init: () => {},
  sendEmail: () => Promise.resolve({ success: true })
}; 