const jwt = require('jsonwebtoken');
const ApiKey = require('../models/ApiKey');
const User = require('../models/User');

/**
 * Middleware to authenticate requests using either:
 * 1. JWT Bearer token (for users/extension)
 * 2. API Key via X-API-Key header (for third-party companies)
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'];

  // Try API Key authentication first
  if (apiKeyHeader) {
    try {
      const apiKey = await ApiKey.findByKey(apiKeyHeader);

      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
      }

      // Check if key is expired
      if (apiKey.isExpired()) {
        return res.status(401).json({
          success: false,
          error: 'API key has expired'
        });
      }

      // Check IP whitelist
      const clientIp = req.ip || req.connection.remoteAddress;
      if (!apiKey.isIpAllowed(clientIp)) {
        return res.status(403).json({
          success: false,
          error: 'IP address not allowed for this API key'
        });
      }

      // Record usage (async, don't wait)
      apiKey.recordUsage().catch(err => console.error('Failed to record API key usage:', err));

      // Set request context for API key authentication
      req.user = {
        userId: apiKey.created_by, // Use creator's user ID for data access
        apiKeyId: apiKey._id,
        apiKeyName: apiKey.name,
        permissions: apiKey.permissions,
        authType: 'apikey'
      };

      return next();
    } catch (error) {
      console.error('API Key authentication error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  }

  // Try JWT Bearer token authentication
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Set request context for JWT authentication
    req.user = {
      ...decoded,
      authType: 'jwt'
    };
    next();
  });
}

/**
 * Middleware to require admin role
 * Must be used after authenticateToken
 */
async function requireAdmin(req, res, next) {
  try {
    // API keys cannot access admin routes
    if (req.user.authType === 'apikey') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required. API keys cannot access this resource.'
      });
    }

    // Get user from database to check role
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // Add role to request
    req.user.role = user.role;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      error: 'Authorization check failed'
    });
  }
}

/**
 * Middleware to check specific permission
 * Must be used after authenticateToken
 */
function requirePermission(permission) {
  return (req, res, next) => {
    // JWT users have all permissions by default
    if (req.user.authType === 'jwt') {
      return next();
    }

    // Check API key permissions
    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: `Permission denied. Required: ${permission}`
      });
    }

    next();
  };
}

module.exports = authenticateToken;
module.exports.requireAdmin = requireAdmin;
module.exports.requirePermission = requirePermission;
