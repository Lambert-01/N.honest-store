const mongoose = require('mongoose');

const PaymentOrderSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  amount: { type: Number, required: true },
  phoneNumber: { type: String },
  email: { type: String },
  referenceId: { type: String },
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payments', PaymentOrderSchema);
