const express      = require('express');
const router       = express.Router();
const exploreController  = require('../controllers/exploreController');
const { protect }  = require('../middleware/authMiddleware');


router.get('/', protect, exploreController.getExplore);

module.exports = router;