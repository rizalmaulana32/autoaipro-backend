/**
 * Abstract Storage Service Interface
 *
 * This class defines the interface that all storage providers must implement.
 * Supports local storage, AWS S3, Supabase Storage, and other providers.
 */
class StorageService {
  /**
   * Upload a file to storage
   * @param {Buffer|Stream} fileData - File data to upload
   * @param {Object} options - Upload options
   * @param {string} options.filename - Original filename
   * @param {string} options.mimetype - MIME type of file
   * @param {string} options.folder - Folder path (e.g., "property_123/images")
   * @returns {Promise<Object>} - { path, url, filename }
   */
  async uploadFile(fileData, options) {
    throw new Error('uploadFile() must be implemented by storage provider');
  }

  /**
   * Download/Get a file from storage
   * @param {string} path - File path in storage
   * @returns {Promise<Buffer>} - File data as buffer
   */
  async downloadFile(path) {
    throw new Error('downloadFile() must be implemented by storage provider');
  }

  /**
   * Delete a file from storage
   * @param {string} path - File path to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(path) {
    throw new Error('deleteFile() must be implemented by storage provider');
  }

  /**
   * Delete multiple files from storage
   * @param {string[]} paths - Array of file paths to delete
   * @returns {Promise<Object>} - { success: number, failed: number, errors: [] }
   */
  async deleteFiles(paths) {
    throw new Error('deleteFiles() must be implemented by storage provider');
  }

  /**
   * List files in a directory/folder
   * @param {string} folder - Folder path
   * @returns {Promise<Array>} - Array of file objects { path, filename, size, url }
   */
  async listFiles(folder) {
    throw new Error('listFiles() must be implemented by storage provider');
  }

  /**
   * Get public URL for a file
   * @param {string} path - File path
   * @returns {Promise<string>} - Public URL (or signed URL for private storage)
   */
  async getFileUrl(path) {
    throw new Error('getFileUrl() must be implemented by storage provider');
  }

  /**
   * Check if a file exists
   * @param {string} path - File path
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(path) {
    throw new Error('fileExists() must be implemented by storage provider');
  }

  /**
   * Get storage provider name
   * @returns {string} - Provider name (local, s3, supabase)
   */
  getProviderName() {
    throw new Error('getProviderName() must be implemented by storage provider');
  }
}

module.exports = StorageService;
