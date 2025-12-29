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

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create storage directories if they don't exist
const storagePath = process.env.STORAGE_PATH || './storage';
const directories = ['html', 'images', 'pdfs'];
directories.forEach(dir => {
  const fullPath = path.join(storagePath, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Created directory: ${fullPath}`);
  }
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
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

// Serve static files (for file downloads)
app.use('/files', express.static(storagePath));

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Auto入力Pro API Documentation',
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Auto入力Pro Backend Server is running',
    timestamp: new Date().toISOString()
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

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Auto入力Pro Backend Server`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`📁 Storage path: ${storagePath}`);
  console.log(`\n📚 API Documentation:`);
  console.log(`   - Swagger UI: http://localhost:${PORT}/api-docs`);
  console.log(`\n✅ API Endpoints:`);
  console.log(`   - Health: http://localhost:${PORT}/api/health`);
  console.log(`   - Auth: http://localhost:${PORT}/api/auth`);
  console.log(`   - Properties: http://localhost:${PORT}/api/properties\n`);
});
