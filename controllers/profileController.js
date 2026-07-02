const User        = require('../models/users');
const cloudinary  = require('../config/cloudinary');
const multer      = require('multer');
const path        = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const SwapRequest = require('../models/swapRequest');
const Review      = require('../models/reviews');


const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder:         'skillswap/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'jfif'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } 
});


exports.uploadAvatar = upload.single('avatar');


function validateEditData({ name, location, skillsOffered, skillsWanted, from, to, github }, file) {
  const errors = [];

  if (!name || !name.trim()) {
    errors.push('Name is required.');
  } else if (name.trim().length < 2) {
    errors.push('Name must be at least 2 characters.');
  } else if (name.trim().length > 50) {
    errors.push('Name must be 50 characters or fewer.');
  }

  if (location && location.trim().length > 100) {
    errors.push('Location must be 100 characters or fewer.');
  }

  const offered = skillsOffered ? skillsOffered.split(',').map(s => s.trim()).filter(Boolean) : [];
  const wanted  = skillsWanted  ? skillsWanted.split(',').map(s => s.trim()).filter(Boolean)  : [];

  if (offered.length > 10) errors.push('You can list at most 10 skills offered.');
  if (wanted.length  > 10) errors.push('You can list at most 10 skills wanted.');

  offered.forEach(s => { if (s.length > 50) errors.push(`Skill "${s}" is too long (max 50 chars).`); });
  wanted.forEach(s  => { if (s.length > 50) errors.push(`Skill "${s}" is too long (max 50 chars).`); });

  if (from && to && from >= to) {
    errors.push('Availability "from" time must be before "to" time.');
  }

  const urlPattern = /^https?:\/\/.+\..+/i;
  if (github && github.trim() && !urlPattern.test(github.trim())) {
    errors.push('GitHub must be a valid URL (starting with http:// or https://).');
  }

  if (file) {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.jfif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) errors.push('Profile photo must be a JPG, PNG, or WebP image.');
    if (file.size > 5 * 1024 * 1024) errors.push('Profile photo must be smaller than 5 MB.');
  }

  return errors;
}

exports.getPublicProfile = async (req, res) => {
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
     }).populate('requester receiver', 'name profilePic').sort({ createdAt: -1 }).lean();

    const recentRequests = rawRequests.map(function(r) {
      const isRequester = r.requester && r.requester._id.toString() === userId.toString();
      const otherUser   = isRequester ? r.receiver : r.requester;
      if (otherUser) otherUser.avatar = otherUser.profilePic || null;
      return {
       ...r,
      otherUser
     };
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

   reviews.forEach(function(r) {
     if (r.reviewer) r.reviewer.avatar = r.reviewer.profilePic || null;
   });

    return res.render('user/publicProfile', {
      user: req.user,       
      profileUser: profileUser,
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


exports.getProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    
    const [sent, received, completed] = await Promise.all([
      SwapRequest.countDocuments({ requester: userId }),
      SwapRequest.countDocuments({ receiver: userId }),
      SwapRequest.countDocuments({
        $or: [{ requester : userId }, { receiver: userId }],
        status: 'completed'
      })
    ]);

    
    const rawRequests = await SwapRequest.find({
      $or: [{ requester : userId }, { receiver: userId }]
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('requester receiver', 'name profilePic');

    const recentRequests = rawRequests.map(r => {
      const isSender = r.requester?._id?.equals(userId);
      return {
        otherUser: isSender ? r.receiver : r.requester,
        direction:  isSender ? 'sent' : 'received',
        skillsOffered: r.skillsOffered,
        skillsWanted: r.skillsWanted,
        status:   r.status,
        createdAt:  r.createdAt
      };
    }).filter(Boolean);

    
    let reviews = [];
    try {
      reviews = await Review.find({ reviewee: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('reviewer', 'name profilePic')
        .lean();
    } catch (e) {
      console.error('Reviews fetch error:', e.message);
      reviews = [];
     
    }

   
    const freshUser = await User.findById(userId)
      .select('name profilePic bio location skillsOffered skillsWanted availability rating reviewCount createdAt email phone verifications')
      .lean();

    
    freshUser.avatar = freshUser.profilePic || null;

    
    freshUser.availability = freshUser.availability || {
    days: [],
    from: '',
    to: ''
    };

    
    return res.render('user/profile', {
      user: freshUser,
      profileUser: freshUser, 
      status:{ sent, received, completed },
      recentRequests,
      reviews,
      activePage: 'profile'
    });

  } catch (err) {
    console.error('Profile GET error:', err);
    return res.status(500).send('Server error');
  }
};


exports.getEditProfile = async (req, res) => {
  try {
    const freshUser = await User.findById(req.user._id)
      .select('name profilePic bio location skillsOffered skillsWanted availability email phone verifications')
      .lean();

    freshUser.avatar = freshUser.profilePic || null;

    return res.render('user/editProfile', {
      user:  freshUser,
      errors:   [],
      activePage: 'profile'
    });
  } catch (err) {
    console.error('Edit profile GET error:', err);
    return res.status(500).send('Server error');
  }
};


exports.postEditProfile = async (req, res) => {
  try {
    const userId = req.user._id;

   const {
     name, bio, location,
     skillsOffered, skillsWanted,
    github,linkedin
    } = req.body;

    const days = req.body.availability?.days || '';
    const from = req.body.availability?.from || '';
    const to = req.body.availability?.to || '';
    
    const errors = validateEditData(
      { name, location, skillsOffered, skillsWanted, from, to, github },
      req.file
    );

    if (errors.length > 0) {
      const freshUser = await User.findById(userId)
        .select('name profilePic bio location skillsOffered skillsWanted availability email phone verifications')
        .lean();
      freshUser.avatar = freshUser.profilePic || null;

      return res.status(422).render('user/editProfile', {
        user: freshUser,
        errors,
        formData:req.body,
        activePage: 'profile'
      });
    }

    const updateData = {
      name: name.trim(),
      bio:   bio?.trim()      || '',
      location:  location?.trim() || '',
      skillsOffered: skillsOffered ? skillsOffered.split(',').map(s => s.trim()).filter(Boolean) : [],
      skillsWanted:  skillsWanted  ? skillsWanted.split(',').map(s => s.trim()).filter(Boolean)  : [],
      availability: {
      days: days ? days.split(',').map(d => d.trim().toLowerCase()).filter(Boolean): [],
      from: from || '',
      to: to || ''
     },
      'verifications.githubUrl': github?.trim() || '',
      'verifications.linkedinUrl': linkedin?.trim() || ''
    };

    
    if (req.file) {
      updateData.profilePic = req.file.path;
    }

    await User.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true });

    return res.redirect('/profile');

  } catch (err) {
    console.error('Edit profile POST error:', err);
    return res.status(500).send('Server error');
  }
};