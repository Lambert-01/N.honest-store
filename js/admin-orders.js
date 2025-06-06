class OrderManager {
    constructor() {
        this.currentPage = 1;
        this.ordersPerPage = 10;
        this.totalOrders = 0;
        this.totalPages = 0;
        this.currentStatus = '';
        this.searchTerm = '';
        this.sortField = 'createdAt';
        this.sortOrder = 'desc';
        
        this.initializeEventListeners();
        this.loadOrders();
    }

    initializeEventListeners() {
        // Search handler
        const searchInput = document.getElementById('order-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                this.searchTerm = e.target.value;
                this.currentPage = 1;
                this.loadOrders();
            }, 500));
        }

        // Filter dropdown handler
        const filterDropdown = document.getElementById('orderFilterDropdown');
        if (filterDropdown) {
            filterDropdown.nextElementSibling.addEventListener('click', (e) => {
                if (e.target.classList.contains('dropdown-item')) {
                    const status = e.target.getAttribute('data-status');
                    this.currentStatus = status === 'all' ? '' : status;
                    this.currentPage = 1;
                    this.loadOrders();
                    
                    // Update dropdown button text
                    filterDropdown.textContent = e.target.textContent;
                }
            });
        }

        // Refresh button handler
        const refreshBtn = document.querySelector('#orders-section button.btn-outline-primary');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadOrders());
        }

        // Pagination handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-link')) {
                e.preventDefault();
                const page = e.target.getAttribute('data-page');
                if (page) {
                    this.currentPage = parseInt(page);
                    this.loadOrders();
                }
            }
        });
    }

    async loadOrders() {
        try {
            showLoader();
            
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.ordersPerPage,
                sortField: this.sortField,
                sortOrder: this.sortOrder
            });

            if (this.currentStatus) {
                params.append('status', this.currentStatus);
            }
            if (this.searchTerm) {
                params.append('search', this.searchTerm);
            }

            console.log('Loading orders with params:', params.toString());

            const baseUrl = window.location.port === '5000' ? 'http://localhost:5000' : '';
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authentication required. Please log in again.');
            }

            const response = await fetch(`${baseUrl}/api/orders?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            console.log('Server response:', data);

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login.html';
                    throw new Error('Session expired. Please log in again.');
                }
                throw new Error(data.message || `Failed to load orders (${response.status})`);
            }
            
            if (data.success) {
                // Handle both response formats
                if (data.data) {
                    // New format
                this.totalOrders = data.data.pagination.total;
                this.totalPages = data.data.pagination.pages;
                this.displayOrders(data.data.orders);
                } else if (data.orders) {
                    // Old format
                    this.totalOrders = data.pagination?.total || data.orders.length;
                    this.totalPages = data.pagination?.pages || Math.ceil(data.orders.length / this.ordersPerPage);
                    this.displayOrders(data.orders);
                } else {
                    throw new Error('Invalid response format');
                }
                
                this.updatePagination();
                this.updateOrderCounts();
            } else {
                throw new Error(data.message || 'Failed to load orders');
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            showAlert('Failed to load orders: ' + error.message, 'error');
            this.displayOrders([]);
            this.updatePagination();
        } finally {
            hideLoader();
        }
    }

    displayOrders(orders) {
        const tbody = document.getElementById('orders-table-body');
        if (!tbody) return;

        if (!orders || orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="text-muted">
                            <i class="fas fa-inbox fa-3x mb-3"></i>
                            <p>No orders found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td>
                    <a href="#" class="order-link" data-order-id="${order._id}">#${order.orderNumber}</a>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div>
                            <div class="fw-bold">${order.customer.fullName}</div>
                            <div class="small text-muted">${order.customer.email}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="small text-muted">${new Date(order.createdAt).toLocaleString()}</div>
                </td>
                <td>
                    <div class="fw-bold">RWF ${order.total.toLocaleString()}</div>
                    <div class="small text-muted">${order.items.length} items</div>
                </td>
                <td>
                    <span class="badge bg-${this.getPaymentStatusBadge(order.paymentStatus)}">${order.paymentStatus}</span>
                </td>
                <td>
                    <span class="badge bg-${this.getOrderStatusBadge(order.status)}">${order.status}</span>
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary view-order" data-order-id="${order._id}" title="View Order">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-order" data-order-id="${order._id}" title="Delete Order">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Add event listeners for order actions
        tbody.querySelectorAll('.view-order').forEach(btn => {
            btn.addEventListener('click', (e) => this.viewOrder(e.currentTarget.dataset.orderId));
        });

        tbody.querySelectorAll('.delete-order').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteOrder(e.currentTarget.dataset.orderId));
        });

        tbody.querySelectorAll('.order-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.viewOrder(e.currentTarget.dataset.orderId);
            });
        });
    }

    updatePagination() {
        const paginationContainer = document.querySelector('#orders-section nav ul.pagination');
        if (!paginationContainer) return;

        // If there are no orders, hide pagination
        if (this.totalOrders === 0) {
            paginationContainer.innerHTML = '';
            return;
        }

        let pages = '';
        
        // Previous button
        pages += `
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${this.currentPage - 1}" aria-label="Previous">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
        `;

        // Page numbers
        for (let i = 1; i <= this.totalPages; i++) {
            if (
                i === 1 || // First page
                i === this.totalPages || // Last page
                (i >= this.currentPage - 2 && i <= this.currentPage + 2) // Pages around current page
            ) {
                pages += `
                    <li class="page-item ${i === this.currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" data-page="${i}">${i}</a>
                    </li>
                `;
            } else if (
                (i === this.currentPage - 3 && this.currentPage > 4) ||
                (i === this.currentPage + 3 && this.currentPage < this.totalPages - 3)
            ) {
                pages += `
                    <li class="page-item disabled">
                        <span class="page-link">...</span>
                    </li>
                `;
            }
        }

        // Next button
        pages += `
            <li class="page-item ${this.currentPage === this.totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${this.currentPage + 1}" aria-label="Next">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `;

        paginationContainer.innerHTML = pages;

        // Update showing count
        const showingElement = document.getElementById('showing-orders');
        const totalElement = document.getElementById('total-orders');
        
        if (showingElement && totalElement) {
            const start = (this.currentPage - 1) * this.ordersPerPage + 1;
            const end = Math.min(this.currentPage * this.ordersPerPage, this.totalOrders);
            showingElement.textContent = `${start}-${end}`;
            totalElement.textContent = this.totalOrders;
        }
    }

    updateOrderCounts() {
        // Get all orders with different statuses
        fetch('/api/orders/stats', {
            headers: getAuthHeaders()
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const stats = data.stats;
                
                // Update the counts in the filter dropdown
                const dropdown = document.getElementById('orderFilterDropdown');
                if (dropdown && dropdown.nextElementSibling) {
                    const items = dropdown.nextElementSibling.querySelectorAll('.dropdown-item');
                    items.forEach(item => {
                        const status = item.getAttribute('data-status');
                        const count = status === 'all' ? this.totalOrders : (stats[status] || 0);
                        const badge = item.querySelector('.badge');
                        if (badge) {
                            badge.textContent = count;
                        } else {
                            item.innerHTML = `${item.textContent} <span class="badge bg-secondary float-end">${count}</span>`;
                        }
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error fetching order stats:', error);
        });
    }

    getOrderStatusBadge(status) {
        const badges = {
            'pending': 'warning',
            'processing': 'info',
            'shipped': 'primary',
            'delivered': 'success',
            'cancelled': 'danger'
        };
        return badges[status] || 'secondary';
    }

    getPaymentStatusBadge(status) {
        const badges = {
            'pending': 'warning',
            'paid': 'success',
            'failed': 'danger'
        };
        return badges[status] || 'secondary';
    }

    async viewOrder(orderId) {
        try {
            showLoader();
            
            const response = await fetch(`/api/orders/${orderId}`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to fetch order details');
            }

            const data = await response.json();
            
            if (data.success && data.order) {
                this.showOrderDetailsModal(data.order);
            } else {
                throw new Error(data.error || 'Failed to fetch order details');
            }
        } catch (error) {
            console.error('Error viewing order:', error);
            showAlert('Failed to load order details: ' + error.message, 'error');
        } finally {
            hideLoader();
        }
    }

    showOrderDetailsModal(order) {
        if (!order) {
            console.error('No order data provided to showOrderDetailsModal');
            return;
        }

        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="orderDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-gradient-primary text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-shopping-cart me-2"></i>Order Details - #${order.orderNumber || 'N/A'}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-4">
                                <div class="col-md-6">
                                    <h6 class="fw-bold">Customer Information</h6>
                                    <p class="mb-1"><strong>Name:</strong> ${order.customer?.fullName || 'N/A'}</p>
                                    <p class="mb-1"><strong>Email:</strong> ${order.customer?.email || 'N/A'}</p>
                                    <p class="mb-1"><strong>Phone:</strong> ${order.customer?.phone || 'N/A'}</p>
                                    <p class="mb-1"><strong>Address:</strong> ${order.customer?.address || 'N/A'}</p>
                                    <p class="mb-1"><strong>City:</strong> ${order.customer?.city || 'N/A'}</p>
                                    <p class="mb-1"><strong>Sector:</strong> ${order.customer?.sector || 'N/A'}</p>
                                </div>
                                <div class="col-md-6">
                                    <h6 class="fw-bold">Order Information</h6>
                                    <p class="mb-1"><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                                    <p class="mb-1"><strong>Payment Method:</strong> ${order.paymentMethod || 'N/A'}</p>
                                    <p class="mb-1">
                                        <strong>Payment Status:</strong> 
                                        <span class="badge bg-${this.getPaymentStatusBadge(order.paymentStatus)}">${order.paymentStatus}</span>
                                    </p>
                                    <p class="mb-1">
                                        <strong>Order Status:</strong>
                                        <select class="form-select form-select-sm d-inline-block w-auto ms-2" id="orderStatus">
                                            ${['pending', 'processing', 'shipped', 'delivered', 'cancelled']
                                                .map(status => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status}</option>`)
                                                .join('')}
                                        </select>
                                    </p>
                                </div>
                            </div>

                            <h6 class="fw-bold mb-3">Order Items</h6>
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th class="text-end">Price</th>
                                            <th class="text-end">Quantity</th>
                                            <th class="text-end">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${order.items?.map(item => `
                                            <tr>
                                                <td>
                                                    <div class="d-flex align-items-center">
                                                        ${item.image ? `
                                                            <img src="${item.image}" alt="${item.name}" class="me-2" style="width: 40px; height: 40px; object-fit: cover;">
                                                        ` : ''}
                                                        <div>${item.name}</div>
                                                    </div>
                                                </td>
                                                <td class="text-end">RWF ${item.price?.toLocaleString()}</td>
                                                <td class="text-end">${item.quantity}</td>
                                                <td class="text-end">RWF ${(item.price * item.quantity)?.toLocaleString()}</td>
                                            </tr>
                                        `).join('') || '<tr><td colspan="4" class="text-center">No items found</td></tr>'}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colspan="3" class="text-end"><strong>Subtotal:</strong></td>
                                            <td class="text-end">RWF ${order.subtotal?.toLocaleString() || '0'}</td>
                                        </tr>
                                        <tr>
                                            <td colspan="3" class="text-end"><strong>Delivery Fee:</strong></td>
                                            <td class="text-end">RWF ${order.deliveryFee?.toLocaleString() || '0'}</td>
                                        </tr>
                                        ${order.tax ? `
                                            <tr>
                                                <td colspan="3" class="text-end"><strong>Tax:</strong></td>
                                                <td class="text-end">RWF ${order.tax.toLocaleString()}</td>
                                            </tr>
                                        ` : ''}
                                        <tr>
                                            <td colspan="3" class="text-end"><strong>Total:</strong></td>
                                            <td class="text-end"><strong>RWF ${order.total?.toLocaleString() || '0'}</strong></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            ${order.deliveryNotes ? `
                                <div class="mt-3">
                                    <h6 class="fw-bold">Delivery Notes</h6>
                                    <p class="mb-0">${order.deliveryNotes}</p>
                                </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-danger" id="deleteOrder">Delete Order</button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" id="updateOrderStatus">Update Status</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('orderDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Initialize modal
        const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
        modal.show();

        // Add event listener for status update
        document.getElementById('updateOrderStatus').addEventListener('click', async () => {
            const newStatus = document.getElementById('orderStatus').value;
            await this.updateOrderStatus(order._id, newStatus);
            modal.hide();
        });

        // Add event listener for delete
        document.getElementById('deleteOrder').addEventListener('click', async () => {
            modal.hide();
            await this.deleteOrder(order._id);
        });
    }

    async updateOrderStatus(orderId, status) {
        try {
            showLoader();
            
            const baseUrl = window.location.port === '5000' ? 'http://localhost:5000' : '';
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Authentication required. Please log in again.');
            }

            console.log('Updating order status:', { orderId, status });

            const response = await fetch(`${baseUrl}/api/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login.html';
                    throw new Error('Session expired. Please log in again.');
                }
                throw new Error(errorData.message || `Failed to update order status (${response.status})`);
            }

            const data = await response.json();
            console.log('Server response:', data);
            
            if (data.success) {
                showAlert('Order status updated successfully', 'success');
                await this.loadOrders(); // Refresh the orders list
            } else {
                throw new Error(data.message || 'Failed to update order status');
            }
        } catch (error) {
            console.error('Error updating order status:', error);
            showAlert('Error updating order status: ' + error.message, 'error');
        } finally {
            hideLoader();
        }
    }

    async deleteOrder(orderId) {
        try {
            const confirmed = await Swal.fire({
                title: 'Are you sure?',
                text: "This action cannot be undone!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc3545',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Yes, delete it!'
            });

            if (!confirmed.isConfirmed) {
                return;
            }

            showLoader();
            
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to delete order');
            }

            const data = await response.json();
            
            if (data.success) {
                showAlert('Order deleted successfully', 'success');
                await this.loadOrders(); // Refresh the orders list
            } else {
                throw new Error(data.message || 'Failed to delete order');
            }
        } catch (error) {
            console.error('Error deleting order:', error);
            showAlert('Failed to delete order: ' + error.message, 'error');
        } finally {
            hideLoader();
        }
    }
}

// Helper function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize OrderManager when the orders section is active
document.addEventListener('DOMContentLoaded', function() {
    const ordersLink = document.querySelector('a[href="#orders-section"]');
    if (ordersLink) {
        ordersLink.addEventListener('click', function() {
            if (!window.orderManager) {
                window.orderManager = new OrderManager();
            } else {
                window.orderManager.loadOrders(); // Refresh orders when section is shown again
            }
        });
    }
}); 