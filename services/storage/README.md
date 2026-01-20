# Storage Service

Pluggable file storage service for Auto入力Pro backend. Supports multiple storage providers with a unified interface.

## Supported Providers

- **Local**: Local filesystem storage (default)
- **AWS S3**: Amazon S3 cloud storage
- **Supabase**: Supabase Storage

## Architecture

```
StorageService (abstract interface)
├── LocalStorageService
├── S3StorageService
└── SupabaseStorageService
```

## Configuration

### 1. Environment Variables

Add to your `.env` file:

```env
# Choose storage provider: local, s3, or supabase
STORAGE_PROVIDER=local

# Local Storage
STORAGE_PATH=./storage

# AWS S3 Storage
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BASE_FOLDER=autoaipro

# Supabase Storage
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_BUCKET=properties
SUPABASE_BASE_FOLDER=autoaipro
```

### 2. Install Required Packages

```bash
# For AWS S3
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# For Supabase
npm install @supabase/supabase-js
```

## Usage

### Basic Usage

```javascript
const StorageFactory = require('./services/storage/StorageFactory');

// Get storage service instance (auto-configured from environment)
const storage = StorageFactory.getInstance();

// Upload a file
const result = await storage.uploadFile(fileBuffer, {
  filename: 'example.pdf',
  mimetype: 'application/pdf',
  folder: 'property_123/pdfs'
});

console.log(result);
// { path: '...', url: '...', filename: '...' }

// Download a file
const buffer = await storage.downloadFile(result.path);

// Delete a file
await storage.deleteFile(result.path);

// Delete multiple files
await storage.deleteFiles([path1, path2, path3]);
```

### Advanced Usage

```javascript
// Create specific provider instance
const LocalStorageService = require('./services/storage/LocalStorageService');
const localStorage = new LocalStorageService('./custom-path');

// List files in a folder
const files = await storage.listFiles('property_123/images');

// Check if file exists
const exists = await storage.fileExists('property_123/pdfs/document.pdf');

// Get file URL
const url = await storage.getFileUrl('property_123/images/photo.jpg');
```

## API Reference

### `uploadFile(fileData, options)`

Upload a file to storage.

**Parameters:**
- `fileData` (Buffer): File data
- `options.filename` (string): Original filename
- `options.mimetype` (string): MIME type
- `options.folder` (string): Destination folder path

**Returns:** `{ path, url, filename }`

### `downloadFile(path)`

Download a file from storage.

**Parameters:**
- `path` (string): File path in storage

**Returns:** `Buffer` - File data

### `deleteFile(path)`

Delete a file from storage.

**Parameters:**
- `path` (string): File path to delete

**Returns:** `boolean` - Success status

### `deleteFiles(paths)`

Delete multiple files from storage.

**Parameters:**
- `paths` (string[]): Array of file paths

**Returns:** `{ success, failed, errors }`

### `listFiles(folder)`

List files in a folder.

**Parameters:**
- `folder` (string): Folder path

**Returns:** Array of `{ path, filename, size, url, created, modified }`

### `getFileUrl(path)`

Get public URL for a file.

**Parameters:**
- `path` (string): File path

**Returns:** `string` - Public URL (or signed URL for private storage)

### `fileExists(path)`

Check if a file exists.

**Parameters:**
- `path` (string): File path

**Returns:** `boolean`

### `getProviderName()`

Get storage provider name.

**Returns:** `string` - "local", "s3", or "supabase"

## Switching Storage Providers

To switch storage providers, simply update the `STORAGE_PROVIDER` environment variable:

```bash
# Switch to AWS S3
STORAGE_PROVIDER=s3

# Switch to Supabase
STORAGE_PROVIDER=supabase

# Switch back to local
STORAGE_PROVIDER=local
```

No code changes required!

## Provider-Specific Notes

### Local Storage

- Files stored in `STORAGE_PATH` directory (default: `./storage`)
- URLs are relative paths served via Express static middleware
- No additional configuration needed

### AWS S3

- Requires AWS credentials with S3 access
- Files can be public or private (configure bucket permissions)
- Uses AWS SDK v3
- Supports signed URLs for private files

### Supabase Storage

- Requires Supabase project and service role key
- Files are stored in Supabase Storage buckets
- Supports public URLs by default
- Can generate signed URLs for temporary access

## Migration Guide

### Migrating from Local to Cloud Storage

1. **Set up cloud storage provider** (AWS S3 or Supabase)
2. **Update environment variables**
3. **Restart server**
4. **Upload new files** - They will automatically go to cloud storage
5. **Migrate existing files** (optional):
   ```bash
   # Create migration script to copy files from local to cloud
   node scripts/migrate-storage.js
   ```

### Migrating Between Cloud Providers

Files don't automatically migrate. To switch providers:

1. Export data from current provider
2. Update `STORAGE_PROVIDER` in `.env`
3. Import data to new provider

## Troubleshooting

### AWS S3 Issues

**Error: "Access Denied"**
- Check AWS credentials are correct
- Verify IAM permissions include S3 access
- Ensure bucket exists and region is correct

**Error: "Bucket does not exist"**
- Create bucket in AWS S3 console
- Update `AWS_S3_BUCKET` in `.env`

### Supabase Issues

**Error: "Invalid JWT"**
- Check `SUPABASE_SERVICE_ROLE_KEY` is correct
- Use Service Role key, not anon key

**Error: "Bucket does not exist"**
- Create bucket in Supabase dashboard
- Update `SUPABASE_BUCKET` in `.env`

### Local Storage Issues

**Error: "ENOENT: no such file or directory"**
- Ensure `STORAGE_PATH` directory exists
- Check file permissions

## Performance Considerations

- **Local**: Fastest for small deployments, single server
- **S3**: Best for production, high availability, CDN integration
- **Supabase**: Good balance, easy setup, real-time capabilities

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for all sensitive config
3. **Limit AWS IAM permissions** to minimum required
4. **Use Supabase Service Role Key** (not anon key) for server-side operations
5. **Implement file validation** before upload
6. **Set appropriate bucket permissions** (public vs private)
