const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'system_admin', 'client_admin', 'member'],
    default: 'user'
  },
  // Link to client company (for client_admin and member roles)
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null
  },
  // Account active/suspended status
  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active'
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  last_login: {
    type: Date
  }
});

// Helper: is this user a system admin?
UserSchema.methods.isSystemAdmin = function() {
  return this.role === 'system_admin' || this.role === 'admin';
};

// Helper: is this user a client admin?
UserSchema.methods.isClientAdmin = function() {
  return this.role === 'client_admin';
};

module.exports = mongoose.model('User', UserSchema);
