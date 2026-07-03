const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { openChat, getMyChats } = require('../controllers/chatController');

router.use(protect);

router.get('/', getMyChats);

router.get('/:swapId', openChat);

module.exports = router;