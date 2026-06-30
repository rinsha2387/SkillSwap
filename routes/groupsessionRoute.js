const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  showCreateForm, createGroupSession, getSessionDetail,
  enrollFree, createPaymentOrder, verifyPayment,
  listGroupSessions, cancelSession, endSession,
  showGroupReviewSubmitted
} = require('../controllers/groupSessionController');

router.use(protect);

router.get('/new',          showCreateForm);
router.post('/new',         createGroupSession);
router.get('/',             listGroupSessions);         
router.get('/:id',          getSessionDetail);
router.post('/:id/enroll',  enrollFree);                
router.post('/:id/create-order',    createPaymentOrder); 
router.post('/:id/verify-payment',  verifyPayment);      
router.post('/:id/cancel',  cancelSession);
router.post('/:id/end',     endSession);
router.get('/:id/review-submitted', showGroupReviewSubmitted);

module.exports = router;