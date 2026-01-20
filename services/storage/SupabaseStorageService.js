const StorageService = require('./StorageService');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

/**
 * Supabase Storage Service
 *
 * Stores files in Supabase Storage.
 * Requires Supabase URL and Service Role Key in environment variables.
 */
class SupabaseStorageService extends StorageService {
  constructor(config = {}) {
    super();

    this.supabaseUrl = config.url || process.env.SUPABASE_URL;
    this.supabaseKey = config.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.bucketName = config.bucket || process.env.SUPABASE_BUCKET || 'properties';
    this.baseFolder = config.baseFolder || process.env.SUPABASE_BASE_FOLDER || '';

    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase URL and Service Role Key are required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    // Initialize Supabase Client
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log(`✅ Initialized Supabase Storage Service (bucket: ${this.bucketName})`);
  }

  /**
   * Upload a file to Supabase Storage
   * @param {Buffer|Stream} fileData - File data to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} - { path, url, filename }
   */
  async uploadFile(fileData, options) {
    const { filename, mimetype, folder } = options;

    // Generate unique filename
    const uniqueFilename = this.generateUniqueFilename(filename);

    // Build storage path
    const storagePath = this.buildPath(folder, uniqueFilename);

    // Upload to Supabase
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(storagePath, fileData, {
        contentType: mimetype || 'application/octet-stream',
        upsert: false
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);

    return {
      path: storagePath,
      url: urlData.publicUrl,
      filename: uniqueFilename
    };
  }

  /**
   * Download/Get a file from Supabase Storage
   * @param {string} storagePath - Storage path
   * @returns {Promise<Buffer>} - File data as buffer
   */
  async downloadFile(storagePath) {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .download(storagePath);

    if (error) {
      throw new Error(`Supabase download failed: ${error.message}`);
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Delete a file from Supabase Storage
   * @param {string} storagePath - Storage path to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(storagePath) {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([storagePath]);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }

    return true;
  }

  /**
   * Delete multiple files from Supabase Storage
   * @param {string[]} storagePaths - Array of storage paths to delete
   * @returns {Promise<Object>} - { success: number, failed: number, errors: [] }
   */
  async deleteFiles(storagePaths) {
    if (storagePaths.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .remove(storagePaths);

    if (error) {
      return {
        success: 0,
        failed: storagePaths.length,
        errors: [{ error: error.message }]
      };
    }

    return {
      success: data.length,
      failed: storagePaths.length - data.length,
      errors: []
    };
  }

  /**
   * List files in a Supabase Storage folder
   * @param {string} folder - Folder path
   * @returns {Promise<Array>} - Array of file objects
   */
  async listFiles(folder) {
    const prefix = this.buildPath(folder, '');

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .list(prefix, {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      throw new Error(`Supabase list failed: ${error.message}`);
    }

    return data.map(item => {
      const fullPath = path.join(prefix, item.name);
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(fullPath);

      return {
        path: fullPath,
        filename: item.name,
        size: item.metadata?.size || 0,
        url: urlData.publicUrl,
        created: item.created_at,
        modified: item.updated_at
      };
    });
  }

  /**
   * Get public URL for a file
   * @param {string} storagePath - Storage path
   * @returns {Promise<string>} - Public URL
   */
  async getFileUrl(storagePath) {
    const { data } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);

    return data.publicUrl;
  }

  /**
   * Get signed URL for private files (expires after specified time)
   * @param {string} storagePath - Storage path
   * @param {number} expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
   * @returns {Promise<string>} - Signed URL
   */
  async getSignedUrl(storagePath, expiresIn = 3600) {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      throw new Error(`Supabase signed URL failed: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Check if a file exists in Supabase Storage
   * @param {string} storagePath - Storage path
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(storagePath) {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(storagePath);

      return !error && data !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage provider name
   * @returns {string}
   */
  getProviderName() {
    return 'supabase';
  }

  /**
   * Build storage path from folder and filename
   * @param {string} folder - Folder path
   * @param {string} filename - Filename
   * @returns {string} - Full storage path
   */
  buildPath(folder, filename) {
    const parts = [this.baseFolder, folder, filename].filter(Boolean);
    return parts.join('/');
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

module.exports = SupabaseStorageService;
