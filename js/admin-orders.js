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

            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }

            const response = await fetch(`/api/orders?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch orders');
            }

            const data = await response.json();
            
            if (data.success) {
                this.totalOrders = data.data.pagination.total;
                this.totalPages = data.data.pagination.pages;
                this.displayOrders(data.data.orders);
                this.updatePagination();
                this.updateOrderCounts();
            } else {
                throw new Error(data.error || 'Failed to fetch orders');
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            showAlert('Failed to load orders: ' + error.message, 'error');
            
            // Show empty state in the table
            this.displayOrders([]);
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
                i === this.currentPage - 3 ||
                i === this.currentPage + 3
            ) {
                pages += `
                    <li class="page-item disabled">
                        <a class="page-link" href="#">...</a>
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
    }

    updateOrderCounts() {
        const showingOrders = document.getElementById('showing-orders');
        const totalOrders = document.getElementById('total-orders');
        
        if (showingOrders) {
            const start = (this.currentPage - 1) * this.ordersPerPage + 1;
            const end = Math.min(start + this.ordersPerPage - 1, this.totalOrders);
            showingOrders.textContent = `${start}-${end}`;
        }
        
        if (totalOrders) {
            totalOrders.textContent = this.totalOrders;
        }
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
            
            if (data.success) {
                this.showOrderDetailsModal(data.data);
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
        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="orderDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-gradient-primary text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-shopping-cart me-2"></i>Order Details - #${order.orderNumber}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-4">
                                <div class="col-md-6">
                                    <h6 class="fw-bold">Customer Information</h6>
                                    <p class="mb-1"><strong>Name:</strong> ${order.customer.fullName}</p>
                                    <p class="mb-1"><strong>Email:</strong> ${order.customer.email}</p>
                                    <p class="mb-1"><strong>Phone:</strong> ${order.customer.phone}</p>
                                    <p class="mb-1"><strong>Address:</strong> ${order.customer.address}</p>
                                    <p class="mb-1"><strong>City:</strong> ${order.customer.city}</p>
                                    <p class="mb-1"><strong>Sector:</strong> ${order.customer.sector}</p>
                                </div>
                                <div class="col-md-6">
                                    <h6 class="fw-bold">Order Information</h6>
                                    <p class="mb-1"><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                                    <p class="mb-1"><strong>Payment Method:</strong> ${order.paymentMethod}</p>
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
                                        ${order.items.map(item => `
                                            <tr>
                                                <td>
                                                    <div class="d-flex align-items-center">
                                                        ${item.image ? `
                                                            <img src="${item.image}" alt="${item.name}" class="me-2" style="width: 40px; height: 40px; object-fit: cover;">
                                                        ` : ''}
                                                        <div>${item.name}</div>
                                                    </div>
                                                </td>
                                                <td class="text-end">RWF ${item.price.toFixed(2)}</td>
                                                <td class="text-end">${item.quantity}</td>
                                                <td class="text-end">RWF ${(item.price * item.quantity).toFixed(2)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colspan="3" class="text-end"><strong>Subtotal:</strong></td>
                                            <td class="text-end">RWF ${order.subtotal.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td colspan="3" class="text-end"><strong>Delivery Fee:</strong></td>
                                            <td class="text-end">RWF ${order.deliveryFee.toFixed(2)}</td>
                                        </tr>
                                        ${order.tax ? `
                                            <tr>
                                                <td colspan="3" class="text-end"><strong>Tax:</strong></td>
                                                <td class="text-end">RWF ${order.tax.toFixed(2)}</td>
                                            </tr>
                                        ` : ''}
                                        <tr>
                                            <td colspan="3" class="text-end"><strong>Total:</strong></td>
                                            <td class="text-end"><strong>RWF ${order.total.toFixed(2)}</strong></td>
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
    }

    async updateOrderStatus(orderId, status) {
        try {
            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                throw new Error('Failed to update order status');
            }

            const data = await response.json();
            
            if (data.success) {
                showAlert('Order status updated successfully', 'success');
                this.loadOrders();
            } else {
                throw new Error(data.error || 'Failed to update order status');
            }
        } catch (error) {
            console.error('Error updating order status:', error);
            showAlert('Failed to update order status: ' + error.message, 'error');
        }
    }

    async deleteOrder(orderId) {
        try {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc3545',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Yes, delete it!'
            });

            if (result.isConfirmed) {
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
                    this.loadOrders();
                } else {
                    throw new Error(data.error || 'Failed to delete order');
                }
            }
        } catch (error) {
            console.error('Error deleting order:', error);
            showAlert('Failed to delete order: ' + error.message, 'error');
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