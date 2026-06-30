const jwt = require('jsonwebtoken');
const User = require('../models/users');




exports.protect = async (req,res, next) => {
    try{
      const token = req.cookies.token;
      if(!token ) return res.redirect('/auth/login');

      const decode  = jwt.verify(token, process.env.JWT_SECRET )
      const user =await  User.findById(decode.id).select('-password');

      if(!user || user.isBanned){
       res.clearCookie('token');
       return res.redirect('/auth/login');
    }
    req.user = user;
    res.locals.user = user;  
     next();
    }catch(err){
        console.error("AUTH ERROR:", err); 
        res.clearCookie('token');
        res.redirect('/auth/login');
        
    }
};

exports.adminOnly= (req,res,next) =>{
  if(req.user && req.user.role === 'admin')return next();
  res.status(403).render('error', {message:'Admin access only'});
};

exports.redirectIfLoggedIn = (req,res,next) =>{
  const token = req.cookies.token
  if(token) {
    try{
      jwt.verify(token, process.env.JWT_SECRET);
      return res.redirect('/dashboard');
    }catch{}
  }
  next();
};
