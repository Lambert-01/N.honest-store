document.addEventListener("DOMContentLoaded", function() {
    // Initialize Category Manager
    window.categoryManager = new CategoryManager();
    
    // Initialize Product Manager 
    window.productManager = new ProductManager();

    // Image preview functionality for category image upload
    const categoryImageInput = document.getElementById("category-image");
    if (categoryImageInput) {
        categoryImageInput.addEventListener("change", function() {
            previewImage(this, "preview-image");
        });
    }

    const editCategoryImageInput = document.getElementById("edit-category-image");
    if (editCategoryImageInput) {
        editCategoryImageInput.addEventListener("change", function() {
            previewImage(this, "edit-preview-image");
        });
    }

    // Handle category form submission
    const categoryForm = document.getElementById("category-form");
    if (categoryForm) {
        categoryForm.addEventListener("submit", async function(e) {
            e.preventDefault();

            if (!categoryForm.checkValidity()) {
                e.stopPropagation();
                categoryForm.classList.add("was-validated");
                return;
            }

            try {
                const formData = new FormData(categoryForm);
                const categoryName = formData.get('name').trim();

                // Check if category exists
                const checkResponse = await fetch(`/api/categories/check?name=${encodeURIComponent(categoryName)}`);
                const { exists } = await checkResponse.json();

                if (exists) {
                    showAlert('Category already exists', 'danger');
                    return;
                }

                // Add new category with FormData for file upload
                const response = await fetch('/api/categories', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message);
                }

                // Get the modal instance
                const modalElement = document.getElementById('addCategoryModal');
                const modal = bootstrap.Modal.getInstance(modalElement);
                
                // Reset form and close modal
                categoryForm.reset();
                categoryForm.classList.remove('was-validated');
                resetImagePreview('preview-image');
                
                // Close the modal
                if (modal) {
                    modal.hide();
                }

                // Show success message
                showAlert('Category added successfully', 'success');

                // Reload categories without page refresh
                await categoryManager.loadCategories();

                // Update product category dropdowns if they exist
                if (window.productManager) {
                    await productManager.loadCategories();
                }

            } catch (error) {
                console.error('Error adding category:', error);
                showAlert(error.message || 'Failed to add category', 'danger');
            }
        });
    }

    // Handle edit category form submission
    const editCategoryForm = document.getElementById("edit-category-form");
    if (editCategoryForm) {
        editCategoryForm.addEventListener("submit", async function(e) {
            e.preventDefault();

            if (!editCategoryForm.checkValidity()) {
                e.stopPropagation();
                editCategoryForm.classList.add("was-validated");
                return;
            }

            try {
                const formData = new FormData(editCategoryForm);
                const categoryId = formData.get('categoryId');

                // Update category with FormData for file upload
                const response = await fetch(`/api/categories/${categoryId}`, {
                    method: 'PUT',
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message);
                }

                // Get the modal instance
                const modalElement = document.getElementById('editCategoryModal');
                const modal = bootstrap.Modal.getInstance(modalElement);

                // Reset form and close modal
                editCategoryForm.classList.remove('was-validated');
                resetImagePreview('edit-preview-image');
                
                // Close the modal
                if (modal) {
                    modal.hide();
                }

                // Show success message
                showAlert('Category updated successfully', 'success');

                // Reload categories without page refresh
                await categoryManager.loadCategories();

                // Update product category dropdowns if they exist
                if (window.productManager) {
                    await productManager.loadCategories();
                }

            } catch (error) {
                console.error('Error updating category:', error);
                showAlert(error.message || 'Failed to update category', 'danger');
            }
        });
    }

    // Add event listener for modal hidden event
    const addCategoryModal = document.getElementById('addCategoryModal');
    if (addCategoryModal) {
        addCategoryModal.addEventListener('hidden.bs.modal', function () {
            // Reset form when modal is closed
            const form = document.getElementById('category-form');
            if (form) {
                form.reset();
                form.classList.remove('was-validated');
                resetImagePreview('preview-image');
            }
        });
    }

    const editCategoryModal = document.getElementById('editCategoryModal');
    if (editCategoryModal) {
        editCategoryModal.addEventListener('hidden.bs.modal', function () {
            // Reset form when modal is closed
            const form = document.getElementById('edit-category-form');
            if (form) {
                form.reset();
                form.classList.remove('was-validated');
                resetImagePreview('edit-preview-image');
            }
        });
    }

    // Product Form Step Navigation
    const productForm = document.getElementById('product-form');
    const nextStepBtn = document.getElementById('next-step');
    const prevStepBtn = document.getElementById('prev-step');
    const saveProductBtn = document.getElementById('save-product');
    let currentStep = 1;
    const totalSteps = 5;

    // Initialize form steps
    function initializeFormSteps() {
        // Only initialize if we have the required elements
        if (!productForm || !nextStepBtn || !prevStepBtn || !saveProductBtn) {
            return;
        }

        // Hide all steps except the first one
        document.querySelectorAll('.form-step').forEach((step, index) => {
            step.style.display = index === 0 ? 'block' : 'none';
        });

        // Show/hide navigation buttons
        updateNavigationButtons();
    }

    // Update navigation buttons visibility
    function updateNavigationButtons() {
        if (!nextStepBtn || !prevStepBtn || !saveProductBtn) {
            return;
        }

        prevStepBtn.style.display = currentStep > 1 ? 'block' : 'none';
        nextStepBtn.style.display = currentStep < totalSteps ? 'block' : 'none';
        saveProductBtn.style.display = currentStep === totalSteps ? 'block' : 'none';
    }

    // Handle next step
    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', function() {
            if (validateCurrentStep()) {
                document.getElementById(`step-${currentStep}`).style.display = 'none';
                currentStep++;
                document.getElementById(`step-${currentStep}`).style.display = 'block';
                updateNavigationButtons();
            }
        });
    }

    // Handle previous step
    if (prevStepBtn) {
        prevStepBtn.addEventListener('click', function() {
            document.getElementById(`step-${currentStep}`).style.display = 'none';
            currentStep--;
            document.getElementById(`step-${currentStep}`).style.display = 'block';
            updateNavigationButtons();
        });
    }

    // Validate current step
    function validateCurrentStep() {
        const currentStepElement = document.getElementById(`step-${currentStep}`);
        const requiredFields = currentStepElement.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                field.classList.add('is-invalid');
                isValid = false;
            } else {
                field.classList.remove('is-invalid');
            }
        });

        return isValid;
    }

    // Product Variants Management
    window.variants = [];

    // Expose functions to global scope
    window.addVariant = function() {
        const type = document.getElementById('variant-type')?.value;
        const value = document.getElementById('variant-value')?.value;
        const sku = document.getElementById('variant-sku')?.value;

        if (!type || !value || !sku) {
            Swal.fire({
                title: 'Error!',
                text: 'Please fill in all variant fields',
                icon: 'error',
                confirmButtonText: 'OK'
            });
            return;
        }

        const variant = {
            type,
            value,
            sku,
            id: Date.now() // Unique identifier for the variant
        };

        window.variants.push(variant);
        updateVariantsTable();
        clearVariantForm();

        // Show success message
        Swal.fire({
            title: 'Success!',
            text: 'Variant added successfully',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
    };

    window.removeVariant = function(id) {
        window.variants = window.variants.filter(v => v.id !== id);
        updateVariantsTable();
        
        // Show success message
        Swal.fire({
            title: 'Success!',
            text: 'Variant removed successfully',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
    };

    function clearVariantForm() {
        const typeInput = document.getElementById('variant-type');
        const valueInput = document.getElementById('variant-value');
        const skuInput = document.getElementById('variant-sku');
        
        if (typeInput) typeInput.value = '';
        if (valueInput) valueInput.value = '';
        if (skuInput) skuInput.value = '';
    }

    function updateVariantsTable() {
        const tbody = document.getElementById('variants-list');
        if (!tbody) return;

        tbody.innerHTML = '';

        window.variants.forEach(variant => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${variant.type}</td>
                <td>${variant.value}</td>
                <td>${variant.sku}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-danger" onclick="window.removeVariant(${variant.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Handle product form submission
    if (productForm) {
        productForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Product form submitted');

            if (!productForm.checkValidity()) {
                e.stopPropagation();
                productForm.classList.add('was-validated');
                return;
            }

            const submitButton = productForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

            try {
                const formData = new FormData(productForm);
                
                // Add variants to formData if they exist
                const variantsTable = document.getElementById('variants-table');
                if (variantsTable) {
                    const variants = [];
                    variantsTable.querySelectorAll('tbody tr').forEach(row => {
                        const type = row.querySelector('td:nth-child(1)').textContent;
                        const value = row.querySelector('td:nth-child(2)').textContent;
                        const sku = row.querySelector('td:nth-child(3)').textContent;
                        variants.push({ type, value, sku });
                    });
                    formData.append('variants', JSON.stringify(variants));
                }

                console.log('Sending form data:', Object.fromEntries(formData));
                
                const response = await fetch('/api/products', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.message || 'Failed to add product');
                }

                // Show success message
                Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: 'Product added successfully',
                    timer: 2000,
                    showConfirmButton: false
                });

                // Reset form and close modal
                productForm.reset();
                productForm.classList.remove('was-validated');
                resetImagePreviews();
                
                // Close the modal
                const modalElement = document.getElementById('addProductModal');
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) {
                    modal.hide();
                }

                // Reload products table
                await productManager.loadProducts();

            } catch (error) {
                console.error('Error adding product:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error!',
                    text: error.message || 'Failed to add product'
                });
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = 'Save Product';
            }
        });
    }

    // Load Categories for Dropdown
    async function loadCategories() {
        try {
            const response = await fetch('/api/categories');
            const categories = await response.json();
            
            const categorySelect = document.querySelector('select[name="category"]');
            categorySelect.innerHTML = '<option value="">Select Category</option>';
            
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category._id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });
        } catch (error) {
            showAlert('Failed to load categories', 'danger');
        }
    }

    // Load Products Table
    async function loadProducts() {
        try {
            const response = await fetch('/api/products');
            const products = await response.json();
            
            const tbody = document.getElementById('products-table-body');
            tbody.innerHTML = '';
            
            products.forEach(product => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <img src="${product.featuredImage || 'placeholder.jpg'}" 
                             class="product-image" alt="${product.name}">
                    </td>
                    <td>
                        <h6 class="mb-1">${product.name}</h6>
                        <small class="text-muted">SKU: ${product.sku}</small>
                        <p class="mb-0 small">${product.description}</p>
                    </td>
                    <td>${product.category?.name || 'Uncategorized'}</td>
                    <td>
                        <div>RWF ${product.price.toFixed(2)}</div>
                        <small class="text-muted">${product.variants?.length || 0} variants</small>
                    </td>
                    <td>
                        <span class="badge bg-${product.status === 'published' ? 'success' : 'warning'}">
                            ${product.status}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="editProduct('${product._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            showAlert('Failed to load products', 'danger');
        }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
        loadCategories();
        loadProducts();
    });
});

