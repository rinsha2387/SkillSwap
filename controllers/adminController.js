const User = require('../models/users');
const SwapRequest  = require('../models/swapRequest');
const GroupSession = require('../models/groupSession');
const Review       = require('../models/reviews');


exports.dashboard = async (req, res) => {
  try {
    const totalUsers  = await User.countDocuments();
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const activeUsers = await User.countDocuments({ isBanned: false });
    const users       = await User.find().sort({ createdAt: -1 }).limit(20).lean();
    const totalSwaps = await SwapRequest.countDocuments();

    // Real monthly growth for last 6 months
    const now = new Date();
    const monthlyData = [];
    const monthlyActive = [];

    for (let i = 5; i >= 0; i--) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const [total, active] = await Promise.all([
        User.countDocuments({ createdAt: { $lt: to } }),
        User.countDocuments({ createdAt: { $lt: to }, isBanned: false })
      ]);

      monthlyData.push(total);
      monthlyActive.push(active);
    }

    res.render('admin/dashboard', {
      totalUsers,
      activeUsers,
      bannedUsers,
      totalSwaps,
      users,
      monthlyData,
      monthlyActive
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};
exports.getAllUsers = async (req, res) => {
  const users = await User.find();
  res.render('admin/users', { users });
};


exports.getBannedUsers = async (req, res) => {
  try {

    const users = await User.find({ isBanned: true });

    const totalUsers = await User.countDocuments({
      isBanned:false
    });

    res.render('admin/bannedUsers', {
      users,
      totalUsers
    });

  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
};


exports.banUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isBanned: true });

    return res.json({
      success: true,
      message: "User banned successfully"
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


exports.unbanUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isBanned: false });

    return res.json({
      success: true,
      message: "User unbanned"
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


exports.getSwaps = async (req, res) => {
  try {
    const [totalSwaps, pendingSwaps, acceptedSwaps, completedSwaps, swaps] = await Promise.all([
      SwapRequest.countDocuments(),
      SwapRequest.countDocuments({ status: 'pending' }),
      SwapRequest.countDocuments(),
      SwapRequest.countDocuments({ status: 'completed' }),
      SwapRequest.find()
        .populate('requester receiver', 'name email profilePic')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
    ]);

    res.render('admin/swaps', {
      totalSwaps,
      pendingSwaps,
      acceptedSwaps,
      completedSwaps,
      swaps
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};


exports.getSessions = async (req, res) => {
  try {
    const [totalSessions, liveSessions, scheduledSessions, endedSessions, sessions] = await Promise.all([
      GroupSession.countDocuments(),
      GroupSession.countDocuments({ status: 'active' }),
      GroupSession.countDocuments({ status: 'scheduled' }),
      GroupSession.countDocuments({ status: 'ended' }),
      GroupSession.find()
        .populate('host', 'name email profilePic')
        .sort({ scheduledAt: -1 })
        .limit(100)
        .lean()
    ]);

    res.render('admin/sessions', {
      totalSessions,
      liveSessions,
      scheduledSessions,
      endedSessions,
      sessions
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};


exports.getReviews = async (req, res) => {
  try {
    const [totalReviews, swapReviews, sessionReviews, reviews, avgResult] = await Promise.all([
      Review.countDocuments(),
      Review.countDocuments({ swap: { $ne: null } }),
      Review.countDocuments({ groupSession: { $ne: null } }),
      Review.find()
        .populate('reviewer reviewee', 'name email profilePic')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      Review.aggregate([
        { $group: { _id: null, avg: { $avg: '$rating' } } }
      ])
    ]);

    const avgRating = avgResult.length
      ? (Math.round(avgResult[0].avg * 10) / 10).toFixed(1)
      : '0.0';

    res.render('admin/reviews', {
      totalReviews,
      swapReviews,
      sessionReviews,
      avgRating,
      reviews
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};


exports.deleteReview = async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUserId = req.user._id;

    const profileUser = await User.findById(userId).lean();
    if (!profileUser) {
      return res.status(404).send('User not found');
    }
    profileUser.avatar = profileUser.profilePic || null;

    const rawRequests = await SwapRequest.find({
      $or: [
        { requester: userId },
        { receiver: userId }
      ]
    }).populate('requester receiver').sort({ createdAt: -1 }).lean();

    const recentRequests = rawRequests.map(r => {
      const isRequester = r.requester && String(r.requester._id) === String(userId);
      const otherUser = isRequester ? r.receiver : r.requester;
      if (otherUser) otherUser.avatar = otherUser.profilePic || null;
      return { ...r, otherUser };
    });

    const status = {
      completed: await SwapRequest.countDocuments({
        $or: [
          { requester: userId },
          { receiver: userId }
        ],
        status: 'completed'
      })
    };

    
    const existingRequest = await SwapRequest.findOne({
      $or: [
        { requester: currentUserId, receiver: userId },
        { requester: userId,        receiver: currentUserId }
      ]
    }).lean();

    const acceptedSwapId = existingRequest && existingRequest.status === 'accepted'
      ? existingRequest._id
      : null;

    const iSent = existingRequest
      ? String(existingRequest.requester) === String(currentUserId)
      : false;

    const reviews = await Review.find({ reviewee: userId })
      .sort({ createdAt: -1 })
      .populate('reviewer', 'name profilePic')
      .lean();

    return res.render('admin/userProfile', {
      user: profileUser,
      status,
      currentUser:    req.user,
      recentRequests,
      existingRequest,
      acceptedSwapId,
      iSent,         
      reviews
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};