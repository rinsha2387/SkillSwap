const SwapRequest = require('../models/swapRequest');
const Users       = require('../models/users');
const chat        = require('../models/chat');
const Session     = require('../models/session');



exports.sendRequest = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { receiverId, skillsOffered, skillsWanted, message } = req.body;

    if (senderId.equals(receiverId)) {
      return res.status(400).json({ error: 'You cannot send a request to yourself.' });
    }

    
    const existing = await SwapRequest.findOne({
      requester:  senderId,
      receiver: receiverId,
      status:   'pending'
    });
    if (existing) {
      return res.status(400).json({ error: 'You already have a pending request with this user.' });
    }

    const toArray = val =>
      Array.isArray(val) ? val : (val ? val.split(',').map(s => s.trim()).filter(Boolean) : []);

    await SwapRequest.create({
      requester: senderId,
      receiver: receiverId,
      skillsOffered: toArray(skillsOffered),
      skillsWanted:  toArray(skillsWanted),
      message:  message?.trim() || '',
      status: 'pending'
    });

    
    const redirectTo = req.headers.referer || '/explore';
    return res.redirect(redirectTo);

  } catch (err) {
    console.error('sendRequest error:', err);
    return res.status(500).send('Server error');
  }
};


exports.acceptRequest = async (req, res) => {
  try {
    const swapId = req.params.id;

    // 1. Get swap request
    const swap = await SwapRequest.findById(swapId);
    if (!swap) return res.status(404).json({ message: 'Swap not found' });

    if (swap.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (swap.status !== 'pending') {
      return res.status(400).json({ message: `Already ${swap.status}` });
    }

    // 3. Create or find chat
    let chatRoom = await chat.findOne({ swap: swapId });

    if (!chatRoom) {
      chatRoom = await chat.create({
        swap: swapId,
        participants: [swap.requester, swap.receiver],
        messages: []
      });
    }

    swap.status = 'accepted';
    swap.chat = chatRoom._id;   
    await swap.save();

    return res.redirect(`/chats/${swapId}`);

  } catch (err) {
    console.error('acceptRequest error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};


exports.rejectRequest = async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id);
    if (!swap) return res.status(404).json({ error: 'Request not found.' });

    if (!swap.receiver.equals(req.user._id)) {
      return res.status(403).json({ error: 'Not authorised.' });
    }
    if (swap.status !== 'pending') {
      return res.status(400).json({ error: `Already ${swap.status}` });
    }

    swap.status = 'rejected';
    await swap.save();

    return res.redirect('/swaps/requests');
  } catch (err) {
    console.error('rejectRequest error:', err);
    return res.status(500).send('Server error');
  }
};

exports.cancelRequest = async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id);
    if (!swap) return res.status(404).json({ error: 'Request not found.' });

    if (!swap.requester.equals(req.user._id)) {
      return res.status(403).json({ error: 'Not authorised.' });
    }
    if (swap.status !== 'pending') {
      return res.status(400).json({ error: `Already ${swap.status}` });
    }

    swap.status = 'cancelled';
    await swap.save();

    return res.redirect('/swaps/requests');
  } catch (err) {
    console.error('cancelRequest error:', err);
    return res.status(500).send('Server error');
  }
};

exports.getRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    const incoming = await SwapRequest.find({ receiver: userId })
      .sort({ createdAt: -1 })
      .populate('requester', 'name profilePic skillsOffered skillsWanted location')
      .lean();

    
    const outgoing = await SwapRequest.find({ requester: userId })
      .sort({ createdAt: -1 })
      .populate('receiver', 'name profilePic skillsOffered skillsWanted location')
      .lean();

    
    const pendingCount = incoming.filter(r => r.status === 'pending').length;

   
    const freshUser = await Users.findById(userId)
      .select('name profilePic email')
      .lean();

    return res.render('user/requests', {
      incoming,
      outgoing,
      pendingCount,
      notifCount: pendingCount,
      activePage: 'swaps',
      user: freshUser || req.user
    });

     

  } catch (err) {
    console.error('getRequests error:', err);
    return res.status(500).send('Server error');
  }
};

 
exports.getPendingCount = async (req, res) => {
  try {
    const count = await SwapRequest.countDocuments({
      receiver: req.user._id,
      status:   'pending'
    });
    return res.json({ count });
  } catch (err) {
    return res.status(500).json({ count: 0 });
  }
};

exports.showCompletedPage = async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id)
      .populate('requester receiver', 'name profilePic');
    if (!swap) return res.status(404).render('error', { message: 'Swap not found' });

    const isParticipant = swap.requester._id.equals(req.user._id) || swap.receiver._id.equals(req.user._id);
    if (!isParticipant) return res.status(403).render('error', { message: 'Not authorized' });

    const otherUser = swap.requester._id.equals(req.user._id) ? swap.receiver : swap.requester;

    res.render('user/swapCompleted', {
      swap, otherUser, currentUser: req.user,
      avatar: req.user.profilePic || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

exports.completeRequest = async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id);
    if (!swap) return res.status(404).json({ error: 'Swap not found' });
    if (swap.status !== 'accepted')
      return res.status(400).json({ error: 'Only accepted swaps can be completed' });

    const isParticipant = swap.requester.equals(req.user._id) || swap.receiver.equals(req.user._id);
    if (!isParticipant) return res.status(403).json({ error: 'Not authorized' });

    swap.status = 'completed';
    await swap.save();

    const session = await Session.findOne({ swap: swap._id, status: { $ne: 'cancelled' } });
    if (session) {
      session.status = 'completed';
      await session.save();
    }

    res.redirect(`/chats/${swap._id}`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};