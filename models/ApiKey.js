const mongoose = require('mongoose');
const crypto = require('crypto');

const ApiKeySchema = new mongoose.Schema({
  // The API key itself (hashed for security)
  key_hash: {
    type: String,
    required: true,
    unique: true
  },
  // A prefix for identification (e.g., "ak_" + first 8 chars)
  key_prefix: {
    type: String,
    required: true
  },
  // Human-readable name for this API key
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Description of what this key is used for
  description: {
    type: String,
    trim: true
  },
  // Company or organization this key belongs to
  company: {
    type: String,
    trim: true
  },
  // User ID of the admin who created this key
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Permissions/scopes for this API key
  permissions: {
    type: [String],
    default: ['properties:read', 'properties:write']
  },
  // Whether this key is active
  is_active: {
    type: Boolean,
    default: true
  },
  // Optional expiration date
  expires_at: {
    type: Date
  },
  // Last used timestamp
  last_used_at: {
    type: Date
  },
  // Usage count
  usage_count: {
    type: Number,
    default: 0
  },
  // IP whitelist (optional - empty means all IPs allowed)
  ip_whitelist: {
    type: [String],
    default: []
  },
  // Rate limit (requests per hour, 0 = unlimited)
  rate_limit: {
    type: Number,
    default: 1000
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
ApiKeySchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

/**
 * Generate a new API key
 * Returns: { key: 'ak_xxxxx...', keyHash: 'hashed_value', keyPrefix: 'ak_xxxxxxxx' }
 */
ApiKeySchema.statics.generateKey = function() {
  // Generate 32 random bytes and convert to base64
  const randomBytes = crypto.randomBytes(32);
  const key = 'ak_' + randomBytes.toString('base64url');

  // Create hash for storage
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  // Create prefix for identification (ak_ + first 8 chars after prefix)
  const keyPrefix = key.substring(0, 11); // 'ak_' + 8 chars

  return { key, keyHash, keyPrefix };
};

/**
 * Hash a key for comparison
 */
ApiKeySchema.statics.hashKey = function(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
};

/**
 * Find API key by raw key value
 */
ApiKeySchema.statics.findByKey = async function(key) {
  const keyHash = this.hashKey(key);
  return this.findOne({ key_hash: keyHash, is_active: true });
};

/**
 * Check if key is expired
 */
ApiKeySchema.methods.isExpired = function() {
  if (!this.expires_at) return false;
  return new Date() > this.expires_at;
};

/**
 * Check if IP is allowed
 */
ApiKeySchema.methods.isIpAllowed = function(ip) {
  if (!this.ip_whitelist || this.ip_whitelist.length === 0) return true;
  return this.ip_whitelist.includes(ip);
};

/**
 * Record usage
 */
ApiKeySchema.methods.recordUsage = async function() {
  this.last_used_at = new Date();
  this.usage_count += 1;
  await this.save();
};

module.exports = mongoose.model('ApiKey', ApiKeySchema);
