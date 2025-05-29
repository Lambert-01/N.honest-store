const express = require('express');
const router = express.Router();
const Order = require('../models/orders');
const { sendInvoiceEmail } = require('../utils/emailService');
const crypto = require('crypto');
const { auth } = require('./auth');

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

// Handle order creation
router.post('/', async (req, res) => {
    try {
        const orderData = req.body;
        
        // Generate order reference and order number
        orderData.reference = generateOrderReference();
        orderData.orderNumber = generateOrderNumber();
        
        // Create new order
        const order = new Order(orderData);
        const savedOrder = await order.save();
        
        console.log('Order saved successfully with ID:', savedOrder._id);
        
        // Generate invoice HTML
        const invoiceHtml = generateBasicInvoiceHtml(savedOrder);
        
        try {
            // Send invoice email
            await sendInvoiceEmail(savedOrder, invoiceHtml);
            console.log('Invoice email sent successfully');
        } catch (emailError) {
            console.error('Failed to send invoice email:', emailError);
            // Don't fail the order creation if email fails
            // But do return a warning in the response
            return res.status(201).json({
                success: true,
                order: savedOrder,
                warning: 'Order created successfully but failed to send invoice email'
            });
        }
        
        // Return success response
        res.status(201).json({
            success: true,
            order: savedOrder
        });
        
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create order: ' + error.message
        });
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
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
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
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch order'
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

module.exports = router;