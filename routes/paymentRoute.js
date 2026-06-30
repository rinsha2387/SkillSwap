const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createPaidSessionCheckout,
  createGroupSwapCheckout,
  paymentSuccess,
  paymentCancel,
  paymentHistory,
  // NOTE: handleCashfreeWebhook is registered in server.js separately
} = require('../controllers/paymentController');

// ── Cashfree Checkout Redirects ───────────────────────────
router.get('/checkout/session/:swapSessionId', protect, createPaidSessionCheckout);
router.get('/checkout/group/:swapRequestId', protect, createGroupSwapCheckout);

// ── Cashfree Return Pages ─────────────────────────────────
router.get('/success', protect, paymentSuccess);
router.get('/cancel', protect, paymentCancel);

// ── Payment History ───────────────────────────────────────
router.get('/history', protect, paymentHistory);

module.exports = router;