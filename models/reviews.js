const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  swap:     { type: mongoose.Schema.Types.ObjectId, ref: 'Swap' },
  groupSession: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupSession' },
  rating:   { type: Number, min: 1, max: 5, required: true },
  comment:  { type: String, default: '' }
}, { timestamps: true });


reviewSchema.index(
  { reviewer: 1, swap: 1 },
  { unique: true, sparse: true }
);

reviewSchema.index(
  { reviewer: 1, groupSession: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model('review', reviewSchema);