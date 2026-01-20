const express = require('express');
const { body, validationResult } = require('express-validator');
const ApiKey = require('../models/ApiKey');
const authenticateToken = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/apikeys:
 *   post:
 *     summary: Create a new API key (Admin only)
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Company ABC API Key
 *               description:
 *                 type: string
 *                 example: API key for Company ABC integration
 *               company:
 *                 type: string
 *                 example: Company ABC
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["properties:read", "properties:write"]
 *               expires_in_days:
 *                 type: integer
 *                 example: 365
 *               ip_whitelist:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["192.168.1.1", "10.0.0.0/8"]
 *               rate_limit:
 *                 type: integer
 *                 example: 1000
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 api_key:
 *                   type: string
 *                   description: The raw API key (only shown once!)
 *                 key_info:
 *                   type: object
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */
router.post('/',
  authenticateToken,
  requireAdmin,
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { name, description, company, permissions, expires_in_days, ip_whitelist, rate_limit } = req.body;

      // Generate new API key
      const { key, keyHash, keyPrefix } = ApiKey.generateKey();

      // Calculate expiration date if provided
      let expiresAt = null;
      if (expires_in_days && expires_in_days > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expires_in_days);
      }

      // Create API key record
      const apiKey = new ApiKey({
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name,
        description,
        company,
        created_by: req.user.userId,
        permissions: permissions || ['properties:read', 'properties:write'],
        expires_at: expiresAt,
        ip_whitelist: ip_whitelist || [],
        rate_limit: rate_limit || 1000
      });

      await apiKey.save();

      console.log(`✅ API Key created: ${keyPrefix}... for ${company || name}`);

      res.status(201).json({
        success: true,
        message: 'API key created successfully. Save the key now - it will not be shown again!',
        api_key: key, // Only time the full key is returned
        key_info: {
          id: apiKey._id,
          key_prefix: keyPrefix,
          name: apiKey.name,
          company: apiKey.company,
          permissions: apiKey.permissions,
          expires_at: apiKey.expires_at,
          rate_limit: apiKey.rate_limit,
          created_at: apiKey.created_at
        }
      });
    } catch (error) {
      console.error('Create API key error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create API key'
      });
    }
  }
);

/**
 * @swagger
 * /api/apikeys:
 *   get:
 *     summary: List all API keys (Admin only)
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *       403:
 *         description: Admin access required
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const apiKeys = await ApiKey.find()
      .select('-key_hash') // Never expose the hash
      .sort({ created_at: -1 })
      .populate('created_by', 'username email');

    res.json({
      success: true,
      count: apiKeys.length,
      api_keys: apiKeys.map(key => ({
        id: key._id,
        key_prefix: key.key_prefix,
        name: key.name,
        description: key.description,
        company: key.company,
        permissions: key.permissions,
        is_active: key.is_active,
        expires_at: key.expires_at,
        last_used_at: key.last_used_at,
        usage_count: key.usage_count,
        rate_limit: key.rate_limit,
        ip_whitelist: key.ip_whitelist,
        created_by: key.created_by,
        created_at: key.created_at
      }))
    });
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list API keys'
    });
  }
});

/**
 * @swagger
 * /api/apikeys/{id}:
 *   get:
 *     summary: Get API key details (Admin only)
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key details
 *       404:
 *         description: API key not found
 *       403:
 *         description: Admin access required
 */
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const apiKey = await ApiKey.findById(req.params.id)
      .select('-key_hash')
      .populate('created_by', 'username email');

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    res.json({
      success: true,
      api_key: {
        id: apiKey._id,
        key_prefix: apiKey.key_prefix,
        name: apiKey.name,
        description: apiKey.description,
        company: apiKey.company,
        permissions: apiKey.permissions,
        is_active: apiKey.is_active,
        expires_at: apiKey.expires_at,
        last_used_at: apiKey.last_used_at,
        usage_count: apiKey.usage_count,
        rate_limit: apiKey.rate_limit,
        ip_whitelist: apiKey.ip_whitelist,
        created_by: apiKey.created_by,
        created_at: apiKey.created_at,
        updated_at: apiKey.updated_at
      }
    });
  } catch (error) {
    console.error('Get API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get API key'
    });
  }
});

/**
 * @swagger
 * /api/apikeys/{id}:
 *   put:
 *     summary: Update API key (Admin only)
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               company:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_active:
 *                 type: boolean
 *               ip_whitelist:
 *                 type: array
 *                 items:
 *                   type: string
 *               rate_limit:
 *                 type: integer
 *     responses:
 *       200:
 *         description: API key updated
 *       404:
 *         description: API key not found
 *       403:
 *         description: Admin access required
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const apiKey = await ApiKey.findById(req.params.id);

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['name', 'description', 'company', 'permissions', 'is_active', 'ip_whitelist', 'rate_limit'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        apiKey[field] = req.body[field];
      }
    });

    await apiKey.save();

    console.log(`✅ API Key updated: ${apiKey.key_prefix}...`);

    res.json({
      success: true,
      message: 'API key updated successfully',
      api_key: {
        id: apiKey._id,
        key_prefix: apiKey.key_prefix,
        name: apiKey.name,
        description: apiKey.description,
        company: apiKey.company,
        permissions: apiKey.permissions,
        is_active: apiKey.is_active,
        rate_limit: apiKey.rate_limit,
        updated_at: apiKey.updated_at
      }
    });
  } catch (error) {
    console.error('Update API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update API key'
    });
  }
});

/**
 * @swagger
 * /api/apikeys/{id}/revoke:
 *   post:
 *     summary: Revoke (deactivate) an API key (Admin only)
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key revoked
 *       404:
 *         description: API key not found
 *       403:
 *         description: Admin access required
 */
router.post('/:id/revoke', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const apiKey = await ApiKey.findById(req.params.id);

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    apiKey.is_active = false;
    await apiKey.save();

    console.log(`🚫 API Key revoked: ${apiKey.key_prefix}... (${apiKey.company || apiKey.name})`);

    res.json({
      success: true,
      message: 'API key revoked successfully',
      api_key: {
        id: apiKey._id,
        key_prefix: apiKey.key_prefix,
        name: apiKey.name,
        is_active: apiKey.is_active
      }
    });
  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke API key'
    });
  }
});

/**
 * @swagger
 * /api/apikeys/{id}:
 *   delete:
 *     summary: Delete an API key permanently (Admin only)
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key deleted
 *       404:
 *         description: API key not found
 *       403:
 *         description: Admin access required
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const apiKey = await ApiKey.findById(req.params.id);

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    await ApiKey.deleteOne({ _id: apiKey._id });

    console.log(`🗑️ API Key deleted: ${apiKey.key_prefix}... (${apiKey.company || apiKey.name})`);

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete API key'
    });
  }
});

/**
 * @swagger
 * /api/apikeys/verify:
 *   get:
 *     summary: Verify an API key (for third-party testing)
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: API key is valid
 *       401:
 *         description: Invalid API key
 */
router.get('/verify/status', authenticateToken, async (req, res) => {
  // If we reach here, authentication was successful
  if (req.user.authType === 'apikey') {
    res.json({
      success: true,
      message: 'API key is valid',
      key_info: {
        name: req.user.apiKeyName,
        permissions: req.user.permissions
      }
    });
  } else {
    res.json({
      success: true,
      message: 'JWT token is valid',
      user: {
        userId: req.user.userId,
        username: req.user.username
      }
    });
  }
});

module.exports = router;
