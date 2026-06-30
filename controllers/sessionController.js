const Session = require('../models/session');
const Swap    = require('../models/swapRequest');
const User    = require('../models/users');

const showScheduleForm = async (req, res) => {
  try {
    const { swapId } = req.params;
    const currentUser = await User.findById(req.user._id);

    const swap = await Swap.findById(swapId)
      .populate('requester', 'name profilePic')
      .populate('receiver',  'name profilePic');

    if (!swap) return res.status(404).render('error', { message: 'Swap not found' });
    if (swap.status !== 'accepted') return res.status(403).render('error', { message: 'Swap not accepted yet' });

    const isParticipant =
      swap.requester._id.equals(currentUser._id) ||
      swap.receiver._id.equals(currentUser._id);
    if (!isParticipant) return res.status(403).render('error', { message: 'Not authorized' });

    const existing = await Session.findOne({ swap: swapId, status: { $ne: 'cancelled' } });

    const otherUser = swap.requester._id.equals(currentUser._id)
      ? swap.receiver : swap.requester;

    res.render('user/scheduleSession', {
      swap, currentUser, otherUser, existing,
      avatar: currentUser.profilePic || null
    });
  } catch (err) {
    console.error('showScheduleForm:', err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

const scheduleSession = async (req, res) => {
  try {
    const { swapId } = req.params;
    const { title, scheduledAt, duration, notes } = req.body;
    const currentUser = await User.findById(req.user._id);

    const swap = await Swap.findById(swapId);
    if (!swap) return res.status(404).render('error', { message: 'Swap not found' });

    const isParticipant =
      swap.requester.equals(currentUser._id) ||
      swap.receiver.equals(currentUser._id);
    if (!isParticipant) return res.status(403).render('error', { message: 'Not authorized' });

    const meetLink = `https://meet.jit.si/skillswap-${swapId}`;

    await Session.findOneAndUpdate(
      { swap: swapId },
      {
        swap:        swapId,
        scheduledBy: currentUser._id,
        participants:[swap.requester, swap.receiver],
        title:       title || 'Skill Swap Session',
        scheduledAt: new Date(scheduledAt),
        duration:    parseInt(duration) || 60,
        meetLink,          
        notes:       notes || '',
        status:      'upcoming'
      },
      { upsert: true, new: true }
    );

    res.redirect(`/chats/${swapId}`);
  } catch (err) {
    console.error('scheduleSession:', err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

const cancelSession = async (req, res) => {
  try {
    await Session.findOneAndUpdate({ swap: req.params.swapId }, { status: 'cancelled' });
    res.redirect(`/chats/${req.params.swapId}`);
  } catch (err) {
    res.status(500).render('error', { message: 'Server error' });
  }
};

const getSessionData = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const session = await Session.findOne({
      swap: req.params.swapId,
      status: { $ne: 'cancelled' }
    });

    if (!session) return res.json({ session: null });

    const now   = new Date();
    const start = new Date(session.scheduledAt);
    const end   = new Date(start.getTime() + session.duration * 60 * 1000);
    const isLive = now >= start && now <= end;
    const isOver = now > end;

    // Confirm user is a participant
    const isParticipant = session.participants.some(
      p => p.toString() === currentUser._id.toString()
    );

    res.json({
      session: {
        _id:         session._id,
        title:       session.title,
        scheduledAt: session.scheduledAt,
        duration:    session.duration,
        meetLink:    (isParticipant && isLive) ? session.meetLink : null,
        notes:       session.notes,
        status:      session.status,
        isLive,
        isOver
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { showScheduleForm, scheduleSession, cancelSession, getSessionData };