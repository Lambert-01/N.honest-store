const express = require('express');
const router = express.Router();
const Order = require('../models/orders');
const { sendInvoiceEmail } = require('../utils/emailService');
const crypto = require('crypto');

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
    try {
        console.log('Received order request:', req.body);

        // Validate order data
        if (!req.body.customer || !req.body.items || !req.body.total) {
            console.error('Missing required order data');
            return res.status(400).json({
                success: false,
                message: 'Missing required order data'
            });
        }

        // Generate reference and order numbers
        const orderData = {
            ...req.body,
            reference: generateOrderReference(),
            orderNumber: generateOrderNumber(),
            createdAt: new Date()
        };

        // Create order
        const order = new Order(orderData);

        // Save order to database
        const savedOrder = await order.save();
        console.log('Order saved successfully:', savedOrder._id);

        // Send invoice email asynchronously
        try {
            console.log('Attempting to send invoice email...');
            const emailResult = await sendInvoiceEmail(savedOrder);
            console.log('Invoice email sent successfully:', emailResult);
            
            // Update order with email status
            await Order.findByIdAndUpdate(savedOrder._id, {
                $set: {
                    emailSent: true,
                    emailSentAt: new Date()
                }
            });
        } catch (emailError) {
            console.error('Failed to send invoice email:', emailError);
            // Log email failure but don't block order creation
            await Order.findByIdAndUpdate(savedOrder._id, {
                $set: {
                    emailError: emailError.message,
                    emailErrorAt: new Date()
                }
            });
        }

        // Send success response
        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: savedOrder
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create order',
            error: error.message
        });
    }
});

// Get all orders - Removed authentication
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            orders: orders
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

// Get order by ID - Removed authentication
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
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
        console.error('Error fetching order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order',
            error: error.message
        });
    }
});

// Get customer orders by email - Removed authentication
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
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Update order payment status - Removed authentication
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

// Resend invoice email - Removed authentication
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

module.exports = router;