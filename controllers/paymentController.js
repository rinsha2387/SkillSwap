const axios = require('axios');
const Payment = require('../models/Payment');
const SwapRequest = require('../models/swapRequest');
const SwapSession = require('../models/session');

const CF_BASE_URL =
  process.env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

const cfHeaders = () => ({
  'x-client-id': process.env.CASHFREE_APP_ID,
  'x-client-secret': process.env.CASHFREE_SECRET_KEY,
  'x-api-version': '2023-08-01',
  'Content-Type': 'application/json',
});


async function createCashfreeOrder({ orderId, amount, customerName, customerEmail, customerPhone, returnUrl, notifyUrl, meta }) {
  const body = {
    order_id: orderId,
    order_amount: amount,         
    order_currency: 'INR',
    customer_details: {
      customer_id: meta.payerId,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || '9999999999',
    },
    order_meta: {
      return_url: returnUrl,
      notify_url: notifyUrl,
    },
    order_tags: meta,
  };

  const response = await axios.post(`${CF_BASE_URL}/orders`, body, { headers: cfHeaders() });
  return response.data;        
}


exports.createPaidSessionCheckout = async (req, res) => {
  try {
    const { swapSessionId } = req.params;
    const payer = req.user;

    const swapSession = await SwapSession.findById(swapSessionId).populate('host');
    if (!swapSession) {
      req.flash('error', 'Session not found.');
      return res.redirect('/dashboard');
    }

    if (swapSession.paymentStatus === 'paid') {
      req.flash('error', 'This session is already paid.');
      return res.redirect('/dashboard');
    }

    const payee = swapSession.host;
    const orderId = `SS-SES-${swapSessionId}-${Date.now()}`;

    const cfOrder = await createCashfreeOrder({
      orderId,
      amount: swapSession.price,    
      customerName: payer.name,
      customerEmail: payer.email,
      customerPhone: payer.phone,
      returnUrl: `${process.env.BASE_URL}/payment/success?order_id=${orderId}`,
      notifyUrl: `${process.env.BASE_URL}/payment/webhook`,
      meta: {
        payerId: payer._id.toString(),
        payeeId: payee._id.toString(),
        swapSessionId: swapSessionId,
        paymentType: 'paid_session',
      },
    });

    
    await Payment.create({
      payer: payer._id,
      payee: payee._id,
      swapSession: swapSessionId,
      cashfreeOrderId: orderId,
      cashfreeSessionId: cfOrder.payment_session_id,
      amount: swapSession.price * 100, 
      currency: 'INR',
      status: 'pending',
      paymentType: 'paid_session',
      description: `Paid session: ${swapSession.skillName || 'Skill Session'}`,
    });

    const checkoutUrl = `${CF_BASE_URL}/checkout?session_id=${cfOrder.payment_session_id}`;
    res.redirect(303, checkoutUrl);
  } catch (err) {
    console.error('Cashfree checkout error:', err?.response?.data || err.message);
    req.flash('error', 'Payment failed to initialize. Please try again.');
    res.redirect('/dashboard');
  }
};


exports.createGroupSwapCheckout = async (req, res) => {
  try {
    const { swapRequestId } = req.params;
    const payer = req.user;

    const swapRequest = await SwapRequest.findById(swapRequestId).populate('receiver');
    if (!swapRequest) {
      req.flash('error', 'Swap request not found.');
      return res.redirect('/dashboard');
    }

    if (swapRequest.paymentStatus === 'paid') {
      req.flash('error', 'This swap is already paid.');
      return res.redirect('/requests');
    }

    const payee = swapRequest.receiver;
    const orderId = `SS-GRP-${swapRequestId}-${Date.now()}`;

    const cfOrder = await createCashfreeOrder({
      orderId,
      amount: swapRequest.groupPrice,
      customerName: payer.name,
      customerEmail: payer.email,
      customerPhone: payer.phone,
      returnUrl: `${process.env.BASE_URL}/payment/success?order_id=${orderId}`,
      notifyUrl: `${process.env.BASE_URL}/payment/webhook`,
      meta: {
        payerId: payer._id.toString(),
        payeeId: payee._id.toString(),
        swapRequestId: swapRequestId,
        paymentType: 'group_swap',
      },
    });

    await Payment.create({
      payer: payer._id,
      payee: payee._id,
      swapRequest: swapRequestId,
      cashfreeOrderId: orderId,
      cashfreeSessionId: cfOrder.payment_session_id,
      amount: swapRequest.groupPrice * 100,
      currency: 'INR',
      status: 'pending',
      paymentType: 'group_swap',
      description: 'Group swap session',
    });

    const checkoutUrl = `${CF_BASE_URL}/checkout?session_id=${cfOrder.payment_session_id}`;
    res.redirect(303, checkoutUrl);
  } catch (err) {
    console.error('Cashfree group swap error:', err?.response?.data || err.message);
    req.flash('error', 'Payment failed to initialize. Please try again.');
    res.redirect('/requests');
  }
};


exports.handleCashfreeWebhook = async (req, res) => {
  try {
    const event = req.body;

    if (!event || !event.data) {
      return res.status(200).json({ received: true });
    }

    const { order } = event.data;
    const orderId = order?.order_id;
    const orderStatus = order?.order_status; 

    if (!orderId) return res.status(200).json({ received: true });

    if (orderStatus === 'PAID') {
      const payment = await Payment.findOneAndUpdate(
        { cashfreeOrderId: orderId },
        { status: 'completed' },
        { new: true }
      );

      if (!payment) {
        console.error('Payment record not found for order:', orderId);
        return res.status(200).json({ received: true });
      }

      const tags = event.data.order?.order_tags || {};

      if (tags.paymentType === 'paid_session' && tags.swapSessionId) {
        await SwapSession.findByIdAndUpdate(tags.swapSessionId, {
          paymentStatus: 'paid',
          paymentId: payment._id,
        });
      }

      if (tags.paymentType === 'group_swap' && tags.swapRequestId) {
        await SwapRequest.findByIdAndUpdate(tags.swapRequestId, {
          paymentStatus: 'paid',
          paymentId: payment._id,
        });
      }

      console.log(`✅ Cashfree payment confirmed: ${payment._id}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Cashfree webhook error:', err);
    res.status(200).json({ received: true }); 
  }
};


exports.paymentSuccess = async (req, res) => {
  try {
    const { order_id } = req.query;

    const cfResponse = await axios.get(`${CF_BASE_URL}/orders/${order_id}`, {
      headers: cfHeaders(),
    });

    const orderStatus = cfResponse.data?.order_status;

    if (orderStatus === 'PAID') {
      await Payment.findOneAndUpdate(
        { cashfreeOrderId: order_id },
        { status: 'completed' }
      );
    }

    const payment = await Payment.findOne({ cashfreeOrderId: order_id })
      .populate('payer', 'name')
      .populate('payee', 'name profilePic');

    res.render('payment/success', { payment, orderStatus });
  } catch (err) {
    console.error('Success page error:', err?.response?.data || err.message);
    res.render('payment/success', { payment: null, orderStatus: 'UNKNOWN' });
  }
};


exports.paymentCancel = (req, res) => {
  res.render('payment/cancel');
};


exports.paymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({
      $or: [{ payer: req.user._id }, { payee: req.user._id }],
    })
      .populate('payer', 'name profilePic')
      .populate('payee', 'name profilePic')
      .sort({ createdAt: -1 });

    res.render('payment/history', { payments, currentUser: req.user });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load payment history.');
    res.redirect('/dashboard');
  }
};