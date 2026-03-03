// Load .env only if exists (not on Vercel)
try {
  require('dotenv').config();
} catch (e) {
  // Ignore - env vars come from Vercel dashboard
}

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
const adminRoutes = require('./routes/admin');

// Import storage service with error handling
let storageService = null;
try {
  const StorageFactory = require('./services/storage/StorageFactory');
  storageService = StorageFactory.getInstance();
} catch (e) {
  console.error('Storage service init error:', e.message);
}

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

// Connect to MongoDB - always delegate to connectDB which handles caching + reconnect
const ensureDbConnected = async () => {
  return connectDB();
};

// Connect on startup
ensureDbConnected().catch(err => console.error('DB connection error:', err));

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

// Middleware to ensure DB is connected before API requests
app.use('/api', async (req, res, next) => {
  try {
    await ensureDbConnected();
    next();
  } catch (err) {
    console.error('DB middleware error:', err);
    res.status(500).json({ success: false, error: 'Database connection failed' });
  }
});

// Serve files from storage (local or Supabase)
app.get('/files/*', async (req, res) => {
  try {
    if (!storageService) {
      return res.status(503).json({ success: false, error: 'Storage service not available' });
    }

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

// Swagger API Documentation (using CDN for Vercel compatibility)
const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Auto入力Pro API Documentation',
  customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
  customJs: [
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js',
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js'
  ]
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/apikeys', apiKeyRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Auto入力Pro Backend Server is running',
    timestamp: new Date().toISOString(),
    env: {
      node_env: process.env.NODE_ENV || 'not set',
      storage_provider: process.env.STORAGE_PROVIDER || 'not set',
      has_mongodb: !!process.env.MONGODB_URI,
      has_jwt_secret: !!process.env.JWT_SECRET,
      has_supabase_url: !!process.env.SUPABASE_URL,
      has_supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      is_vercel: process.env.VERCEL === '1',
      storage_service_ready: !!storageService
    }
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
