const Chat    = require('../models/chat');
const User    = require('../models/users');
const Swap    = require('../models/swapRequest');
const Session = require('../models/session');
const Review  = require('../models/reviews');


const openChat = async (req, res) => {
  try {
    const { swapId } = req.params;
    const currentUser = await User.findById(req.user._id);

    const swap = await Swap.findById(swapId)
      .populate('requester', 'name profilePic location')
      .populate('receiver',  'name profilePic location');

    if (!swap) return res.status(404).render('error', { message: 'Swap not found' });
    if (swap.status !== 'accepted' && swap.status !== 'completed')
      return res.status(403).render('error', { message: 'Chat only available for accepted or completed swaps' });

    const isParticipant =
      swap.requester._id.equals(currentUser._id) ||
      swap.receiver._id.equals(currentUser._id);
    if (!isParticipant) return res.status(403).render('error', { message: 'Not authorized' });

    // Find or create chat
    let chat = await Chat.findOne({ swap: swapId }).populate({
      path: 'messages.sender', select: 'name profilePic'
    });
    if (!chat) {
      chat = await Chat.create({
        swap: swapId,
        participants: [swap.requester._id, swap.receiver._id],
        messages: []
      });
    }

    
    const session = await Session.findOne({ swap: swapId, status: { $ne: 'cancelled' } });

    const otherUser = swap.requester._id.equals(currentUser._id)
      ? swap.receiver : swap.requester;

    const hasReviewed = !!(await Review.findOne({ reviewer: currentUser._id, swap: swapId }));

    if (swap.status === 'completed' && hasReviewed) {
      return res.redirect(`/swaps/${swapId}/completed`);
    }

    res.render('user/chat', {
      chat, swap, currentUser, otherUser, session, hasReviewed,
      avatar: currentUser.profilePic || null
    });

  } catch (err) {
    console.error('openChat error:', err);
    res.status(500).render('error', { message: 'Server error' });
  }
};


const getMyChats = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);

    const chats = await Chat.find({ participants: currentUser._id })
      .populate('swap')
      .populate('participants', 'name profilePic')
      .sort({ lastMessageAt: -1 });

    const myReviews = await Review.find({ reviewer: currentUser._id, swap: { $ne: null } }).select('swap').lean();
    const reviewedSwapIds = new Set(myReviews.map(r => r.swap.toString()));

    const filtered = chats.filter(c => {
      if (!c.swap) return true;
      return !(c.swap.status === 'completed' && reviewedSwapIds.has(c.swap._id.toString()));
    });

    res.render('user/chats', {
      chats: filtered, currentUser,
      avatar: currentUser.profilePic || null
    });
  } catch (err) {
    console.error('getMyChats error:', err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

module.exports = { openChat, getMyChats };