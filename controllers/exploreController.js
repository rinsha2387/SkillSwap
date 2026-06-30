const Users       = require('../models/users');
const SwapRequest = require('../models/swapRequest');


exports.getExplore = async (req, res) => {
  try {
    const userId   = req.user._id;
    const { q, category, skill } = req.query;

    
    const filter = { _id: { $ne: userId }, profileComplete: true };

    
    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filter.$or = [
        { name:          regex },
        { skillsOffered: regex },
        { skillsWanted:  regex },
        { bio:           regex }
      ];
    }

    
    if (skill && skill.trim()) {
      filter.skillsOffered = new RegExp(skill.trim(), 'i');
    }

    const users = await Users.find(filter)
      .select('name profilePic bio location skillsOffered skillsWanted rating reviewCount createdAt')
      .sort({ createdAt: -1 })
      .limit(24)
      .lean();

    
    const existingSwaps = await SwapRequest.find({
      $or: [
        { requester: userId },
        { receiver:  userId }
      ],
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

    const usersWithFlag = users.map(u => {
      const id = u._id.toString();
      const existing = swapMap[id];
      return {
        ...u,
        avatar:         u.profilePic || null,
        alreadySent:    existing && existing.status === 'pending' && existing.requester,
        acceptedSwapId: existing && existing.status === 'accepted' ? existing.id : null
      };
    });

    
    const allUsers = await Users.find({}, 'skillsOffered').lean();

const skillCountMap = {};
allUsers.forEach(u => {
  (u.skillsOffered || []).forEach(skill => {
    const key = skill.trim();
    if (!key) return;
    skillCountMap[key] = (skillCountMap[key] || 0) + 1;
  });
});

const palettes = [
  { bg: '#F0EBFF', col: '#7C3AED' },
  { bg: '#E0F7F4', col: '#0D9488' },
  { bg: '#FEF9C3', col: '#CA8A04' },
  { bg: '#DCFCE7', col: '#16A34A' },
  { bg: '#DBEAFE', col: '#2563EB' },
  { bg: '#FCE7F3', col: '#DB2777' }
];

const trendingSkills = Object.entries(skillCountMap)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([name, count], i) => ({
    name,
    learners: count,
    bg:  palettes[i % palettes.length].bg,
    col: palettes[i % palettes.length].col
  }));

    const categories = ['All', 'Development', 'Design', 'Data Science', 'DevOps', 'Mobile', 'Marketing'];

    return res.render('user/explore', {
      users:   usersWithFlag,
      trendingSkills,
      categories,
      query:   q    || '',
      activeCategory: skill || category || 'All',
      activePage:'explore',
      user: req.user,
      notifCount:0
    });

  } catch (err) {
    console.error('Explore error:', err);
    return res.status(500).send('Server error');
  }
};