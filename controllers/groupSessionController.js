const axios        = require('axios');
const GroupSession = require('../models/groupSession');
const User         = require('../models/users');
const Review       = require('../models/reviews');
const Payment      = require('../models/Payment');


const CF_BASE_URL =
  process.env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

const cfHeaders = () => ({
  'x-client-id':     process.env.CASHFREE_APP_ID,
  'x-client-secret': process.env.CASHFREE_SECRET_KEY,
  'x-api-version':   '2023-08-01',
  'Content-Type':    'application/json',
});


async function syncStatus(session) {
  const computed = session.computeStatus();
  if (computed !== session.status) {
    session.status = computed;
    if (computed === 'active' && !session.meetLink) {
      session.meetLink = `https://meet.jit.si/skillswap-group-${session._id}`;
    }
    await session.save();
  }
  return session;
}


const showCreateForm = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    res.render('user/createGroupSession', {
      currentUser,
      avatar: currentUser.profilePic || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};


const createGroupSession = async (req, res) => {
  try {
    const {
      title, description, skillTaught, level,
      scheduledAt, duration, maxParticipants,
      isFree, price, tags,
    } = req.body;

    const free = isFree === 'on' || isFree === 'true';

    const session = await GroupSession.create({
      host:            req.user._id,
      title,
      description,
      skillTaught,
      level,
      scheduledAt:     new Date(scheduledAt),
      duration:        parseInt(duration) || 60,
      maxParticipants: parseInt(maxParticipants) || 10,
      isFree:          free,
      price:           free ? 0 : (parseFloat(price) || 0),
      tags:            tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    });

    res.redirect(`/group-sessions/${session._id}`);
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to create session' });
  }
};


const getSessionDetail = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    let session = await GroupSession.findById(req.params.id)
      .populate('host', 'name profilePic')
      .populate('participants.user', 'name profilePic');

    if (!session) return res.status(404).render('error', { message: 'Session not found' });

    session = await syncStatus(session);

    const isHost        = session.host._id.equals(currentUser._id);
    const myParticipant = session.participants.find(p => p.user._id.equals(currentUser._id));
    const isEnrolled    = !!myParticipant;
    const hasPaid       = myParticipant ? myParticipant.paid : false;
    const canJoin       = session.status === 'active' && isEnrolled && (hasPaid || session.isFree);

    const start   = new Date(session.scheduledAt);
    const end     = new Date(start.getTime() + session.duration * 60 * 1000);
    const now     = new Date();
    const msUntil = start - now;
    const isOver  = now > end;

    const hasReviewedHost = !!(await Review.findOne({
      reviewer:     currentUser._id,
      groupSession: session._id,
    }));

    res.render('user/groupSessionDetails', {
      session,
      currentUser,
      isHost,
      isEnrolled,
      hasPaid,
      canJoin,
      isOver,
      start,
      end,
      msUntil,
      hasReviewedHost,
      cashfreeEnv: process.env.CASHFREE_ENV || 'sandbox', 
      avatar: currentUser.profilePic || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};


const enrollFree = async (req, res) => {
  try {
    const session = await GroupSession.findById(req.params.id);
    if (!session || !session.isFree)
      return res.status(400).json({ error: 'Invalid' });
    if (session.status === 'ended' || session.status === 'cancelled')
      return res.status(400).json({ error: 'Session not available' });

    const alreadyIn = session.participants.find(p => p.user.equals(req.user._id));
    if (alreadyIn) return res.redirect(`/group-sessions/${session._id}`);

    const spotsLeft =
      session.maxParticipants -
      session.participants.filter(p => p.paid || session.isFree).length;
    if (spotsLeft <= 0) return res.status(400).json({ error: 'Session is full' });

    session.participants.push({ user: req.user._id, paid: true, joinedAt: new Date() });
    await session.save();
    res.redirect(`/group-sessions/${session._id}`);
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Enrollment failed' });
  }
};


const createPaymentOrder = async (req, res) => {
  try {
    const session = await GroupSession.findById(req.params.id);
    if (!session || session.isFree)
      return res.status(400).json({ error: 'Invalid session' });

    const alreadyPaid = session.participants.find(
      p => p.user.equals(req.user._id) && p.paid
    );
    if (alreadyPaid) return res.json({ alreadyPaid: true });

    const user    = await User.findById(req.user._id);
    const orderId = `GS-${session._id}-${req.user._id}-${Date.now()}`.slice(0, 50);

   
    const cfRes = await axios.post(
      `${CF_BASE_URL}/orders`,
      {
        order_id:     orderId,
        order_amount: session.price,        
        order_currency: 'INR',
        customer_details: {
          customer_id:    req.user._id.toString(),
          customer_name:  user.name,
          customer_email: user.email,
          customer_phone: user.phone || '9999999999',
        },
        order_meta: {
          return_url: `${process.env.BASE_URL}/group-sessions/${session._id}?order_id=${orderId}`,
          notify_url: `${process.env.BASE_URL}/payment/webhook`,
        },
        order_tags: {
          paymentType:    'group_swap',
          groupSessionId: session._id.toString(),
          userId:         req.user._id.toString(),
        },
      },
      { headers: cfHeaders() }
    );

    const { payment_session_id } = cfRes.data;

   
    await Payment.create({
      payer:           req.user._id,
      payee:           session.host,
      swapRequest:     null,
      swapSession:     null,
      cashfreeOrderId: orderId,
      cashfreeSessionId: payment_session_id,
      amount:          session.price * 100,
      currency:        'INR',
      status:          'pending',
      paymentType:     'group_swap',
      description:     `Group session: ${session.title}`,
    });

    res.json({ paymentSessionId: payment_session_id, orderId });
  } catch (err) {
    console.error('Cashfree order error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Could not create payment order' });
  }
};


const verifyPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

    
    const cfRes = await axios.get(
      `${CF_BASE_URL}/orders/${orderId}`,
      { headers: cfHeaders() }
    );

    const orderStatus = cfRes.data?.order_status; 

    if (orderStatus !== 'PAID') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const session = await GroupSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    
    const paidCount = session.participants.filter(p => p.paid).length;
    if (paidCount >= session.maxParticipants) {
      return res.status(400).json({ error: 'Session is now full' });
    }

 
    let cashfreePaymentId = null;
    try {
      const paymentsRes = await axios.get(
        `${CF_BASE_URL}/orders/${orderId}/payments`,
        { headers: cfHeaders() }
      );
      cashfreePaymentId = paymentsRes.data?.[0]?.cf_payment_id || null;
    } catch (_) {}

   
    const existing = session.participants.find(p => p.user.equals(req.user._id));
    if (existing) {
      existing.paid               = true;
      existing.paidAt             = new Date();
      existing.cashfreePaymentId  = cashfreePaymentId;
    } else {
      session.participants.push({
        user:              req.user._id,
        paid:              true,
        paidAt:            new Date(),
        cashfreePaymentId: cashfreePaymentId,
        joinedAt:          new Date(),
      });
    }
    await session.save();

    
    await Payment.findOneAndUpdate(
      { cashfreeOrderId: orderId },
      { status: 'completed', cashfreePaymentId }
    );

    res.json({ success: true, redirect: `/group-sessions/${session._id}` });
  } catch (err) {
    console.error('Cashfree verify error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Payment verification failed' });
  }
};


