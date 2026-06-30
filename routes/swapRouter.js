const express    = require('express');
const router     = express.Router();
const swapController   = require('../controllers/swapController');
const { protect } = require('../middleware/authMiddleware');


router.get('/requests',       protect, swapController.getRequests);


router.get('/requests/count', protect, swapController.getPendingCount);


router.post('/send',          protect, swapController.sendRequest);


router.post('/:id/accept',    protect, swapController.acceptRequest);
router.post('/:id/reject',    protect, swapController.rejectRequest);
router.post('/:id/cancel',    protect, swapController.cancelRequest);
router.get('/:id/completed',  protect, swapController.showCompletedPage);
router.post('/:id/complete',  protect, swapController.completeRequest);

module.exports = router;