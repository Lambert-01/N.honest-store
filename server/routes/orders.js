const express = require('express');
const router = express.Router();
const Order = require('../models/orders');
const { sendInvoiceEmail } = require('../utils/emailService');
const crypto = require('crypto');
const { auth } = require('./auth');
const { customerAuth } = require('./customerAuth');

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

// Create a new order
router.post('/', customerAuth, async (req, res) => {
    try {
        // Validate order data
        if (!req.body.customer || !req.body.items || !req.body.total) {
            return res.status(400).json({
                success: false,
                message: 'Missing required order data'
            });
        }

        // Create order first
        const order = new Order({
            ...req.body,
            customer: {
                ...req.body.customer,
                userId: req.customer._id // Add authenticated customer ID
            }
        });

        // Save order to database
        const savedOrder = await order.save();
        console.log('Order saved successfully:', savedOrder._id);

        // Send response immediately
        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: savedOrder
        });

        // Send invoice email asynchronously
        try {
            sendInvoiceEmail(savedOrder)
                .then(emailResult => {
                    console.log('Invoice email sent successfully:', emailResult);
                    // Update order with email status
                    return Order.findByIdAndUpdate(savedOrder._id, {
                        $set: {
                            emailSent: true,
                            emailSentAt: new Date()
                        }
                    });
                })
                .catch(emailError => {
                    console.error('Failed to send invoice email:', emailError);
                    // Log email failure but don't block order creation
                    Order.findByIdAndUpdate(savedOrder._id, {
                        $set: {
                            emailError: emailError.message,
                            emailErrorAt: new Date()
                        }
                    }).catch(updateError => {
                        console.error('Failed to update order with email error:', updateError);
                    });
                });
        } catch (emailError) {
            console.error('Error initiating email send:', emailError);
        }

    } catch (error) {
        console.error('Error creating order:', error);
        // If response hasn't been sent yet
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Failed to create order',
                error: error.message
            });
        }
    }
});

// Get all orders with pagination and filtering
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    
    // Build filter query
    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { orderNumber: searchRegex },
        { 'customer.fullName': searchRegex },
        { 'customer.email': searchRegex }
      ];
    }

    // Get total count for pagination
    const total = await Order.countDocuments(query);
    
    // Get orders with populated product details
    const orders = await Order.find(query)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() for better performance

    // Format the response
    const formattedOrders = orders.map(order => ({
      ...order,
      createdAt: order.createdAt,
      total: order.total || 0,
      items: order.items || [],
      customer: {
        fullName: order.customer?.fullName || 'N/A',
        email: order.customer?.email || 'N/A',
        phone: order.customer?.phone || 'N/A'
      },
      status: order.status || 'pending',
      paymentStatus: order.paymentStatus || 'pending'
    }));

    res.json({
      success: true,
      data: {
        orders: formattedOrders,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch orders'
    });
  }
});

// Get order by ID
router.get('/:id', customerAuth, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            'customer.userId': req.customer._id
        });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order',
            error: error.message
        });
    }
});

// Update order status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
      });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update order status'
    });
  }
});

// Delete order
router.delete('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
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
      error: error.message || 'Failed to delete order'
    });
  }
});

// Get all orders (for admin)
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get customer orders by email
router.get('/customer/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const orders = await Order.find({ 'customer.email': email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer orders' });
  }
});

// Get order by reference number
router.get('/reference/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const order = await Order.findOne({ reference });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Update order payment status
router.patch('/payment/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const { paymentStatus } = req.body;
    
    if (!['pending', 'paid', 'failed'].includes(paymentStatus)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }
    
    const order = await Order.findOne({ reference });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    order.paymentStatus = paymentStatus;
    
    // If payment is marked as paid, update order status to processing
    if (paymentStatus === 'paid' && order.status === 'pending') {
      order.status = 'processing';
    }
    
    await order.save();
    
    res.json({
      success: true,
      order,
      message: 'Payment status updated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// Resend invoice email
router.post('/:id/resend-invoice', customerAuth, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            'customer.userId': req.customer._id
        });
        
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

module.exports = router;