const listGroupSessions = async (req, res) => {
  try {
    const sessions = await GroupSession.find({
      status:      { $in: ['scheduled', 'active'] },
      scheduledAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    })
      .populate('host', 'name profilePic')
      .sort({ scheduledAt: 1 })
      .limit(20);

    const synced = await Promise.all(sessions.map(s => syncStatus(s)));
    res.json({ sessions: synced });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};


const cancelSession = async (req, res) => {
  try {
    const session = await GroupSession.findById(req.params.id);
    if (!session) return res.status(404).render('error', { message: 'Not found' });
    if (!session.host.equals(req.user._id))
      return res.status(403).render('error', { message: 'Not authorized' });
    if (session.status === 'ended' || session.status === 'cancelled')
      return res.status(400).render('error', { message: 'Session is already ended or cancelled' });

    session.status = 'cancelled';
    await session.save();
    res.redirect('/explore');
  } catch (err) {
    res.status(500).render('error', { message: 'Server error' });
  }
};


const endSession = async (req, res) => {
  try {
    const session = await GroupSession.findById(req.params.id);
    if (!session) return res.status(404).render('error', { message: 'Not found' });
    if (!session.host.equals(req.user._id))
      return res.status(403).render('error', { message: 'Not authorized' });
    if (session.status === 'ended' || session.status === 'cancelled')
      return res.status(400).render('error', { message: 'Session is already ended or cancelled' });

    session.status = 'ended';
    await session.save();
    res.redirect(`/group-sessions/${session._id}`);
  } catch (err) {
    res.status(500).render('error', { message: 'Server error' });
  }
};


const showGroupReviewSubmitted = async (req, res) => {
  try {
    const session = await GroupSession.findById(req.params.id)
      .populate('host', 'name profilePic');
    if (!session) return res.status(404).render('error', { message: 'Session not found' });

    res.render('user/groupReviewSubmitted', {
      session, host: session.host, currentUser: req.user,
      avatar: req.user.profilePic || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

module.exports = {
  showCreateForm,
  createGroupSession,
  getSessionDetail,
  enrollFree,
  createPaymentOrder,
  verifyPayment,
  listGroupSessions,
  cancelSession,
  endSession,
  showGroupReviewSubmitted,
};