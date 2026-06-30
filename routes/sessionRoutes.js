const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  showScheduleForm,
  scheduleSession,
  cancelSession,
  getSessionData
} = require('../controllers/sessionController');

router.use(protect);

// Schedule form
router.get('/:swapId/schedule',  showScheduleForm);
router.post('/:swapId/schedule', scheduleSession);

// Cancel
router.post('/:swapId/cancel', cancelSession);

// JSON data for chat header
router.get('/:swapId/data', getSessionData);

module.exports = router;