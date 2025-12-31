const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Property = require('../models/Property');
const authenticateToken = require('../middleware/auth');
const StorageFactory = require('../services/storage/StorageFactory');

const router = express.Router();

// Get storage service instance (configured via environment variables)
const storageService = StorageFactory.getInstance();

// Configure multer for memory storage (files will be handled by storage service)
const upload = multer({
  storage: multer.memoryStorage(),
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
 * Helper: Sanitize folder name
 */
function sanitizeFolderName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid chars
    .replace(/\s+/g, '_')            // Replace spaces
    .substring(0, 100);              // Limit length
}

/**
 * Helper: Build property folder path
 */
function getPropertyFolder(propertyData) {
  const reinsId = propertyData.reins_id || 'unknown';
  const buildingName = propertyData.buildingName || propertyData.reins_id || 'unknown';
  const sanitizedName = sanitizeFolderName(buildingName);
  return `${sanitizedName}_${reinsId}`;
}

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
    const uploadedFiles = [];

    try {
      // Parse property data from form
      const propertyData = JSON.parse(req.body.propertyData);

      // Add user ID
      propertyData.user_id = req.user.userId;

      // Get property folder
      const propertyFolder = getPropertyFolder(propertyData);

      // Upload HTML file
      let htmlResult = null;
      if (req.files.html && req.files.html[0]) {
        const htmlFile = req.files.html[0];
        htmlResult = await storageService.uploadFile(htmlFile.buffer, {
          filename: htmlFile.originalname,
          mimetype: htmlFile.mimetype,
          folder: `${propertyFolder}/html`
        });
        uploadedFiles.push(htmlResult.path);
      }

      // Upload PDF file
      let pdfResult = null;
      if (req.files.pdf && req.files.pdf[0]) {
        const pdfFile = req.files.pdf[0];
        pdfResult = await storageService.uploadFile(pdfFile.buffer, {
          filename: pdfFile.originalname,
          mimetype: pdfFile.mimetype,
          folder: `${propertyFolder}/pdfs`
        });
        uploadedFiles.push(pdfResult.path);
      }

      // Upload image files
      const imageResults = [];
      if (req.files.images && req.files.images.length > 0) {
        for (const imageFile of req.files.images) {
          const imageResult = await storageService.uploadFile(imageFile.buffer, {
            filename: imageFile.originalname,
            mimetype: imageFile.mimetype,
            folder: `${propertyFolder}/images`
          });
          imageResults.push(imageResult);
          uploadedFiles.push(imageResult.path);
        }
      }

      // Add file paths and URLs
      propertyData.files = {
        html_path: htmlResult?.path,
        html_filename: htmlResult?.filename,
        html_url: htmlResult?.url,
        floorplan_path: pdfResult?.path,
        floorplan_filename: pdfResult?.filename,
        floorplan_url: pdfResult?.url,
        image_paths: imageResults.map(r => r.path),
        image_filenames: imageResults.map(r => r.filename),
        image_urls: imageResults.map(r => r.url)
      };

      // Add storage provider info
      propertyData.storage_provider = storageService.getProviderName();

      // Create property
      const property = new Property(propertyData);
      await property.save();

      console.log(`✅ Property created: ${property._id} (${property.buildingName})`);
      console.log(`📦 Storage provider: ${storageService.getProviderName()}`);

      res.status(201).json({
        success: true,
        property: property
      });
    } catch (error) {
      console.error('Property creation error:', error);

      // Clean up uploaded files if property creation fails
      if (uploadedFiles.length > 0) {
        console.log('Cleaning up uploaded files...');
        await storageService.deleteFiles(uploadedFiles)
          .catch(err => console.error('Failed to clean up files:', err));
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

    // Read HTML file content using storage service
    let htmlContent = null;
    if (property.files.html_path) {
      try {
        const fileExists = await storageService.fileExists(property.files.html_path);
        if (fileExists) {
          const buffer = await storageService.downloadFile(property.files.html_path);
          htmlContent = buffer.toString('utf-8');
        }
      } catch (error) {
        console.warn('Failed to read HTML file:', error.message);
      }
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

    // Delete associated files using storage service
    const filesToDelete = [
      property.files.html_path,
      property.files.floorplan_path,
      ...property.files.image_paths
    ].filter(Boolean);

    if (filesToDelete.length > 0) {
      const deleteResult = await storageService.deleteFiles(filesToDelete);
      console.log(`📦 Deleted ${deleteResult.success} files, ${deleteResult.failed} failed`);
    }

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
