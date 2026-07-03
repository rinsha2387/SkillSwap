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

router.get('/:swapId/schedule',  showScheduleForm);
router.post('/:swapId/schedule', scheduleSession);

router.post('/:swapId/cancel', cancelSession);

router.get('/:swapId/data', getSessionData);

module.exports = router;