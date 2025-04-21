document.addEventListener('DOMContentLoaded', function() {
  // Handle product image preview
  const imageInput = document.getElementById('image');
  const imagePreview = document.getElementById('image-preview');
  if (imageInput) {
    imageInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
          imagePreview.src = e.target.result;
          imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }

  // Handle form submission
  document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert('Product added successfully!');
        document.getElementById('add-product-form').reset();
        imagePreview.style.display = 'none';
        await refreshProducts();
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to add product.');
      }
    } catch (error) {
      console.error('Error adding product:', error);
      alert('An unexpected error occurred.');
    }
  });

  // Refresh products
  document.getElementById('refresh-products').addEventListener('click', refreshProducts);

  // Fetch and display products
  async function refreshProducts() {
    try {
      const response = await fetch('/api/products');
      const products = await response.json();
      const productTableBody = document.getElementById('products-table-body');
      productTableBody.innerHTML = '';
      products.forEach((product, index) => {
        const row = `
          <tr>
            <td>${product._id}</td>
            <td>${product.name}</td>
            <td>${product.price} RWF</td>
            <td>${product.oldPrice || ''}</td>
            <td>${product.discount || ''}</td>
            <td>${product.description || ''}</td>
            <td>${product.category}</td>
            <td><img src="${product.image}" alt="${product.name}" class="img-fluid" style="max-height: 50px;"></td>
            <td>
              <button class="btn btn-primary" onclick="editProduct('${product._id}')">Edit</button>
              <button class="btn btn-danger" onclick="deleteProduct('${product._id}')">Delete</button>
            </td>
          </tr>
        `;
        productTableBody.innerHTML += row;
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Failed to fetch products.');
    }
  }

  // Edit product
  async function editProduct(id) {
    try {
      const response = await fetch(`/api/products/${id}`);
      const product = await response.json();
      document.getElementById('name').value = product.name;
      document.getElementById('price').value = product.price;
      document.getElementById('oldPrice').value = product.oldPrice || '';
      document.getElementById('discount').value = product.discount || '';
      document.getElementById('description').value = product.description || '';
      document.getElementById('category').value = product.category;
      document.getElementById('image').value = ''; // Clear the file input
      const currentImage = document.getElementById('current-image');
      if (currentImage) {
        currentImage.src = product.image; // Set the src of the current image preview
        currentImage.style.display = 'block'; // Show the image preview
      }
      alert('Product details loaded for editing.');
    } catch (error) {
      console.error('Error fetching product:', error);
      alert('Failed to load product details.');
    }
  }

  // Delete product
  async function deleteProduct(id) {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        const response = await fetch(`/api/products/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          alert('Product deleted successfully!');
          await refreshProducts();
        } else {
          alert('Failed to delete product.');
        }
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('An unexpected error occurred.');
      }
    }
  }
});