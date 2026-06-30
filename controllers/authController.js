const User = require('../models/users');
const jwt = require('jsonwebtoken');

const generateToken = (id, role) =>{
    return jwt.sign({id,role}, process.env.JWT_SECRET,{expiresIn:'7d'});
}
    
exports.getSignup = (req, res) => {
  res.render('auth/signup', { error: null });
}; 

exports.postSignup = async (req, res) => {
  try {
    console.log("BODY RECEIVED:", req.body);
    const { name, email, password ,terms} = req.body;
     
    if (!terms) {
      return res.status(400).render('auth/signup', {
      error: 'You must accept Terms of Service and Privacy Policy',
      formData: req.body
      });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.render('auth/signup', { error: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });
     
     console.log("USER CREATED:", user);

    const token = generateToken(user._id, user.role);
    
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 ,sameSite:'lax'});
    res.redirect('/profile-setup/setup');
    }catch(err) {
    console.error(err);
    res.render('auth/signup', { error: 'Something went wrong. Try again.' });
  }
};

exports.getLogin = (req, res) => {
  res.render('auth/login', { error: null });
};


exports.postLogin = async (req, res) => {
  try{
     const { email, password } = req.body;
    const user = await User.findOne({ email });
    if(!user){
      return res.render('auth/login', { error: 'Invalid email or password' });
    }

    if(user.isBanned){
      return res.render('auth/login', { error: 'Your account has been banned.' });
    }

    const isMatch = await user.comparePassword(password);
    if(!isMatch){
      return res.render('auth/login', { error: 'Invalid email or password' });
    }

    const token = generateToken(user._id, user.role);
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 ,sameSite:'lax'});

      if(user.role === 'admin'){
        return res.redirect('/admin/dashboard')
      };

      if (!user.profileComplete){
        return res.redirect('/profile-setup/setup')
      }; 
        
        res.redirect('/home');
  }catch(err){
    console.error(err);
      res.render('auth/login', { error: 'Something went wrong. Try again.' });
  }
  
};


exports.googleCallback = async (req, res) => {
  const token = generateToken(req.user._id, req.user.role);
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
  if (!req.user.profileComplete) {
    return res.redirect('/profile-setup/setup');
  }
  res.redirect('/home');
};

exports.githubCallback = async (req, res) => {
  const token = generateToken(req.user._id, req.user.role);
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
  if (!req.user.profileComplete) {
    return res.redirect('/profile-setup/setup');
  }
  res.redirect('/home');
};

exports.logoutUser = (req, res) => {
 res.clearCookie('token');
  res.redirect('/auth/login');

};

