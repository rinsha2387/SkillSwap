const Review = require('../models/reviews');
const Swap   = require('../models/swapRequest');
const GroupSession = require('../models/groupSession');
const User   = require('../models/users');

const showWriteForm = async (req, res) => {
  try {
    const { swapId } = req.params;
    const swap = await Swap.findById(swapId)
      .populate('requester receiver', 'name profilePic');
    if (!swap) return res.status(404).render('error', { message: 'Swap not found' });

    if (swap.status !== 'completed')
      return res.status(400).render('error', { message: 'Swap must be completed before reviewing' });

    const isParticipant = swap.requester._id.equals(req.user._id) || swap.receiver._id.equals(req.user._id);
    if (!isParticipant)
      return res.status(403).render('error', { message: 'Not a participant of this swap' });

    const reviewee = swap.requester._id.equals(req.user._id) ? swap.receiver : swap.requester;

    const existing = await Review.findOne({ reviewer: req.user._id, swap: swap._id });
    if (existing)
      return res.redirect(`/swaps/${swap._id}/completed`);

    res.render('user/writeReview', {
      swap, reviewee, isGroup: false,
      currentUser: req.user,
      avatar: req.user.profilePic || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

const showWriteFormGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const session = await GroupSession.findById(groupId).populate('host', 'name profilePic');
    if (!session) return res.status(404).render('error', { message: 'Session not found' });

    if (session.status !== 'ended')
      return res.status(400).render('error', { message: 'Session must end before reviewing' });

    const isEnrolled = session.participants.some(p => p.user.equals(req.user._id));
    const isHost = session.host._id.equals(req.user._id);
    if (!isEnrolled && !isHost)
      return res.status(403).render('error', { message: 'Not a participant of this session' });

    const existing = await Review.findOne({ reviewer: req.user._id, groupSession: session._id });
    if (existing)
      return res.redirect(`/group-sessions/${session._id}?reviewed=1`);

    res.render('user/writeReview', {
      groupSession: session, reviewee: session.host, isGroup: true,
      currentUser: req.user,
      avatar: req.user.profilePic || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

const submitReview = async (req, res) => {
  try {
    console.log('REVIEW SUBMIT BODY:', req.body);
    const { reviewee, rating, comment } = req.body;
    const swap         = req.body.swap         || null;
    const groupSession = req.body.groupSession || null;

    if (!rating || rating < 1 || rating > 5)
      return res.status(400).render('error', { message: 'Rating must be between 1 and 5' });

   
    if (swap) {
      const swapDoc = await Swap.findById(swap);
      if (!swapDoc)
        return res.status(400).render('error', { message: 'Swap not found' });
      
      if (swapDoc.status !== 'accepted' && swapDoc.status !== 'completed')
        return res.status(400).render('error', { message: 'Swap not completed' });
    }

    if (groupSession) {
      const gs = await GroupSession.findById(groupSession);
      if (!gs || gs.status !== 'ended')
        return res.status(400).render('error', { message: 'Session not ended' });
    }

    
    const existing = await Review.findOne({
      reviewer: req.user._id,
      ...(swap ? { swap } : { groupSession })
    });

    if (existing) {
      if (swap)         return res.redirect(`/swaps/${swap}/completed`);
      if (groupSession) return res.redirect(`/group-sessions/${groupSession}/review-submitted`);
      return res.redirect('/dashboard');
    }

    
 const doc = {
  reviewer: req.user._id,
  reviewee,
  rating:  Number(rating),
  comment: comment || ''
   };
    if (swap)         doc.swap         = swap;
    if (groupSession) doc.groupSession = groupSession;
    await Review.create(doc);

    const stats = await Review.aggregate([
      { $match: { reviewee: new (require('mongoose').Types.ObjectId)(reviewee) } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    const avg = stats.length ? Math.round(stats[0].avgRating * 10) / 10 : 0;
    const cnt = stats.length ? stats[0].count : 0;
    await User.findByIdAndUpdate(reviewee, { rating: avg, reviewCount: cnt });

    if (swap)          return res.redirect(`/swaps/${swap}/completed`);
    if (groupSession)  return res.redirect(`/group-sessions/${groupSession}/review-submitted`);
    return res.redirect('/dashboard');

  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

module.exports = { showWriteForm, showWriteFormGroup, submitReview };