const StorageService = require('./StorageService');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Local File System Storage Service
 *
 * Stores files on the local server filesystem.
 * Uses the STORAGE_PATH environment variable for the base directory.
 */
class LocalStorageService extends StorageService {
  constructor(basePath) {
    super();
    this.basePath = basePath || process.env.STORAGE_PATH || './storage';
    this.ensureBasePathExists();
  }

  /**
   * Ensure base storage directory exists
   */
  ensureBasePathExists() {
    if (!fsSync.existsSync(this.basePath)) {
      fsSync.mkdirSync(this.basePath, { recursive: true });
      console.log(`✅ Created local storage directory: ${this.basePath}`);
    }
  }

  /**
   * Upload a file to local storage
   * @param {Buffer|Stream} fileData - File data to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} - { path, url, filename }
   */
  async uploadFile(fileData, options) {
    const { filename, folder } = options;

    // Create full folder path
    const folderPath = path.join(this.basePath, folder);

    // Ensure folder exists
    if (!fsSync.existsSync(folderPath)) {
      await fs.mkdir(folderPath, { recursive: true });
    }

    // Generate unique filename if needed
    const uniqueFilename = this.generateUniqueFilename(filename);
    const filePath = path.join(folderPath, uniqueFilename);
    const relativePath = path.join(folder, uniqueFilename);

    // Write file
    if (Buffer.isBuffer(fileData)) {
      await fs.writeFile(filePath, fileData);
    } else {
      // Handle stream
      const writeStream = fsSync.createWriteStream(filePath);
      await new Promise((resolve, reject) => {
        fileData.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }

    return {
      path: relativePath,
      url: `/files/${relativePath}`,
      filename: uniqueFilename,
      absolutePath: filePath
    };
  }

  /**
   * Download/Get a file from local storage
   * @param {string} relativePath - File path relative to base
   * @returns {Promise<Buffer>} - File data as buffer
   */
  async downloadFile(relativePath) {
    const filePath = path.join(this.basePath, relativePath);

    if (!fsSync.existsSync(filePath)) {
      throw new Error(`File not found: ${relativePath}`);
    }

    return await fs.readFile(filePath);
  }

  /**
   * Delete a file from local storage
   * @param {string} relativePath - File path to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(relativePath) {
    const filePath = path.join(this.basePath, relativePath);

    if (!fsSync.existsSync(filePath)) {
      console.warn(`File not found for deletion: ${relativePath}`);
      return false;
    }

    await fs.unlink(filePath);
    return true;
  }

  /**
   * Delete multiple files from local storage
   * @param {string[]} paths - Array of file paths to delete
   * @returns {Promise<Object>} - { success: number, failed: number, errors: [] }
   */
  async deleteFiles(paths) {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const relativePath of paths) {
      try {
        const deleted = await this.deleteFile(relativePath);
        if (deleted) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({ path: relativePath, error: 'File not found' });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ path: relativePath, error: error.message });
      }
    }

    return results;
  }

  /**
   * List files in a directory/folder
   * @param {string} folder - Folder path relative to base
   * @returns {Promise<Array>} - Array of file objects
   */
  async listFiles(folder) {
    const folderPath = path.join(this.basePath, folder);

    if (!fsSync.existsSync(folderPath)) {
      return [];
    }

    const files = await fs.readdir(folderPath);
    const fileObjects = [];

    for (const filename of files) {
      const filePath = path.join(folderPath, filename);
      const stats = await fs.stat(filePath);

      if (stats.isFile()) {
        const relativePath = path.join(folder, filename);
        fileObjects.push({
          path: relativePath,
          filename: filename,
          size: stats.size,
          url: `/files/${relativePath}`,
          created: stats.birthtime,
          modified: stats.mtime
        });
      }
    }

    return fileObjects;
  }

  /**
   * Get public URL for a file
   * @param {string} relativePath - File path
   * @returns {Promise<string>} - Public URL
   */
  async getFileUrl(relativePath) {
    return `/files/${relativePath}`;
  }

  /**
   * Check if a file exists
   * @param {string} relativePath - File path
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(relativePath) {
    const filePath = path.join(this.basePath, relativePath);
    return fsSync.existsSync(filePath);
  }

  /**
   * Get storage provider name
   * @returns {string}
   */
  getProviderName() {
    return 'local';
  }

  /**
   * Generate unique filename with timestamp
   * @param {string} originalFilename - Original filename
   * @returns {string} - Unique filename
   */
  generateUniqueFilename(originalFilename) {
    const ext = path.extname(originalFilename);
    const name = path.basename(originalFilename, ext);
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    return `${name}-${timestamp}-${random}${ext}`;
  }
}

module.exports = LocalStorageService;
