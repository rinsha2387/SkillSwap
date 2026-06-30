exports.requireSetup = (req, res, next) => {
  if (req.user && !req.user.profileComplete) {
    return res.redirect('/profile-setup/setup');
  }
  next();
};

