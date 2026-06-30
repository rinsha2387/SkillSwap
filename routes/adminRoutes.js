const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const {protect} = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.get('/dashboard', protect, adminMiddleware, adminController.dashboard);

router.get('/users', protect, adminMiddleware, adminController.getAllUsers);
router.get('/bannedUsers',protect,adminMiddleware, adminController.getBannedUsers);
router.get('/swaps',    protect, adminMiddleware, adminController.getSwaps);
router.get('/sessions', protect, adminMiddleware, adminController.getSessions);
router.get('/reviews',  protect, adminMiddleware, adminController.getReviews);
 
router.post('/reviews/:id/delete',protect,adminMiddleware, adminController.deleteReview);

router.post('/users/:id/ban',protect,adminMiddleware,adminController.banUser);
router.post('/users/:id/unban', protect, adminMiddleware, adminController.unbanUser);

router.get('/users/:id', protect, adminController.getUserProfile);

module.exports = router;

