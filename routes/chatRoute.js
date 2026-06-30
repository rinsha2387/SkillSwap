const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { openChat, getMyChats } = require('../controllers/chatController');

// All chat routes are protected
router.use(protect);

// View all my chats
router.get('/', getMyChats);

// Open chat for a specific accepted swap
router.get('/:swapId', openChat);

module.exports = router;