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

      // Get property data from request body
      const propertyData = JSON.parse(req.body.propertyData);
      const reinsId = propertyData.reins_id || 'unknown';
      const buildingName = propertyData.buildingName || propertyData.reins_id || 'unknown';

      // Sanitize building name for folder (remove invalid characters)
      const sanitizedName = buildingName
        .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid Windows/Linux chars
        .replace(/\s+/g, '_')            // Replace spaces with underscore
        .substring(0, 100);              // Limit length

      // Create property-specific folder with name (add reins_id for uniqueness)
      const folderName = `${sanitizedName}_${reinsId}`;
      const propertyFolder = path.join(storagePath, folderName);

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
 * @swagger
 * /api/properties:
 *   get:
 *     summary: Get all properties with pagination
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of properties to skip
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Maximum number of properties to return
 *     responses:
 *       200:
 *         description: List of properties retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 20
 *                 total:
 *                   type: integer
 *                   example: 50
 *                 offset:
 *                   type: integer
 *                   example: 0
 *                 limit:
 *                   type: integer
 *                   example: 20
 *                 hasMore:
 *                   type: boolean
 *                   example: true
 *                 properties:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Property'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const offset = parseInt(req.query.offset, 10) || 0;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100); // Cap at 100

    console.log('[Properties API] GET request:', {
      offset,
      limit,
      userId: req.user.userId,
      rawQuery: { offset: req.query.offset, limit: req.query.limit }
    });

    // Get total count
    const total = await Property.countDocuments({ user_id: req.user.userId });

    // Get paginated properties
    const properties = await Property.find({ user_id: req.user.userId })
      .sort({ created_at: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .lean(); // Use lean() for better performance

    const hasMore = offset + properties.length < total;

    console.log('[Properties API] Response:', {
      count: properties.length,
      total: total,
      offset: offset,
      limit: limit,
      hasMore: hasMore,
      queriedLimit: Number(limit)
    });

    res.json({
      success: true,
      count: properties.length,
      total: total,
      offset: offset,
      limit: limit,
      hasMore: hasMore,
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
 * @swagger
 * /api/properties/{id}:
 *   get:
 *     summary: Get a single property by ID
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Property retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 property:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Property'
 *                     - type: object
 *                       properties:
 *                         html_content:
 *                           type: string
 *                           description: REINS HTML page content
 *       404:
 *         description: Property not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/properties/{id}:
 *   delete:
 *     summary: Delete a property and its associated files
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Property deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Property deleted successfully
 *       404:
 *         description: Property not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
