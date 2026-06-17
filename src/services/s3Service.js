import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { ERROR_CODES } from '../config/errorCodes.js';

// Configuration constants at top
const BUCKET_NAME = process.env.S3_BUCKET;
const DEFAULT_REGION = 'us-east-1';
const DEFAULT_PRESIGNED_URL_EXPIRY = 3600; // 1 hour
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PRESIGNED_URL_EXPIRY = 7 * 24 * 3600; // 7 days

// Add constants at top
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
];
// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || DEFAULT_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

/**
 * Validate file before upload
 * @param {Object} file - File object
 * @param {Array} allowedTypes - Optional custom allowed MIME types
 */
const validateFile = (file, allowedTypes = ALLOWED_MIME_TYPES) => {
  if (!file || !file.data || !file.name || !file.mimetype) {
    throw new AppError(
      'Invalid file object',
      400,
      true,
      ERROR_CODES.BAD_REQUEST
    );
  }

  // Check file size
  if (file.data.length > MAX_FILE_SIZE) {
    throw new AppError(
      `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      413,
      true,
      ERROR_CODES.BAD_REQUEST
    );
  }

  // Check MIME type
  if (!allowedTypes.includes(file.mimetype)) {
    throw new AppError(
      `File type ${file.mimetype} is not allowed`,
      400,
      true,
      ERROR_CODES.BAD_REQUEST
    );
  }

  return true;
};

/**
 * Generate a pre-signed URL for private file access
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
 * @returns {Promise<string>} - Pre-signed URL
 */
export const getPresignedUrl = async (key, expiresIn = DEFAULT_PRESIGNED_URL_EXPIRY) => {
  // Validate expiry
  if (expiresIn > MAX_PRESIGNED_URL_EXPIRY) {
    throw new AppError(
      `Expiry cannot exceed ${MAX_PRESIGNED_URL_EXPIRY} seconds`,
      400,
      true,
      ERROR_CODES.BAD_REQUEST
    );
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });

    return url;
  } catch (error) {
    logger.error(`S3 presigned URL error: ${error.message}`);
    throw new AppError('Failed to generate presigned URL', 500, true, ERROR_CODES.INTERNAL_ERROR);
  };
};
/**
 * Upload a file to S3
 * @param {Object} file - File object from express-fileupload
 * @param {string} folder - Folder path in S3 bucket (default: 'uploads')
 * @param {boolean} isPublic - Whether file should be publicly accessible (default: false)
 * @returns {Promise<Object>} - Object containing key and url
 */
export const uploadToS3 = async (file, folder = 'uploads', isPublic = false, allowedTypes = null) => {
  // Validate file
  validateFile(file, allowedTypes);
  
  // Validate folder path
  if (folder && typeof folder !== 'string') {
    throw new AppError(
      'Folder must be a string',
      400,
      true,
      ERROR_CODES.BAD_REQUEST
    );
  }

  try {
    const key = `${folder}/${randomUUID()}-${file.name.replace(/\s+/g, '-')}`;

    const commandParams = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.data,
      ContentType: file.mimetype
    };

    // Only add ACL if explicitly requested and bucket allows it
    if (isPublic) {
      commandParams.ACL = 'public-read';
    }

    const command = new PutObjectCommand(commandParams);
    await s3Client.send(command);

    // For private files, use presigned URL instead
    const url = isPublic 
      ? `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`
      : await getPresignedUrl(key, 3600); // 1 hour expiry for private files

    logger.info('File uploaded to S3', { key, isPublic });

    return { key, url };
  } catch (error) {
    logger.error('S3 upload error', { error: error.message, fileName: file.name });
    throw new AppError('Failed to upload file to S3', 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * Upload a base64 encoded file to S3
 * @param {string} base64String - Base64 encoded file string (with or without data URI prefix)
 * @param {string} fileName - Name for the file
 * @param {string} contentType - MIME type (e.g., 'image/png', 'application/pdf')
 * @param {string} folder - Folder path in S3 bucket (default: 'uploads')
 * @returns {Promise<Object>} - Object containing key and url
 */
export const uploadBase64ToS3 = async (base64String, fileName, contentType, folder = 'uploads') => {
  try {
    // Remove data URI prefix if present (e.g., "data:image/png;base64,")
    const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String;

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');


    const sanitizedFileName = fileName.replace(/\s+/g, '-');
    const key = `${folder}/${randomUUID()}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentEncoding: 'base64',
      ACL: 'public-read' // Remove if bucket has block public access
    });

    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    logger.info(`Base64 file uploaded to S3: ${key}`);

    return { key, url };
  } catch (error) {
    logger.error(`S3 base64 upload error: ${error.message}`);
    throw new AppError('Failed to upload base64 file to S3', 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * Delete a file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<void>}
 */
export const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);

    logger.info(`File deleted from S3: ${key}`);
  } catch (error) {
    logger.error(`S3 delete error: ${error.message}`);
    throw new AppError('Failed to delete file from S3', 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

