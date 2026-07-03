const mongoose = require('mongoose');

function generateJitsiLink(swapId) {
  return `https://meet.jit.si/skillswap-${swapId}`;
}

const sessionSchema = new mongoose.Schema({
  swap: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Swap',
    required: true
  },
  scheduledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  }],
  title: {
    type: String,
    default: 'Skill Swap Session'
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, 
    default: 60
  },
  meetLink: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed', 'cancelled'],
    default: 'upcoming'
  }
}, { timestamps: true });

sessionSchema.statics.generateJitsiLink = generateJitsiLink;

module.exports = mongoose.model('Session', sessionSchema);