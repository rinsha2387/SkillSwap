const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createPaidSessionCheckout,
  createGroupSwapCheckout,
  paymentSuccess,
  paymentCancel,
  paymentHistory,
} = require('../controllers/paymentController');

router.get('/checkout/session/:swapSessionId', protect, createPaidSessionCheckout);
router.get('/checkout/group/:swapRequestId', protect, createGroupSwapCheckout);

router.get('/success', protect, paymentSuccess);
router.get('/cancel', protect, paymentCancel);

router.get('/history', protect, paymentHistory);

module.exports = router;