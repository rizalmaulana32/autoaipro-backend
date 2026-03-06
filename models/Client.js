const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
  company_name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  account_limit: {
    type: Number,
    required: true,
    default: 10,
    min: 1
  },
  expiry_date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Client', ClientSchema);
