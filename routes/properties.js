const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Property = require('../models/Property');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const storagePath = process.env.STORAGE_PATH || './storage';

      // Get reins_id from request body to organize files by property
      const propertyData = JSON.parse(req.body.propertyData);
      const reinsId = propertyData.reins_id || 'unknown';

      // Create property-specific folder
      const propertyFolder = path.join(storagePath, reinsId);

      // Create subdirectory based on file type
      let folder;
      if (file.fieldname === 'html') {
        folder = path.join(propertyFolder, 'html');
      } else if (file.fieldname === 'pdf') {
        folder = path.join(propertyFolder, 'pdfs');
      } else if (file.fieldname === 'images') {
        folder = path.join(propertyFolder, 'images');
      }

      // Create directories if they don't exist
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }

      cb(null, folder);
    } catch (error) {
      console.error('Storage destination error:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    // Accept only specific file types
    const allowedTypes = {
      'html': ['.html', '.htm'],
      'pdf': ['.pdf'],
      'images': ['.jpg', '.jpeg', '.png', '.gif']
    };

    const ext = path.extname(file.originalname).toLowerCase();
    const fieldAllowedTypes = allowedTypes[file.fieldname];

    if (fieldAllowedTypes && fieldAllowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type for ${file.fieldname}`));
    }
  }
});

/**
 * POST /api/properties
 * Create a new property with file uploads
 * Requires authentication
 */
router.post('/',
  authenticateToken,
  upload.fields([
    { name: 'html', maxCount: 1 },
    { name: 'pdf', maxCount: 1 },
    { name: 'images', maxCount: 20 }
  ]),
  async (req, res) => {
    try {
      // Parse property data from form
      const propertyData = JSON.parse(req.body.propertyData);

      // Add user ID
      propertyData.user_id = req.user.userId;

      // Add file paths
      propertyData.files = {
        html_path: req.files.html?.[0]?.path,
        html_filename: req.files.html?.[0]?.filename,
        floorplan_path: req.files.pdf?.[0]?.path,
        floorplan_filename: req.files.pdf?.[0]?.filename,
        image_paths: req.files.images?.map(f => f.path) || [],
        image_filenames: req.files.images?.map(f => f.filename) || []
      };

      // Create property
      const property = new Property(propertyData);
      await property.save();

      console.log(`✅ Property created: ${property._id} (${property.buildingName})`);

      res.status(201).json({
        success: true,
        property: property
      });
    } catch (error) {
      console.error('Property creation error:', error);

      // Clean up uploaded files if property creation fails
      if (req.files) {
        ['html', 'pdf', 'images'].forEach(fieldname => {
          const files = req.files[fieldname];
          if (files) {
            files.forEach(file => {
              fs.unlink(file.path, err => {
                if (err) console.error('Failed to delete file:', file.path);
              });
            });
          }
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create property: ' + error.message
      });
    }
  }
);

/**
 * GET /api/properties
 * Get all properties for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const properties = await Property.find({ user_id: req.user.userId })
      .sort({ created_at: -1 });

    res.json({
      success: true,
      count: properties.length,
      properties: properties
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get properties'
    });
  }
});

/**
 * GET /api/properties/:id
 * Get a single property by ID (with HTML content)
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const property = await Property.findOne({
      _id: req.params.id,
      user_id: req.user.userId // Ensure user owns this property
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    // Read HTML file content
    let htmlContent = null;
    if (property.files.html_path && fs.existsSync(property.files.html_path)) {
      htmlContent = fs.readFileSync(property.files.html_path, 'utf-8');
    }

    res.json({
      success: true,
      property: {
        ...property.toObject(),
        html_content: htmlContent
      }
    });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get property'
    });
  }
});

/**
 * PUT /api/properties/:id
 * Update a property
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const property = await Property.findOne({
      _id: req.params.id,
      user_id: req.user.userId
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    // Update property fields
    Object.assign(property, req.body);
    await property.save();

    res.json({
      success: true,
      property: property
    });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update property'
    });
  }
});

/**
 * DELETE /api/properties/:id
 * Delete a property and its files
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const property = await Property.findOne({
      _id: req.params.id,
      user_id: req.user.userId
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    // Delete associated files
    const filesToDelete = [
      property.files.html_path,
      property.files.floorplan_path,
      ...property.files.image_paths
    ].filter(Boolean);

    filesToDelete.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, err => {
          if (err) console.error('Failed to delete file:', filePath);
        });
      }
    });

    // Delete property from database
    await Property.deleteOne({ _id: property._id });

    console.log(`✅ Property deleted: ${property._id}`);

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete property'
    });
  }
});

module.exports = router;
