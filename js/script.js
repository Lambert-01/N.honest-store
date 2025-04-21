document.addEventListener('DOMContentLoaded', async () => {
  const productTableBody = document.getElementById('products-table-body');
  // Fetch all products initially
  await refreshProducts();

  // Initialize Swiper for the category carousel
  const categorySwiper = new Swiper('.category-carousel', {
    slidesPerView: 4,
    spaceBetween: 16,
    navigation: {
      nextEl: '.category-carousel-next',
      prevEl: '.category-carousel-prev',
    },
    breakpoints: {
      320: { slidesPerView: 1 },
      768: { slidesPerView: 2 },
      992: { slidesPerView: 3 },
      1200: { slidesPerView: 4 },
    },
  });

  // Add click event listeners to category cards
  document.querySelectorAll('.category-carousel .card').forEach((card) => {
    card.addEventListener('click', async (e) => {
      const category = e.currentTarget.querySelector('.card-title').innerText.toLowerCase();
      await fetchProductsByCategory(category);
    });
  });

  // Add product form submission
  document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', document.getElementById('name').value);
    formData.append('price', document.getElementById('price').value);
    formData.append('oldPrice', document.getElementById('oldPrice').value);
    formData.append('discount', document.getElementById('discount').value);
    formData.append('description', document.getElementById('description').value);
    formData.append('category', document.getElementById('category').value);
    formData.append('image', document.getElementById('image').files[0]);

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        showAlert('Product added successfully!');
        document.getElementById('add-product-form').reset();
        await refreshProducts();
      } else {
        const errorData = await response.json();
        showAlert(errorData.message || 'Failed to add product.', 'error');
      }
    } catch (error) {
      console.error('Error adding product:', error);
      showAlert('An unexpected error occurred.', 'error');
    }
  });

  // Refresh products
  document.getElementById('refresh-products').addEventListener('click', refreshProducts);

  // Fetch products
  async function fetchProductsByCategory(category) {
    try {
      const url = category ? `/api/products/${category}` : '/api/products';
      const response = await fetch(url);
      const products = await response.json();
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
      showAlert('Failed to fetch products.', 'error');
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
      showAlert('Product details loaded for editing.');
    } catch (error) {
      console.error('Error fetching product:', error);
      showAlert('Failed to load product details.', 'error');
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
          showAlert('Product deleted successfully!');
          await refreshProducts();
        } else {
          showAlert('Failed to delete product.', 'error');
        }
      } catch (error) {
        console.error('Error deleting product:', error);
        showAlert('An unexpected error occurred.', 'error');
      }
    }
  }

  // Show alert
  function showAlert(message, type = 'success') {
    alert(`${type === 'success' ? 'Success:' : 'Error:'} ${message}`);
  }
});