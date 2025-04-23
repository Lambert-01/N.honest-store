// admin.js
document.addEventListener('DOMContentLoaded', function () {
  // Make editProduct and deleteProduct available in global scope
  window.editProduct = editProduct;
  window.deleteProduct = deleteProduct;

  // Handle product image preview
  const imageInput = document.getElementById('image');
  const imagePreview = document.getElementById('image-preview');
  if (imageInput) {
    imageInput.addEventListener('change', function () {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
          imagePreview.src = e.target.result;
          imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(this.files[0]);
      } else {
        imagePreview.src = '';
        imagePreview.style.display = 'none';
      }
    });
  }

  // Add hidden input for product ID to the form if it doesn't exist
  const addProductForm = document.getElementById('add-product-form');
  if (addProductForm && !document.getElementById('product-id')) {
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.id = 'product-id';
    hiddenInput.name = 'id';
    addProductForm.appendChild(hiddenInput);
  }

  // Handle form submission for adding/editing products
  if (addProductForm) {
    addProductForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(addProductForm);
      const productId = document.getElementById('product-id').value;
      
      try {
        let url = '/api/products';
        let method = 'POST';
        
        // If productId exists, we're updating an existing product
        if (productId && productId.trim() !== '') {
          url = `/api/products/${productId}`;
          method = 'PUT';
        }
        
        console.log('Submitting form to:', url, 'with method:', method);
        console.log('Form data:', {
          name: formData.get('name'),
          price: formData.get('price'),
          stock: formData.get('stock'),
          description: formData.get('description'),
          category: formData.get('category'),
          image: formData.get('image') ? formData.get('image').name : 'No file selected'
        });
        
        const response = await fetch(url, {
          method: method,
          body: formData,
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
          const product = await response.json();
          console.log('Response data:', product);
          showAlert(productId ? 'Product updated successfully!' : 'Product added successfully!', 'success');
          addProductForm.reset();
          imagePreview.style.display = 'none';
          document.getElementById('product-id').value = '';
          await refreshProducts();
        } else {
          const errorText = await response.text();
          console.error('Error response:', errorText);
          showAlert(`Failed to save product: ${errorText}`, 'error');
        }
      } catch (error) {
        console.error('Error saving product:', error);
        showAlert(`An unexpected error occurred: ${error.message}`, 'error');
      }
    });
  }

  // Refresh products button
  const refreshBtn = document.getElementById('refresh-products');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshProducts);
  }

  // Clear form button
  const clearFormBtn = document.getElementById('reset-btn');
  if (clearFormBtn) {
    clearFormBtn.addEventListener('click', function () {
      addProductForm.reset();
      imagePreview.style.display = 'none';
      document.getElementById('product-id').value = '';
      const currentImage = document.getElementById('current-image');
      if (currentImage) {
        currentImage.style.display = 'none';
      }
    });
  }

  // Initialize the products table on page load
  refreshProducts();
});

// Fetch and display products
async function refreshProducts() {
  try {
    console.log('Fetching products...');
    const response = await fetch('/api/products');
    console.log('Fetch response status:', response.status);
    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log('Fetched data:', data);

    // Ensure the response contains the expected structure
    const products = data.products || [];
    const totalProducts = data.total || 0;

    const productTableBody = document.getElementById('products-table-body');
    if (!productTableBody) {
      console.error('products-table-body element not found');
      return;
    }

    // Clear the table
    productTableBody.innerHTML = '';

    if (products.length === 0) {
      productTableBody.innerHTML = '<tr><td colspan="8" class="text-center">No products found</td></tr>';
      return;
    }

    // Populate the table
    products.forEach((product) => {
      const row = `
        <tr>
          <td>${product.image ? `<img src="${product.image}" alt="${product.name}" class="img-fluid" style="max-height: 50px;">` : 'No image'}</td>
          <td>${product.name}</td>
          <td>${product._id}</td> <!-- Assuming SKU is the product ID -->
          <td>${product.category}</td>
          <td>${product.price} RWF</td>
          <td>${product.stock || 0}</td>
          <td>${product.stock > 0 ? 'In Stock' : 'Out of Stock'}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="editProduct('${product._id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteProduct('${product._id}')">Delete</button>
          </td>
        </tr>
      `;
      productTableBody.innerHTML += row;
    });

    // Update the "Showing products" text
    document.getElementById('showing-products').textContent = products.length;
    document.getElementById('total-products').textContent = totalProducts;

  } catch (error) {
    console.error('Error fetching products:', error);
    showAlert(`Failed to fetch products: ${error.message}`, 'error');
  }
}

// Edit product
async function editProduct(id) {
  try {
    console.log('Editing product:', id);
    const response = await fetch(`/api/products/${id}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch product: ${response.status} ${response.statusText}`);
    }
    
    const product = await response.json();
    console.log('Fetched product for editing:', product);
    
    document.getElementById('product-id').value = product._id;
    document.getElementById('name').value = product.name;
    document.getElementById('price').value = product.price;
    document.getElementById('stock').value = product.stock || '';
    document.getElementById('description').value = product.description || '';
    document.getElementById('category').value = product.category;
    
    // Update button text
    const submitButton = document.getElementById('submit-product');
    if (submitButton) {
      submitButton.innerHTML = '<i class="fas fa-save me-1"></i>Update Product';
    }
    
    // Show current image if available
    const imagePreview = document.getElementById('image-preview');
    if (product.image && imagePreview) {
      imagePreview.src = product.image;
      imagePreview.style.display = 'block';
    }
    
    showAlert('Product loaded for editing.', 'info');
    // Scroll to form
    document.querySelector('#add-product-form').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Error fetching product:', error);
    showAlert(`Failed to load product details: ${error.message}`, 'error');
  }
}

// Delete product
async function deleteProduct(id) {
  if (confirm('Are you sure you want to delete this product?')) {
    try {
      console.log('Deleting product:', id);
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        showAlert('Product deleted successfully!', 'success');
        await refreshProducts();
      } else {
        const errorText = await response.text();
        showAlert(`Failed to delete product: ${errorText}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      showAlert(`An unexpected error occurred: ${error.message}`, 'error');
    }
  }
}

// Show alert
function showAlert(message, type = 'success') {
  const alertContainer = document.getElementById('alert-container');
  if (!alertContainer) {
    console.error('alert-container element not found');
    return;
  }
  
  alertContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  
  // Make sure the alert is visible
  alertContainer.scrollIntoView({ behavior: 'smooth' });
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    const alertElement = alertContainer.querySelector('.alert');
    if (alertElement) {
      const bsAlert = new bootstrap.Alert(alertElement);
      bsAlert.close();
    }
  }, 5000);
}