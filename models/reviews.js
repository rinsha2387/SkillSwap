const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  swap:     { type: mongoose.Schema.Types.ObjectId, ref: 'Swap' },
  groupSession: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupSession' },
  rating:   { type: Number, min: 1, max: 5, required: true },
  comment:  { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('review', reviewSchema);