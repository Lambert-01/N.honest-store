const express = require('express');
const router = express.Router();
const PaymentOrder = require('../models/payments'); // Ensure this matches the file name
const { requestToPay, checkPaymentStatus } = require('../mtnmomo');

// 🌍 Create a new MTN MoMo Payment
router.post('/create-payment', async (req, res) => {
  const { clientId, amount, phoneNumber, email } = req.body;

  try {
    // Step 1: Validate input
    if (!clientId || !amount || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields: clientId, amount, or phoneNumber' });
    }

    // Step 2: Save payment order to the database
    const newOrder = new PaymentOrder({
      clientId,
      amount,
      phoneNumber,
      email,
      status: 'pending',
    });
    await newOrder.save();

    // Step 3: Send payment request to MTN MoMo API
    const referenceId = await requestToPay(phoneNumber, amount);

    // Step 4: Update the order with the reference ID
    newOrder.referenceId = referenceId;
    await newOrder.save();

    // Respond to the frontend
    res.status(200).json({
      message: 'Payment initialized. Confirm on phone.',
      referenceId,
    });
  } catch (error) {
    console.error('Create Payment Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ✅ Check Payment Status
router.get('/verify-payment/:referenceId', async (req, res) => {
  const { referenceId } = req.params;

  try {
    // Step 1: Verify payment status with MTN MoMo API
    const statusData = await checkPaymentStatus(referenceId);

    // Step 2: Update payment status in the database
    if (statusData.status === 'SUCCESSFUL') {
      await PaymentOrder.findOneAndUpdate(
        { referenceId },
        { status: 'completed' }
      );
    }

    // Respond to the frontend
    res.status(200).json({
      status: statusData.status,
      details: statusData,
    });
  } catch (error) {
    console.error('Verify Payment Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;