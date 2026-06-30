const User = require('../models/users');
const cloudinary = require('../config/cloudinary');
const path = require('path');
const multer = require('multer');


function validateProfileData({ name, location, skillsOffered, skillsWanted, from, to, github, linkedin, twitter }, file) {
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

  offered.forEach(s => {
    if (s.length > 50) errors.push(`Skill "${s}" is too long (max 50 chars).`);
  });
  wanted.forEach(s => {
    if (s.length > 50) errors.push(`Skill "${s}" is too long (max 50 chars).`);
  });

 
  if (from && to) {
    if (from >= to) errors.push('Availability "from" time must be before "to" time.');
  }

  
  const urlFields = { GitHub: github, LinkedIn: linkedin };
  const urlPattern = /^https?:\/\/.+\..+/i;

  Object.entries(urlFields).forEach(([label, val]) => {
    if (val && val.trim() && !urlPattern.test(val.trim())) {
      errors.push(`${label} must be a valid URL (starting with http:// or https://).`);
    }
  });

  
  if (file) {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.jfif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      errors.push('Profile photo must be a JPG, PNG, or WebP image.');
    }
    if (file.size > 5 * 1024 * 1024) {
      errors.push('Profile photo must be smaller than 5 MB.');
    }
  }

  return errors;
}

exports.getSetup = async (req, res) => {
  try {
    if (req.user.profileComplete) return res.redirect('/');
    res.render('user/profile-setup', { user: req.user, errors: [] });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};


exports.postSetup = async(req, res) => {
  try {
    const {
      name, bio,profilePic, location,
      skillsOffered, skillsWanted,
      github, linkedin,
    } = req.body;
    const days = req.body.availability?.days || '';
    const from = req.body.availability?.from || '';
    const to = req.body.availability?.to || '';
       
    const errors = validateProfileData(
      { name, location, skillsOffered, skillsWanted, from, to, github, linkedin },
        req.file
      );

    if (errors.length > 0) {
      return res.status(422).render('user/profile-setup', {
        user: req.user,
        errors,
        formData: req.body,  
      });
      }
      const parsedDays = days? days.split(',').map(d => d.trim().toLowerCase()): [];

    if (parsedDays.length === 0) {
        errors.push('Please select at least one availability day.');
    }
    
    const updateData = {
      name: name.trim(),
      bio: bio?.trim() || '',
      location: location?.trim() || '',
      skillsOffered: skillsOffered ? skillsOffered.split(',').map(s => s.trim()).filter(Boolean): [],
      skillsWanted: skillsWanted ? skillsWanted.split(',').map(s => s.trim()).filter(Boolean): [],
      availability: {
      days: parsedDays,
      from,
      to,
    },
    verifications: {
     githubUrl: github?.trim() || '',
     linkedinUrl: linkedin?.trim() || ''
    },
    profileComplete: true,
};
    
   if (!parsedDays || parsedDays.length === 0) {
       errors.push('Select at least one availability day.');
    }   
    if (req.file) {
     updateData.profilePic = req.file.path; 
    }
     console.log(req.body);
    await User.findByIdAndUpdate(req.user._id, updateData, { new: true });
    res.redirect('/profile-setup/welcome');

  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};


exports.getWelcome = async (req, res) => {
  try {

    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    res.render('user/welcome', {
      user
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};