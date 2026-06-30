const express = require('express');
const router = express.Router();
const passport = require("passport");

const authControllers = require('../controllers/authController');
const {redirectIfLoggedIn} = require('../middleware/authMiddleware');

router.get("/signup" , redirectIfLoggedIn, authControllers.getSignup);
router.get("/login" ,redirectIfLoggedIn, authControllers.getLogin);

router.post("/signup" , authControllers.postSignup ); 
router.post("/login", authControllers.postLogin);

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"],}));

router.get("/google/callback",passport.authenticate("google", {failureRedirect: "/auth/login",}),
  authControllers.googleCallback);

router.get("/github",passport.authenticate("github", { scope: ["user:email"] }));

router.get("/github/callback",passport.authenticate("github", {failureRedirect: "/auth/login",}),
  authControllers.githubCallback);


router.get("/logout",authControllers.logoutUser);



module.exports = router;
