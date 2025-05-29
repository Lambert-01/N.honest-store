const Order = require('../models/Order');
const { sendInvoiceEmail } = require('../utils/emailService');
const { generateOrderNumber } = require('../utils/helpers');

/**
 * Create a new order
 */
const createOrder = async (req, res) => {
    try {
        const { customer, items, total, deliveryAddress } = req.body;

        // Generate unique order number
        const orderNumber = await generateOrderNumber();

        const order = new Order({
            orderNumber,
            customer,
            items,
            total,
            deliveryAddress,
            status: 'pending',
            paymentStatus: 'awaiting_payment'
        });

        await order.save();

        // Generate invoice HTML
        const invoiceHtml = generateInvoiceHtml(order);

        // Send invoice email
        try {
            await sendInvoiceEmail(order, invoiceHtml);
        } catch (emailError) {
            console.error('Failed to send invoice email:', emailError);
            // Continue with order creation even if email fails
        }

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                total: order.total,
                status: order.status
            }
        });

    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create order',
            error: error.message
        });
    }
};

/**
 * Get order by ID
 */
const getOrderById = async (req, res) => {
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
            order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order',
            error: error.message
        });
    }
};

/**
 * Get orders by customer
 */
const getCustomerOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            'customer.email': req.user.email
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            orders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer orders',
            error: error.message
        });
    }
};

/**
 * Update order status
 */
const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        order.status = status;
        await order.save();

        // Send status update email
        try {
            await sendOrderStatusEmail(order);
        } catch (emailError) {
            console.error('Failed to send status update email:', emailError);
        }

        res.json({
            success: true,
            message: 'Order status updated successfully',
            order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update order status',
            error: error.message
        });
    }
};

/**
 * Update payment status
 */
const updatePaymentStatus = async (req, res) => {
    try {
        const { paymentStatus, transactionId } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        order.paymentStatus = paymentStatus;
        order.transactionId = transactionId;
        await order.save();

        // Send payment confirmation email
        if (paymentStatus === 'paid') {
            try {
                await sendPaymentConfirmationEmail(order);
            } catch (emailError) {
                console.error('Failed to send payment confirmation email:', emailError);
            }
        }

        res.json({
            success: true,
            message: 'Payment status updated successfully',
            order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update payment status',
            error: error.message
        });
    }
};

/**
 * Generate invoice HTML
 */
const generateInvoiceHtml = (order) => {
    // Generate HTML template for invoice
    return `
        <div style="font-family: Arial, sans-serif;">
            <h2>Invoice #${order.orderNumber}</h2>
            <p>Date: ${new Date(order.createdAt).toLocaleDateString()}</p>
            <hr>
            <h3>Customer Information</h3>
            <p>Name: ${order.customer.fullName}</p>
            <p>Email: ${order.customer.email}</p>
            <p>Phone: ${order.customer.phone}</p>
            <hr>
            <h3>Order Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 8px;">Item</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">Quantity</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">Price</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${order.items.map(item => `
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">RWF ${item.price}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">RWF ${item.price * item.quantity}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="border: 1px solid #ddd; padding: 8px; text-align: right;"><strong>Total:</strong></td>
                        <td style="border: 1px solid #ddd; padding: 8px;">RWF ${order.total}</td>
                    </tr>
                </tfoot>
            </table>
            <hr>
            <h3>Payment Instructions</h3>
            <p>Please complete your payment using one of the following methods:</p>
            <ol>
                <li>MTN Mobile Money (Merchant Code: 430020)</li>
                <li>Bank Transfer (Account details in email)</li>
            </ol>
        </div>
    `;
};

module.exports = {
    createOrder,
    getOrderById,
    getCustomerOrders,
    updateOrderStatus,
    updatePaymentStatus
};
