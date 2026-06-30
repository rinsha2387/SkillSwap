const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/authMiddleware');
const  upload   = require('../config/upload');
const setupController = require('../controllers/profileSetupcontroller');

router.get('/setup', protect, setupController.getSetup);

router.post('/setup', protect, upload.single('profilePic'),setupController.postSetup);

router.get('/welcome', protect, setupController.getWelcome);

module.exports = router;
 