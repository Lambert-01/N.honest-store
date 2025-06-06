const express = require('express');
const router = express.Router();
const Order = require('../models/orders');
const { sendInvoiceEmail } = require('../utils/emailService');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');

// Generate order reference number
function generateOrderReference() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
  return `INV-${timestamp}-${random}`;
}

// Generate order number
function generateOrderNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ORD-${timestamp}-${random}`;
    }

// Generate basic invoice HTML
function generateBasicInvoiceHtml(order) {
  return `
        <div style="margin-top: 20px; margin-bottom: 20px;">
            <h3>Order Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
        <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 8px; border: 1px solid #dee2e6;">Item</th>
                        <th style="padding: 8px; border: 1px solid #dee2e6;">Quantity</th>
                        <th style="padding: 8px; border: 1px solid #dee2e6;">Price</th>
                        <th style="padding: 8px; border: 1px solid #dee2e6;">Total</th>
          </tr>
        </thead>
        <tbody>
                    ${order.items.map(item => `
            <tr>
                            <td style="padding: 8px; border: 1px solid #dee2e6;">${item.name}</td>
                            <td style="padding: 8px; border: 1px solid #dee2e6;">${item.quantity}</td>
                            <td style="padding: 8px; border: 1px solid #dee2e6;">RWF ${item.price.toLocaleString()}</td>
                            <td style="padding: 8px; border: 1px solid #dee2e6;">RWF ${(item.price * item.quantity).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
                        <td colspan="3" style="text-align: right; padding: 8px; border: 1px solid #dee2e6;"><strong>Subtotal:</strong></td>
                        <td style="padding: 8px; border: 1px solid #dee2e6;">RWF ${order.subtotal.toLocaleString()}</td>
          </tr>
            <tr>
                        <td colspan="3" style="text-align: right; padding: 8px; border: 1px solid #dee2e6;"><strong>Delivery Fee:</strong></td>
                        <td style="padding: 8px; border: 1px solid #dee2e6;">RWF ${order.deliveryFee.toLocaleString()}</td>
            </tr>
            <tr>
                        <td colspan="3" style="text-align: right; padding: 8px; border: 1px solid #dee2e6;"><strong>Total:</strong></td>
                        <td style="padding: 8px; border: 1px solid #dee2e6;"><strong>RWF ${order.total.toLocaleString()}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

// Create a new order - No authentication required
router.post('/', async (req, res) => {
    console.log('Received order request:', req.body);
    const startTime = Date.now();

    try {
        // Set a longer timeout for this specific request
        req.setTimeout(180000); // 3 minutes
        res.setTimeout(180000);

        // Validate the order data
        if (!req.body.customer || !req.body.items || !req.body.items.length) {
            return res.status(400).json({
                success: false,
                error: 'Invalid order data. Required fields: customer, items'
            });
        }

        // Validate customer data
        if (!req.body.customer.email || !req.body.customer.fullName) {
            return res.status(400).json({
                success: false,
                error: 'Invalid customer data. Required fields: email, fullName'
            });
        }

        // Create the order object with all required fields
        const orderData = {
            orderNumber: generateOrderNumber(),
            reference: generateOrderReference(),
            customer: {
                fullName: req.body.customer.fullName,
                email: req.body.customer.email,
                phone: req.body.customer.phone || '',
                address: req.body.customer.address || '',
                city: req.body.customer.city || '',
                sector: req.body.customer.sector || '',
                company: req.body.customer.company
            },
            items: req.body.items.map(item => ({
                productId: item.id || item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image
            })),
            subtotal: req.body.subtotal,
            deliveryFee: req.body.deliveryFee || 1500,
            total: req.body.total,
            status: 'pending',
            paymentStatus: 'pending',
            paymentMethod: req.body.paymentMethod || 'invoice',
            createdAt: new Date()
        };

        // Create and save the order
        console.log('Creating order with data:', orderData);
        const order = new Order(orderData);
        const savedOrder = await order.save();
        console.log('Order saved successfully:', savedOrder._id);

        // Send invoice email asynchronously
        console.log('Attempting to send invoice email...');
        try {
            await sendInvoiceEmail(savedOrder);
            console.log('Invoice email sent successfully');
            
            // Update order with email status
            savedOrder.invoiceSent = true;
            savedOrder.invoiceSentAt = new Date();
            await savedOrder.save();
        } catch (emailError) {
            console.error('Error sending invoice email:', emailError);
            // Don't reject the order if email fails
        }

        // Calculate processing time
        const processingTime = Date.now() - startTime;
        console.log(`Order processing completed in ${processingTime}ms`);

        // Send success response
        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: {
                reference: savedOrder.reference,
                orderNumber: savedOrder.orderNumber,
                _id: savedOrder._id,
                total: savedOrder.total,
                status: savedOrder.status,
                paymentStatus: savedOrder.paymentStatus
            }
        });

    } catch (error) {
        console.error('Error processing order:', error);
        const processingTime = Date.now() - startTime;
        console.log(`Order processing failed after ${processingTime}ms`);

        // Send detailed error response
        res.status(500).json({
            success: false,
            error: 'Failed to process order',
            details: error.message,
            code: error.code
        });
    }
});

// Get all orders with pagination and filtering
router.get('/', auth, async (req, res) => {
    try {
        console.log('Fetching orders with params:', req.query);
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status;
        const search = req.query.search;
        const sortField = req.query.sortField || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        // Build query
        let query = {};
        if (status) {
            query.status = status;
        }
        if (search) {
            query.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { 'customer.fullName': { $regex: search, $options: 'i' } },
                { 'customer.email': { $regex: search, $options: 'i' } }
            ];
        }

        console.log('Query:', JSON.stringify(query));

        // Get total count for pagination
        const total = await Order.countDocuments(query);
        console.log('Total matching orders:', total);

        // Get orders
        const orders = await Order.find(query)
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(limit)
            .lean();

        console.log(`Found ${orders.length} orders`);

        res.json({
            success: true,
            orders,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders',
            error: error.message
        });
    }
});

// Get order by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).lean();
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            order
        });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order',
            error: error.message
        });
    }
});

// Get customer orders by email
router.get('/customer/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const orders = await Order.find({ 'customer.email': email }).sort({ createdAt: -1 });
        res.json({
            success: true,
            orders: orders
        });
  } catch (error) {
        console.error('Error fetching customer orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer orders',
            error: error.message
        });
  }
});

// Get order by reference number
router.get('/reference/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const order = await Order.findOne({ reference });
    
    if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
    }
    
        res.json({
            success: true,
            order: order
        });
  } catch (error) {
        console.error('Error fetching order by reference:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order',
            error: error.message
        });
  }
});

// Update order payment status
router.patch('/payment/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const { paymentStatus } = req.body;
    
    if (!['pending', 'paid', 'failed'].includes(paymentStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment status'
            });
    }
    
    const order = await Order.findOne({ reference });
    
    if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
    }
    
    order.paymentStatus = paymentStatus;
    
    // If payment is marked as paid, update order status to processing
    if (paymentStatus === 'paid' && order.status === 'pending') {
      order.status = 'processing';
    }
    
    await order.save();
    
    res.json({
      success: true,
            order: order,
      message: 'Payment status updated successfully'
    });
  } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update payment status',
            error: error.message
        });
    }
});

// Resend invoice email
router.post('/:id/resend-invoice', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Send invoice email
        const emailResult = await sendInvoiceEmail(order);
        
        // Update order with new email status
        await Order.findByIdAndUpdate(order._id, {
            $set: {
                emailSent: true,
                emailSentAt: new Date(),
                emailError: null,
                emailErrorAt: null
            }
        });

        res.json({
            success: true,
            message: 'Invoice email resent successfully',
            result: emailResult
        });
    } catch (error) {
        console.error('Error resending invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend invoice',
            error: error.message
        });
  }
});

// Get order statistics
router.get('/stats', auth, async (req, res) => {
    try {
        console.log('Fetching order stats...');
        
        // Get total orders count
        const totalOrders = await Order.countDocuments();
        console.log('Total orders:', totalOrders);

        // Get orders by status
        const ordersByStatus = await Order.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        console.log('Orders by status:', ordersByStatus);

        // Format the response
        const stats = {
            totalOrders,
            ordersByStatus: ordersByStatus.reduce((acc, curr) => {
                acc[curr._id || 'pending'] = curr.count;
                return acc;
            }, {
            pending: 0,
            processing: 0,
            shipped: 0,
            delivered: 0,
            cancelled: 0
            })
        };

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error fetching order stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order statistics',
            error: error.message
        });
    }
});

// Update order status
router.patch('/:id/status', auth, async (req, res) => {
    try {
        console.log('Updating order status:', { orderId: req.params.id, status: req.body.status });
        
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        // Validate status value
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status value'
            });
        }

        // Find the order and handle validation errors
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Update the order status
        order.status = status;

        // If order is marked as delivered and payment method is invoice, update payment method to cash
        if (status === 'delivered') {
            if (order.paymentMethod === 'invoice') {
                order.paymentMethod = 'cash';
            }
            if (order.paymentStatus === 'pending') {
                order.paymentStatus = 'paid';
            }
        }

        await order.save();
        console.log('Order status updated successfully:', order._id);

        res.json({
            success: true,
            message: 'Order status updated successfully',
            order: {
                _id: order._id,
                status: order.status,
                paymentStatus: order.paymentStatus,
                paymentMethod: order.paymentMethod
            }
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status',
            error: error.message
        });
    }
});

// Delete order
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findByIdAndDelete(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            message: 'Order deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete order',
            error: error.message
        });
    }
});

// Error handler middleware
router.use((err, req, res, next) => {
    console.error('Orders route error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

module.exports = router;