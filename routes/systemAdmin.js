const express = require('express');
const bcrypt = require('bcryptjs');
const Client = require('../models/Client');
const User = require('../models/User');
const Property = require('../models/Property');
const authenticateToken = require('../middleware/auth');
const { requireSystemAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken, requireSystemAdmin);

/**
 * GET /api/system-admin/clients
 * List all client companies with account usage
 */
router.get('/clients', async (req, res) => {
  try {
    const clients = await Client.find().sort({ created_at: -1 });

    // Get account counts per client
    const clientIds = clients.map(c => c._id);
    const users = await User.find({ company_id: { $in: clientIds } });

    const countMap = {};
    users.forEach(u => {
      const key = u.company_id.toString();
      countMap[key] = (countMap[key] || 0) + 1;
    });

    const totalAccountsIssued = users.length;
    const activeClients = clients.filter(c => c.status === 'active').length;

    const clientsWithCount = clients.map(c => ({
      ...c.toObject(),
      account_count: countMap[c._id.toString()] || 0
    }));

    res.json({
      success: true,
      clients: clientsWithCount,
      stats: {
        total_clients: clients.length,
        active_clients: activeClients,
        total_accounts_issued: totalAccountsIssued
      }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ success: false, error: 'Failed to get clients' });
  }
});

/**
 * POST /api/system-admin/clients
 * Create a new client company + client_admin user with temp password
 */
router.post('/clients', async (req, res) => {
  try {
    const { company_name, email, username, account_limit, expiry_date, password } = req.body;

    if (!company_name || !email || !username || !account_limit || !expiry_date) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    // Validate unique email (client companies)
    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return res.status(400).json({ success: false, error: 'Email already in use by another company' });
    }

    // Validate unique username and email (users)
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ success: false, error: 'Username already taken' });
      }
      return res.status(400).json({ success: false, error: 'Email already in use' });
    }

    // Create client company
    const client = new Client({
      company_name,
      email,
      account_limit: parseInt(account_limit),
      expiry_date: new Date(expiry_date),
      status: 'active'
    });
    await client.save();

    // Use provided password or generate one
    const tempPassword = password && password.length >= 6
      ? password
      : Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();

    // Create client_admin user with the provided username
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: 'client_admin',
      company_id: client._id,
      status: 'active'
    });
    await user.save();

    res.status(201).json({
      success: true,
      client: { ...client.toObject(), account_count: 1 },
      temp_password: tempPassword,
      username
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ success: false, error: 'Failed to create client' });
  }
});

/**
 * GET /api/system-admin/clients/:id/users
 * List all users belonging to a client company
 */
router.get('/clients/:id/users', async (req, res) => {
  try {
    const users = await User.find({ company_id: req.params.id }, { password: 0 }).sort({ created_at: -1 });
    res.json({ success: true, users });
  } catch (error) {
    console.error('Get client users error:', error);
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
});

/**
 * PUT /api/system-admin/clients/:id
 * Update client company (limit, expiry, status)
 */
router.put('/clients/:id', async (req, res) => {
  try {
    const { account_limit, expiry_date, status, company_name } = req.body;

    const update = {};
    if (company_name) update.company_name = company_name;
    if (account_limit) update.account_limit = parseInt(account_limit);
    if (expiry_date) update.expiry_date = new Date(expiry_date);
    if (status) update.status = status;

    const client = await Client.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

    const accountCount = await User.countDocuments({ company_id: req.params.id });
    res.json({ success: true, client: { ...client.toObject(), account_count: accountCount } });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ success: false, error: 'Failed to update client' });
  }
});

/**
 * DELETE /api/system-admin/clients/:id
 * Delete client + all its users and properties
 */
router.delete('/clients/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

    // Get all users of this client
    const users = await User.find({ company_id: req.params.id });
    const userIds = users.map(u => u._id);

    // Delete their properties
    if (userIds.length > 0) {
      await Property.deleteMany({ user_id: { $in: userIds } });
    }

    // Delete users
    await User.deleteMany({ company_id: req.params.id });

    // Delete client
    await Client.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Client and all associated data deleted' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete client' });
  }
});

module.exports = router;
