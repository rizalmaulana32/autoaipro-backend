const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Client = require('../models/Client');
const Property = require('../models/Property');
const authenticateToken = require('../middleware/auth');
const { requireClientAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken, requireClientAdmin);

/**
 * GET /api/client/accounts
 * List all members in caller's company
 */
router.get('/accounts', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'No company associated with this account' });
    }

    const client = await Client.findById(companyId);
    if (!client) return res.status(404).json({ success: false, error: 'Client company not found' });

    const members = await User.find({ company_id: companyId }, { password: 0 }).sort({ created_at: -1 });

    const activeCount = members.filter(m => m.status === 'active').length;
    const suspendedCount = members.filter(m => m.status === 'suspended').length;

    res.json({
      success: true,
      members,
      stats: {
        total: members.length,
        active: activeCount,
        suspended: suspendedCount,
        account_limit: client.account_limit,
        remaining: client.account_limit - members.length
      }
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get accounts' });
  }
});

/**
 * POST /api/client/accounts
 * Create a new member in the caller's company
 */
router.post('/accounts', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'No company associated with this account' });
    }

    const client = await Client.findById(companyId);
    if (!client) return res.status(404).json({ success: false, error: 'Client company not found' });

    // Check account limit
    const currentCount = await User.countDocuments({ company_id: companyId });
    if (currentCount >= client.account_limit) {
      return res.status(400).json({ success: false, error: 'Account limit reached' });
    }

    const { username, email, role, password } = req.body;
    if (!username || !email) {
      return res.status(400).json({ success: false, error: 'Username and email are required' });
    }

    const existingByUsername = await User.findOne({ username });
    if (existingByUsername) {
      return res.status(400).json({ success: false, error: 'Username already taken' });
    }
    const existingByEmail = await User.findOne({ email });
    if (existingByEmail) {
      return res.status(400).json({ success: false, error: 'Email already in use' });
    }

    // Use provided password or auto-generate
    const tempPassword = password && password.length >= 6
      ? password
      : Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: role === 'client_admin' ? 'client_admin' : 'member',
      company_id: companyId,
      status: 'active'
    });
    await user.save();

    const { password: _, ...userWithoutPassword } = user.toObject();
    res.status(201).json({ success: true, user: userWithoutPassword, temp_password: tempPassword });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ success: false, error: 'Failed to create account' });
  }
});

/**
 * PUT /api/client/accounts/:id
 * Activate or suspend a member
 */
router.put('/accounts/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, role } = req.body;

    const user = await User.findOne({ _id: req.params.id, company_id: companyId });
    if (!user) return res.status(404).json({ success: false, error: 'User not found in your company' });

    const update = {};
    if (status && ['active', 'suspended'].includes(status)) update.status = status;
    if (role && ['client_admin', 'member'].includes(role)) update.role = role;

    const updated = await User.findByIdAndUpdate(req.params.id, update, { new: true, select: '-password' });
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ success: false, error: 'Failed to update account' });
  }
});

/**
 * DELETE /api/client/accounts/:id
 * Delete a member from the company
 */
router.delete('/accounts/:id', async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Cannot delete yourself
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    const user = await User.findOne({ _id: req.params.id, company_id: companyId });
    if (!user) return res.status(404).json({ success: false, error: 'User not found in your company' });

    await Property.deleteMany({ user_id: req.params.id });
    await User.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
});

/**
 * GET /api/client/properties
 * List all properties for the caller's company members
 */
router.get('/properties', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'No company associated with this account' });
    }

    const members = await User.find({ company_id: companyId }, { _id: 1 });
    const memberIds = members.map(m => m._id);

    const { status, search, date } = req.query;
    const query = { user_id: { $in: memberIds } };

    if (status && status !== 'all') query.management_status = status;
    if (search) {
      query.$or = [
        { buildingName: { $regex: search, $options: 'i' } },
        { prefecture: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }
    if (date) {
      const from = new Date(date);
      const to = new Date(date);
      to.setDate(to.getDate() + 1);
      query.created_at = { $gte: from, $lt: to };
    }

    const properties = await Property.find(query).sort({ created_at: -1 });

    const total = await Property.countDocuments({ user_id: { $in: memberIds } });
    const pending = await Property.countDocuments({ user_id: { $in: memberIds }, management_status: 'pending' });
    const approved = await Property.countDocuments({ user_id: { $in: memberIds }, management_status: 'approved' });

    res.json({
      success: true,
      properties,
      stats: { total, pending, approved }
    });
  } catch (error) {
    console.error('Get client properties error:', error);
    res.status(500).json({ success: false, error: 'Failed to get properties' });
  }
});

/**
 * PUT /api/client/properties/:id/status
 * Update property status (approved/rejected/archived/pending)
 */
router.put('/properties/:id/status', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status } = req.body;

    const allowed = ['pending', 'approved', 'rejected', 'archived'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Verify property belongs to a member of this company
    const members = await User.find({ company_id: companyId }, { _id: 1 });
    const memberIds = members.map(m => m._id.toString());

    const property = await Property.findById(req.params.id);
    if (!property || !memberIds.includes(property.user_id.toString())) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    property.management_status = status;
    property.updated_at = Date.now();
    await property.save();

    res.json({ success: true, property });
  } catch (error) {
    console.error('Update property status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

module.exports = router;
