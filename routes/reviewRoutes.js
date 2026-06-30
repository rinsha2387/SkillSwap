const express      = require('express');
const router       = express.Router();
const { protect }  = require('../middleware/authMiddleware');
const SwapRequest  = require('../models/SwapRequest'); 
const Review       = require('../models/reviews');      
const { showWriteForm, showWriteFormGroup, submitReview } = require('../controllers/reviewController');

router.use(protect);

router.get('/write/:swapId',        showWriteForm);
router.get('/write/group/:groupId', showWriteFormGroup);
router.post('/',                    submitReview);


router.get('/swaps/:swapId/completed', async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.swapId)
      .populate('requester receiver', 'name profilePic');

    if (!swap) return res.status(404).render('error', { message: 'Swap not found' });

    const currentUser = req.user;
    const otherUser   = swap.requester._id.toString() === currentUser._id.toString()
      ? swap.receiver
      : swap.requester;

    const hasReviewed = await Review.findOne({
      reviewer: currentUser._id,
      swap:     swap._id
    });

    res.render('user/swapCompleted', {
      swap,
      otherUser,
      currentUser,
      hasReviewed: !!hasReviewed
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
});

module.exports = router;