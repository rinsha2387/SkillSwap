const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  paid:     { type: Boolean, default: false },
  paidAt:   { type: Date },
  cashfreePaymentId: { type: String, default: null },
  joinedAt: { type: Date }
}, { _id: false });

const groupSessionSchema = new mongoose.Schema({
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  skillTaught: {
    type: String,
    required: true
  },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Beginner'
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,  
    default: 60
  },
  maxParticipants: {
    type: Number,
    default: 10
  },
  isFree: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,   
    default: 0
  },
  meetLink: {
    type: String,
    default: ''
  },
  participants: [participantSchema],
  status: {
    type: String,
    enum: ['scheduled', 'active', 'ended', 'cancelled'],
    default: 'scheduled'
  },
  tags: [String]   
}, { timestamps: true });

groupSessionSchema.virtual('spotsLeft').get(function () {
  const paid = this.participants.filter(p => p.paid || this.isFree).length;
  return Math.max(0, this.maxParticipants - paid);
});

groupSessionSchema.methods.computeStatus = function () {
  const now   = new Date();
  const start = new Date(this.scheduledAt);
  const end   = new Date(start.getTime() + this.duration * 60 * 1000);

  if (this.status === 'cancelled') return 'cancelled';
  if (this.status === 'ended') return 'ended';
  if (now < start)  return 'scheduled';
  if (now >= start && now <= end) return 'active';
  return 'ended';
};

module.exports = mongoose.model('GroupSession', groupSessionSchema);