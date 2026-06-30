const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    payee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    swapRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SwapRequest',
      default: null,
    },
    swapSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SwapSession',
      default: null,
    },

    // ── Cashfree fields (replaced Stripe fields) ──
    cashfreeOrderId: {
      type: String,
      required: true,
      unique: true,
    },
    cashfreeSessionId: {
      type: String,
      default: null,
    },
    cashfreePaymentId: {
      type: String,
      default: null,
    },

    // Amount in paise (₹1 = 100 paise)
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentType: {
      type: String,
      enum: ['paid_session', 'group_swap'],
      required: true,
    },
    description: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);