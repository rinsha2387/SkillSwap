const express     = require('express');
const router      = express.Router();
const profileController = require('../controllers/profileController');
const { protect } = require('../middleware/authMiddleware'); 


router.get('/',     protect, profileController.getProfile);


router.get('/edit', protect, profileController.getEditProfile);

router.post('/edit', protect, profileController.uploadAvatar, profileController.postEditProfile);

router.get('/users/:id', protect, profileController.getPublicProfile);

module.exports = router;