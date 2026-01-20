require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// Import routes
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const apiKeyRoutes = require('./routes/apikeys');

// Import storage service
const StorageFactory = require('./services/storage/StorageFactory');
const storageService = StorageFactory.getInstance();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create storage directories only in non-serverless environment
const isVercel = process.env.VERCEL === '1';
if (!isVercel) {
  const storagePath = process.env.STORAGE_PATH || './storage';
  const directories = ['html', 'images', 'pdfs'];
  directories.forEach(dir => {
    const fullPath = path.join(storagePath, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`✅ Created directory: ${fullPath}`);
    }
  });
}

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin matches allowed origins (including wildcards for chrome-extension://)
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('chrome-extension://')) {
        return origin.startsWith('chrome-extension://');
      }
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve files from storage (local or Supabase)
app.get('/files/*', async (req, res) => {
  try {
    const filePath = req.params[0]; // Everything after /files/

    // Check if file exists
    const exists = await storageService.fileExists(filePath);
    if (!exists) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Download file from storage
    const fileBuffer = await storageService.downloadFile(filePath);

    // Determine content type based on extension
    const ext = filePath.split('.').pop().toLowerCase();
    const contentTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'html': 'text/html',
      'htm': 'text/html'
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set headers and send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.send(fileBuffer);
  } catch (error) {
    console.error('File serving error:', error);
    res.status(500).json({ success: false, error: 'Failed to serve file' });
  }
});

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Auto入力Pro API Documentation',
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/apikeys', apiKeyRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Auto入力Pro Backend Server is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Auto入力Pro API',
    docs: '/api-docs',
    health: '/api/health'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server only in non-serverless environment
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Auto入力Pro Backend Server`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 Server running on http://localhost:${PORT}`);
    console.log(`\n📚 API Documentation:`);
    console.log(`   - Swagger UI: http://localhost:${PORT}/api-docs`);
    console.log(`\n✅ API Endpoints:`);
    console.log(`   - Health: http://localhost:${PORT}/api/health`);
    console.log(`   - Auth: http://localhost:${PORT}/api/auth`);
    console.log(`   - Properties: http://localhost:${PORT}/api/properties`);
    console.log(`   - API Keys: http://localhost:${PORT}/api/apikeys (Admin only)\n`);
  });
}

// Export for Vercel serverless
module.exports = app;
