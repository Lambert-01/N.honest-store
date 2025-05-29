// Setup edit product form handler
function setupEditProductFormHandler() {
    const editProductForm = document.getElementById('edit-product-form');
    if (!editProductForm) {
        console.warn('Edit product form not found');
        return;
    }

    console.log('Setting up edit product form handler');
    
    // Remove any existing handlers to avoid duplicates
    const clonedForm = editProductForm.cloneNode(true);
    editProductForm.parentNode.replaceChild(clonedForm, editProductForm);
    
    // Set up the new handler
    clonedForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('Edit product form submitted');

        // Validate form
        if (!this.checkValidity()) {
            e.stopPropagation();
            this.classList.add('was-validated');
            return;
        }

        // Disable the submit button
        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
        }

        try {
            const productId = document.getElementById('edit-product-id').value;
            if (!productId) {
                throw new Error('Product ID is missing');
            }
            
            // Create FormData from the form
            const formData = new FormData(this);
            
            // Add variants data if available
            if (window.productVariants && window.productVariants.length > 0) {
                formData.set('variants', JSON.stringify(window.productVariants));
            } else {
                formData.set('variants', JSON.stringify([]));
            }
            
            // Log all form fields for debugging
            console.log('Edit product form data fields:');
            for (const [key, value] of formData.entries()) {
                const valueDisplay = value instanceof File ? 
                    `File: ${value.name} (${value.size} bytes)` : 
                    (key === 'variants' ? `${value.substring(0, 100)}...` : value);
                console.log(`${key}: ${valueDisplay}`);
            }
            
            // Get auth headers but DO NOT set Content-Type
            const headers = getAuthHeaders();
            delete headers['Content-Type']; 
            
            console.log(`Sending updated product data to server for ID: ${productId}`);
            
            // Send request to server
            const response = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: headers,
                body: formData
            });
            
            console.log('Response status:', response.status);
            
            // Parse response
            const data = await response.json();
            console.log('Server response:', data);
                
            if (!response.ok) {
                throw new Error(data.message || 'Error updating product');
            }

            // Show success message
            showAlert('Product updated successfully', 'success');

            // Reset form
            this.reset();
            
            // Reset image previews
            resetImagePreviews();
            
            // Reset variants
            window.productVariants = [];
            updateVariantsList();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
            if (modal) {
                modal.hide();
            }
            
            // Reload products
            if (window.productManager) {
                window.productManager.loadProducts();
            }

        } catch (error) {
            console.error('Error updating product:', error);
            showAlert(error.message || 'Failed to update product', 'danger');
        } finally {
            // Re-enable submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Update Product';
            }
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setupEditProductFormHandler();
});