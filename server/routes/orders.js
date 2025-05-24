const express = require('express');
const router = express.Router();
const Order = require('../models/orders');
const { sendInvoiceEmail } = require('../utils/emailService');
const crypto = require('crypto');

// Generate a unique order reference number
function generateOrderReference() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${timestamp}-${random}`;
}

// Save new order and send invoice
router.post('/', async (req, res) => {
  try {
    console.log('Received order request:', JSON.stringify(req.body, null, 2));
    
    // Generate unique order number and reference
    const orderNumber = 'ORD-' + Date.now().toString();
    const reference = generateOrderReference();
    
    // Create new order with reference
    const orderData = {
      ...req.body,
      orderNumber,
      reference,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: req.body.paymentMethod || 'invoice'
    };
    
    // Ensure customer information is properly formatted
    if (orderData.customer) {
      // If we only have firstName/lastName but not fullName, create it
      if (!orderData.customer.fullName && orderData.customer.firstName) {
        orderData.customer.fullName = `${orderData.customer.firstName} ${orderData.customer.lastName || ''}`.trim();
      }
      
      // Ensure we have customer email for invoice
      if (!orderData.customer.email) {
        console.error('Missing customer email');
        return res.status(400).json({
          success: false,
          error: 'Customer email is required for order processing'
        });
      }
      
      // Ensure we have all required customer fields
      const requiredFields = ['fullName', 'email', 'phone', 'address', 'city', 'sector'];
      const missingFields = requiredFields.filter(field => !orderData.customer[field]);
      
      if (missingFields.length > 0) {
        console.error('Missing required customer fields:', missingFields);
        return res.status(400).json({
          success: false,
          error: `Missing required customer information: ${missingFields.join(', ')}`
        });
      }
    } else {
      console.error('Missing customer information');
      return res.status(400).json({
        success: false,
        error: 'Customer information is required for order processing'
      });
    }
    
    // Ensure we have items in the order
    if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      console.error('Missing or empty items array');
      return res.status(400).json({
        success: false,
        error: 'Order must contain at least one item'
      });
    }
    
    // Ensure we have all required order fields
    const requiredOrderFields = ['subtotal', 'deliveryFee', 'total'];
    const missingOrderFields = requiredOrderFields.filter(field => orderData[field] === undefined);
    
    if (missingOrderFields.length > 0) {
      console.error('Missing required order fields:', missingOrderFields);
      return res.status(400).json({
        success: false,
        error: `Missing required order information: ${missingOrderFields.join(', ')}`
      });
    }
    
    console.log('Creating new order with data:', JSON.stringify(orderData, null, 2));
    const order = new Order(orderData);
    
    try {
      await order.save();
      console.log('Order saved successfully with ID:', order._id);
    } catch (saveError) {
      console.error('Error saving order to database:', saveError);
      return res.status(500).json({
        success: false,
        error: `Failed to save order: ${saveError.message}`
      });
    }
    
    // Generate and send invoice email
    try {
      let invoiceHtml = req.body.invoiceHtml;
      
      // If no invoice HTML was provided, generate a basic one
      if (!invoiceHtml) {
        invoiceHtml = generateBasicInvoiceHtml(order);
      }
      
      // Send the invoice email
      const emailResult = await sendInvoiceEmail(order, invoiceHtml);
      
      // Update order to mark invoice as sent
      order.invoiceSent = true;
      order.invoiceSentAt = new Date();
      await order.save();
      
      res.status(201).json({
        success: true,
        order,
        emailSent: true,
        emailResult,
        message: 'Order created successfully and invoice sent to customer email'
      });
    } catch (emailError) {
      console.error('Error sending invoice email:', emailError);
      // Still return success for the order, but note the email failure
      res.status(201).json({
        success: true,
        order,
        emailSent: false,
        error: emailError.message,
        message: 'Order created successfully but failed to send invoice email'
      });
    }
  } catch (error) {
    console.error('Error saving order:', error);
    res.status(500).json({ success: false, error: 'Failed to save order' });
  }
});

// Helper function to generate a basic invoice HTML when none is provided
function generateBasicInvoiceHtml(order) {
  const items = order.items || [];
  const customerName = order.customer.fullName || 
                      `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || 
                      'Valued Customer';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2>INVOICE</h2>
        <p>Invoice #: ${order.reference}</p>
        <p>Date: ${new Date().toLocaleDateString()}</p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <div style="float: left; width: 50%;">
          <h3>From:</h3>
          <p>N.Honest Supermarket</p>
          <p>Kigali, Rwanda</p>
          <p>Phone: +250 788 633 739</p>
          <p>Email: support@nhonest.com</p>
        </div>
        <div style="float: right; width: 50%;">
          <h3>To:</h3>
          <p>${customerName}</p>
          <p>${order.customer.email}</p>
          ${order.customer.phone ? `<p>Phone: ${order.customer.phone}</p>` : ''}
          ${order.shippingAddress ? `<p>Address: ${order.shippingAddress}</p>` : ''}
        </div>
        <div style="clear: both;"></div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Item</th>
            <th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">Quantity</th>
            <th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">Price</th>
            <th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">${item.name}</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">${item.quantity}</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">RWF ${item.price ? item.price.toFixed(2) : '0.00'}</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">RWF ${item.total ? item.total.toFixed(2) : (item.price * item.quantity).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding: 10px; text-align: right; border-top: 2px solid #ddd;"><strong>Subtotal:</strong></td>
            <td style="padding: 10px; text-align: right; border-top: 2px solid #ddd;">RWF ${order.subtotal ? order.subtotal.toFixed(2) : order.total.toFixed(2)}</td>
          </tr>
          ${order.tax ? `
            <tr>
              <td colspan="3" style="padding: 10px; text-align: right;"><strong>Tax:</strong></td>
              <td style="padding: 10px; text-align: right;">RWF ${order.tax.toFixed(2)}</td>
            </tr>
          ` : ''}
          ${order.shipping ? `
            <tr>
              <td colspan="3" style="padding: 10px; text-align: right;"><strong>Shipping:</strong></td>
              <td style="padding: 10px; text-align: right;">RWF ${order.shipping.toFixed(2)}</td>
            </tr>
          ` : ''}
          <tr>
            <td colspan="3" style="padding: 10px; text-align: right;"><strong>Total:</strong></td>
            <td style="padding: 10px; text-align: right;"><strong>RWF ${order.total.toFixed(2)}</strong></td>
          </tr>
        </tfoot>
      </table>
      
      <div style="margin-top: 40px;">
        <h3>Payment Information:</h3>
        <p>Payment Method: ${order.paymentMethod || 'Invoice'}</p>
        <p>Payment Status: ${order.paymentStatus || 'Pending'}</p>
        <p>Please make payment to the following account:</p>
        <p>Bank: Bank of Kigali</p>
        <p>Account Name: N.Honest Supermarket</p>
        <p>Account Number: 00012345678</p>
        <p>Reference: ${order.reference}</p>
      </div>
      
      <div style="margin-top: 40px; text-align: center;">
        <p>Thank you for your business!</p>
      </div>
    </div>
  `;
}

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