// Function to preview image before upload
function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) return;
    
    const previewContainer = preview.closest('div');
    if (!previewContainer) return;
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.src = e.target.result;
            previewContainer.classList.remove('d-none');
        };
        
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.src = "";
        previewContainer.classList.add('d-none');
    }
}

// Function to reset image preview
function resetImagePreview(previewId) {
    const preview = document.getElementById(previewId);
    const previewContainer = preview.closest('div');
    
    preview.src = "";
    previewContainer.classList.add('d-none');
}

// Function to reset image previews
function resetImagePreviews() {
    const featuredPreview = document.getElementById('featured-image-preview');
    const galleryPreview = document.getElementById('gallery-preview');
    
    if (featuredPreview) {
        featuredPreview.src = '';
        featuredPreview.style.display = 'none';
    }
    
    if (galleryPreview) {
        galleryPreview.innerHTML = '';
    }
}

// Category Manager Class
class CategoryManager {
    constructor() {
        this.loadCategories();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const searchInput = document.getElementById('category-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        const statusFilter = document.getElementById('category-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => this.handleFilter(e.target.value));
        }

        const refreshBtn = document.getElementById('refresh-categories');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadCategories());
        }
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) throw new Error('Failed to fetch categories');
            const categories = await response.json();
            this.displayCategories(categories);
        } catch (error) {
            console.error('Error loading categories:', error);
            showAlert('Failed to load categories', 'danger');
        }
    }

    displayCategories(categories) {
        const tbody = document.getElementById('categories-table-body');
        if (!tbody) return;

        tbody.innerHTML = categories.length ? categories.map(category => `
            <tr>
                <td>
                    ${category.image ? 
                        `<img src="${category.image}" 
                         alt="${category.name}" 
                         class="img-thumbnail" 
                             style="max-width: 50px; max-height: 50px;">` :
                        `<div class="text-muted small">No image</div>`
                    }
                </td>
                <td>${category.name}</td>
                <td>${category.description || '-'}</td>
                <td>${category.products?.length || 0}</td>
                <td>
                    <span class="badge bg-${category.status === 'active' ? 'success' : 'danger'}">
                        ${category.status}
                    </span>
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" onclick="categoryManager.editCategory('${category._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="categoryManager.deleteCategory('${category._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('') : `
            <tr>
                <td colspan="6" class="text-center">No categories found</td>
            </tr>
        `;
    }

    handleSearch(searchTerm) {
        const rows = document.querySelectorAll('#categories-table-body tr');
        searchTerm = searchTerm.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    handleFilter(status) {
        const rows = document.querySelectorAll('#categories-table-body tr');
        
        rows.forEach(row => {
            if (!status) {
                row.style.display = '';
                return;
            }
            const rowStatus = row.querySelector('.badge')?.textContent.toLowerCase();
            row.style.display = rowStatus === status.toLowerCase() ? '' : 'none';
        });
    }

    async deleteCategory(id) {
        if (!confirm('Are you sure you want to delete this category?')) return;

        try {
            const response = await fetch(`/api/categories/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete category');

            showAlert('Category deleted successfully', 'success');
            await this.loadCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
            showAlert('Failed to delete category', 'danger');
        }
    }

    async editCategory(id) {
        try {
            const response = await fetch(`/api/categories/${id}`);
            if (!response.ok) throw new Error('Failed to fetch category details');
            
            const category = await response.json();
            
            // Fill the edit form with category data
            document.getElementById('edit-category-id').value = category._id;
            document.getElementById('edit-category-name').value = category.name;
            document.getElementById('edit-category-description').value = category.description || '';
            document.getElementById('edit-category-status').value = category.status;
            
            // Set current image if exists
            const currentImageContainer = document.querySelector('.current-image-container');
            const currentImage = document.getElementById('current-category-image');
            
            if (category.image) {
                currentImage.src = category.image;
                currentImageContainer.classList.remove('d-none');
            } else {
                currentImageContainer.classList.add('d-none');
            }
            
            // Reset new image preview
            resetImagePreview('edit-preview-image');
            
            // Show the modal
            const editModal = new bootstrap.Modal(document.getElementById('editCategoryModal'));
            editModal.show();
            
        } catch (error) {
            console.error('Error loading category details:', error);
            showAlert('Failed to load category details', 'danger');
        }
    }
}

