const LocalStorageService = require('./LocalStorageService');
const S3StorageService = require('./S3StorageService');
const SupabaseStorageService = require('./SupabaseStorageService');

/**
 * Storage Service Factory
 *
 * Creates and returns the appropriate storage service based on configuration.
 * Supports: local, s3, supabase
 */
class StorageFactory {
  /**
   * Create a storage service instance
   * @param {string} provider - Storage provider name (local, s3, supabase)
   * @param {Object} config - Provider-specific configuration
   * @returns {StorageService} - Storage service instance
   */
  static createStorageService(provider = null, config = {}) {
    // Use environment variable if no provider specified
    const storageProvider = (provider || process.env.STORAGE_PROVIDER || 'local').toLowerCase();

    console.log(`\n📦 Storage Service Configuration:`);
    console.log(`   Provider: ${storageProvider}`);

    switch (storageProvider) {
      case 'local':
        return new LocalStorageService(config.basePath);

      case 's3':
      case 'aws':
        return new S3StorageService(config);

      case 'supabase':
        return new SupabaseStorageService(config);

      default:
        console.warn(`⚠️  Unknown storage provider: ${storageProvider}. Falling back to 'local'.`);
        return new LocalStorageService(config.basePath);
    }
  }

  /**
   * Get singleton instance of storage service
   * Initializes on first call, returns cached instance on subsequent calls
   * @returns {StorageService}
   */
  static getInstance() {
    if (!StorageFactory.instance) {
      StorageFactory.instance = StorageFactory.createStorageService();
    }
    return StorageFactory.instance;
  }

  /**
   * Reset singleton instance (useful for testing or changing providers at runtime)
   */
  static resetInstance() {
    StorageFactory.instance = null;
  }
}

// Singleton instance
StorageFactory.instance = null;

module.exports = StorageFactory;
