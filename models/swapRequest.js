const mongoose = require('mongoose');

const swapSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },

  receiver: {
   type: mongoose.Schema.Types.ObjectId,
     ref: 'user',
      required: true
  },

  skillsOffered: {
    type: [String],
    default: []
  },

  skillsWanted: {
    type: [String],
    default: []
  },

  message: {
    type: String,
    default: ''
  },

  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.models.Swap || mongoose.model("Swap", swapSchema);