// Product Manager Class
class ProductManager {
    constructor() {
        this.loadProducts();
        this.initializeEventListeners();
        this.loadCategories();
    }

    initializeEventListeners() {
        const searchInput = document.getElementById('product-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => this.handleFilter(e.target.value));
        }

        const refreshBtn = document.getElementById('refresh-products');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadProducts());
        }
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) throw new Error('Failed to fetch categories');
            const categories = await response.json();
            this.populateCategoryDropdowns(categories);
        } catch (error) {
            console.error('Error loading categories:', error);
            showAlert('Failed to load categories', 'danger');
        }
    }

    populateCategoryDropdowns(categories) {
        // Populate category filter dropdown
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.innerHTML = `
                <option value="">All Categories</option>
                ${categories.map(category => `
                    <option value="${category._id}">${category.name}</option>
                `).join('')}
            `;
        }

        // Populate category select in add product form
        const categorySelect = document.querySelector('select[name="category"]');
        if (categorySelect) {
            categorySelect.innerHTML = `
                <option value="">Select Category</option>
                ${categories.map(category => `
                    <option value="${category._id}">${category.name}</option>
                `).join('')}
            `;
        }

        // Populate category select in edit product form
        const editCategorySelect = document.getElementById('edit-product-category');
        if (editCategorySelect) {
            editCategorySelect.innerHTML = `
                <option value="">Select Category</option>
                ${categories.map(category => `
                    <option value="${category._id}">${category.name}</option>
                `).join('')}
            `;
        }
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch products');
            }
            const products = await response.json();
            this.displayProducts(products);
        } catch (error) {
            console.error('Error loading products:', error);
            showAlert('Failed to load products: ' + error.message, 'danger');
        }
    }

    displayProducts(products) {
        const tbody = document.getElementById('products-table-body');
        if (!tbody) return;

        tbody.innerHTML = products.length ? products.map(product => `
            <tr>
                <td>
                    ${product.featuredImage ? 
                        `<img src="${product.featuredImage}" alt="${product.name}" class="product-thumbnail" style="width: 50px; height: 50px; object-fit: cover;">` : 
                        '<div class="no-image">No Image</div>'}
                </td>
                <td>
                    <div class="d-flex flex-column">
                        <strong>${product.name}</strong>
                        <small class="text-muted">SKU: ${product.sku}</small>
                        <small class="text-muted">ID: ${product._id}</small>
                        <p class="mb-0 small">${product.description || 'No description'}</p>
                    </div>
                </td>
                <td>${product.category ? product.category.name : 'Uncategorized'}</td>
                <td>
                    <div class="d-flex flex-column">
                        <div>Price: RWF ${product.price.toFixed(2)}</div>
                        <div>Cost: RWF ${product.costPrice.toFixed(2)}</div>
                        <div>Stock: ${product.stock}</div>
                    </div>
                </td>
                <td>
                    <span class="badge bg-${product.status === 'active' ? 'success' : 'warning'}">
                        ${product.status}
                    </span>
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" onclick="productManager.editProduct('${product._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="productManager.deleteProduct('${product._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('') : `
            <tr>
                <td colspan="6" class="text-center">No products found</td>
            </tr>
        `;
    }

    handleSearch(searchTerm) {
        const rows = document.querySelectorAll('#products-table-body tr');
        searchTerm = searchTerm.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    handleFilter(categoryId) {
        const rows = document.querySelectorAll('#products-table-body tr');
        
        rows.forEach(row => {
            if (!categoryId) {
                row.style.display = '';
                return;
            }
            const rowCategory = row.querySelector('td:nth-child(3)')?.textContent;
            row.style.display = rowCategory === categoryId ? '' : 'none';
        });
    }

    async deleteProduct(id) {
        if (!confirm('Are you sure you want to delete this product?')) return;

        try {
            const response = await fetch(`/api/products/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete product');

            showAlert('Product deleted successfully', 'success');
            await this.loadProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            showAlert('Failed to delete product', 'danger');
        }
    }

    async editProduct(id) {
        try {
            const response = await fetch(`/api/products/${id}`);
            if (!response.ok) throw new Error('Failed to fetch product details');
            
            const product = await response.json();
            
            // Fill the edit form with product data
            document.getElementById('edit-product-id').value = product._id;
            document.getElementById('edit-product-name').value = product.name;
            document.getElementById('edit-product-description').value = product.description;
            document.getElementById('edit-product-price').value = product.price;
            document.getElementById('edit-product-stock').value = product.stock;
            document.getElementById('edit-product-status').value = product.status;
            
            // Set category value using the category's ObjectId
            const categorySelect = document.getElementById('edit-product-category');
            if (categorySelect && product.category) {
                categorySelect.value = product.category._id || product.category;
            }
            
            // Set current images
            const currentImageContainer = document.querySelector('.current-product-image-container');
            const currentImage = document.getElementById('current-product-image');
            
            if (product.images && product.images.length > 0) {
                currentImage.src = product.images[0];
                currentImageContainer.classList.remove('d-none');
            } else {
                currentImageContainer.classList.add('d-none');
            }
            
            // Reset new image preview
            resetImagePreview('edit-product-preview-image');
            
            // Show the modal
            const editModal = new bootstrap.Modal(document.getElementById('editProductModal'));
            editModal.show();
            
        } catch (error) {
            console.error('Error loading product details:', error);
            showAlert('Failed to load product details', 'danger');
        }
    }
}

// Global function to show alerts
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) return;

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    alertContainer.appendChild(alert);

    // Auto remove after 5 seconds
    setTimeout(() => {
        alert.remove();
    }, 5000);
}