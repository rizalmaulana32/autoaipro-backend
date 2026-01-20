const StorageService = require('./StorageService');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

/**
 * AWS S3 Storage Service
 *
 * Stores files in Amazon S3.
 * Requires AWS credentials in environment variables.
 */
class S3StorageService extends StorageService {
  constructor(config = {}) {
    super();

    this.bucket = config.bucket || process.env.AWS_S3_BUCKET;
    this.region = config.region || process.env.AWS_REGION || 'ap-northeast-1';
    this.baseFolder = config.baseFolder || process.env.AWS_S3_BASE_FOLDER || '';

    if (!this.bucket) {
      throw new Error('AWS S3 bucket name is required. Set AWS_S3_BUCKET environment variable.');
    }

    // Initialize S3 Client
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    console.log(`✅ Initialized S3 Storage Service (bucket: ${this.bucket}, region: ${this.region})`);
  }

  /**
   * Upload a file to S3
   * @param {Buffer|Stream} fileData - File data to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} - { path, url, filename }
   */
  async uploadFile(fileData, options) {
    const { filename, mimetype, folder } = options;

    // Generate unique filename
    const uniqueFilename = this.generateUniqueFilename(filename);

    // Build S3 key (path)
    const key = this.buildKey(folder, uniqueFilename);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: fileData,
      ContentType: mimetype || 'application/octet-stream',
      // Optional: Make files publicly readable
      // ACL: 'public-read'
    });

    await this.s3Client.send(command);

    // Generate URL
    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return {
      path: key,
      url: url,
      filename: uniqueFilename
    };
  }

  /**
   * Download/Get a file from S3
   * @param {string} key - S3 object key
   * @returns {Promise<Buffer>} - File data as buffer
   */
  async downloadFile(key) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    const response = await this.s3Client.send(command);

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  /**
   * Delete a file from S3
   * @param {string} key - S3 object key to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(key) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    await this.s3Client.send(command);
    return true;
  }

  /**
   * Delete multiple files from S3
   * @param {string[]} keys - Array of S3 object keys to delete
   * @returns {Promise<Object>} - { success: number, failed: number, errors: [] }
   */
  async deleteFiles(keys) {
    if (keys.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const command = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
        Quiet: false
      }
    });

    const response = await this.s3Client.send(command);

    return {
      success: response.Deleted?.length || 0,
      failed: response.Errors?.length || 0,
      errors: response.Errors || []
    };
  }

  /**
   * List files in an S3 folder
   * @param {string} folder - Folder prefix
   * @returns {Promise<Array>} - Array of file objects
   */
  async listFiles(folder) {
    const prefix = this.buildKey(folder, '');

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix
    });

    const response = await this.s3Client.send(command);

    if (!response.Contents) {
      return [];
    }

    return response.Contents.map(item => ({
      path: item.Key,
      filename: path.basename(item.Key),
      size: item.Size,
      url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${item.Key}`,
      modified: item.LastModified
    }));
  }

  /**
   * Get signed URL for a file (for private buckets)
   * @param {string} key - S3 object key
   * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns {Promise<string>} - Signed URL
   */
  async getFileUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    // Generate signed URL
    const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
    return signedUrl;
  }

  /**
   * Check if a file exists in S3
   * @param {string} key - S3 object key
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get storage provider name
   * @returns {string}
   */
  getProviderName() {
    return 's3';
  }

  /**
   * Build S3 key from folder and filename
   * @param {string} folder - Folder path
   * @param {string} filename - Filename
   * @returns {string} - Full S3 key
   */
  buildKey(folder, filename) {
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

module.exports = S3StorageService;
