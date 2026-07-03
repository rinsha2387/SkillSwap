const SwapRequest = require('../models/swapRequest');
const Session = require('../models/session');
const Users = require('../models/users');
const Review = require('../models/reviews');

exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const [sent, received, completed, pendingSwaps] = await Promise.all([
      SwapRequest.countDocuments({ requester: userId }),
      SwapRequest.countDocuments({ receiver: userId }),
      SwapRequest.countDocuments({
        $or: [{ requester: userId }, { receiver: userId }],
        status: 'completed'
      }),
      
      SwapRequest.countDocuments({ receiver: userId, status: 'pending' })
    ]);

    
    const rawRequests = await SwapRequest.find({
      $or: [{ requester: userId }, { receiver: userId }]
    })
      .sort({ createdAt: -1 })
      .limit(10)  
      .populate('requester receiver', 'name profilePic')
      .lean();

    const recentRequests = rawRequests.map(r => {
      const isSender  = r.requester?._id?.toString() === userId.toString();
      const otherUser = isSender ? r.receiver : r.requester;
      if (otherUser) otherUser.avatar = otherUser.profilePic || null;
      return {
        otherUser,
        direction:     isSender ? 'sent' : 'received',
        skillsOffered: r.skillsOffered,
        skillsWanted:  r.skillsWanted,
        status:        r.status,
        _id:           r._id
      };
    }).filter(r => r.otherUser); 

    
    const rawSessions = await SwapRequest.find({
      $or: [{ requester: userId }, { receiver: userId }],
      status: 'accepted'
    })
      .sort({ updatedAt: -1 })
      .limit(3)
      .populate('requester receiver', 'name profilePic')
      .lean();

    const upcomingSessions = rawSessions.map(s => {
      const isRequester = s.requester?._id?.toString() === userId.toString();
      const otherUser   = isRequester ? s.receiver : s.requester;
      if (otherUser) otherUser.avatar = otherUser.profilePic || null;
      return {
        otherUser,
        skillsOffered: s.skillsOffered,
        skillsWanted:  s.skillsWanted,
        scheduledTime: s.scheduledAt || s.updatedAt || null,
        joinLink:      s.jitsiLink   || null,
        swapId:        s._id
      };
    }).filter(s => s.otherUser);

   
    const rawDiscoverUsers = await Users.find({ _id: { $ne: userId } })
      .select('_id name profilePic skillsOffered skillsWanted location city country')
      .lean();

    const ratingsAgg = await Review.aggregate([
      {
        $group: {
          _id:         '$reviewee',
          avgRating:   { $avg: '$rating' },
          reviewCount: { $sum: 1 }
        }
      }
    ]);

    const ratingsMap = {};
    ratingsAgg.forEach(r => {
      ratingsMap[r._id.toString()] = {
        avgRating:   Math.round(r.avgRating * 10) / 10,
        reviewCount: r.reviewCount
      };
    });

   
    const existingSwaps = await SwapRequest.find({
      $or: [{ requester: userId }, { receiver: userId }],
      status: { $in: ['pending', 'accepted'] }
    }).select('requester receiver status').lean();

    const swapMap = {};
    existingSwaps.forEach(s => {
      const isReq = s.requester.toString() === userId.toString();
      const other = isReq ? s.receiver.toString() : s.requester.toString();
      if (!swapMap[other] || s.status === 'accepted') {
        swapMap[other] = { status: s.status, id: s._id, requester: isReq };
      }
    });

    const discoverUsers = rawDiscoverUsers
      .map(u => {
        const ratingData = ratingsMap[u._id.toString()] || { avgRating: 0, reviewCount: 0 };
        u.avgRating   = ratingData.avgRating;
        u.reviewCount = ratingData.reviewCount;

        u.displayLocation = u.city
          ? (u.country ? `${u.city}, ${u.country}` : u.city)
          : (u.location || u.country || null);

        u.avatar = u.profilePic || null;

        const id       = u._id.toString();
        const existing = swapMap[id];
        u.alreadySent    = !!(existing && existing.status === 'pending' && existing.requester);
        u.acceptedSwapId = existing && existing.status === 'accepted' ? existing.id : null;

        return u;
      })
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 3);

   
    const allUsers = await Users.find({}, 'skillsOffered').lean();
    const skillCountMap = {};
    allUsers.forEach(u => {
      (u.skillsOffered || []).forEach(skill => {
        const key = skill.trim();
        if (!key) return;
        skillCountMap[key] = (skillCountMap[key] || 0) + 1;
      });
    });

    const trendingSkills = Object.entries(skillCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, learners: count }));

    const nextSession = upcomingSessions[0] || null;

    return res.render('user/home', {
      user: req.user,
      status: { sent, received, completed },
      recentRequests,
      upcomingSessions,
      pendingSwaps,  
      nextSession,
      discoverUsers,
      trendingSkills,
      activePage: 'home'
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).send('Server error');
  }
};