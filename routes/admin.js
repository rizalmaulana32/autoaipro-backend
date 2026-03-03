const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Property = require('../models/Property');
const authenticateToken = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/users
 * List all users
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ created_at: -1 });

    // Get property count per user
    const propertyCounts = await Property.aggregate([
      { $group: { _id: '$user_id', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    propertyCounts.forEach((item) => {
      countMap[item._id.toString()] = item.count;
    });

    const usersWithCount = users.map((user) => ({
      ...user.toObject(),
      property_count: countMap[user._id.toString()] || 0
    }));

    res.json({ success: true, users: usersWithCount });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
});

/**
 * POST /api/admin/users
 * Create a new user
 */
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'Username, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: role === 'admin' ? 'admin' : 'user',
    });
    await user.save();

    const { password: _, ...userWithoutPassword } = user.toObject();
    res.status(201).json({ success: true, user: { ...userWithoutPassword, property_count: 0 } });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update user role
 */
router.put('/users/:id', async (req, res) => {
  try {
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, select: '-password' }
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user and all their properties
 */
router.delete('/users/:id', async (req, res) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Delete all properties belonging to this user
    await Property.deleteMany({ user_id: req.params.id });

    // Delete the user
    await User.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'User and their properties deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

module.exports = router;
