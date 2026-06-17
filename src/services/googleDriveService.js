import 'dotenv/config';
import { google } from 'googleapis';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { ERROR_CODES } from '../config/errorCodes.js';

/**
 * Google Drive Service
 * - Authenticates with OAuth2
 * - Lists and downloads files from a folder
 */


const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY
  },
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets.readonly'
  ]
});

const drive = google.drive({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });

logger.info('Google Drive service initialized', { 
  clientEmail: process.env.GOOGLE_DRIVE_CLIENT_EMAIL 
});

/**
 * List all files in a specific folder (non-recursive)
 * @param {string} folderId - Google Drive folder ID
 * @returns {Promise<Array>} Array of file objects
 * @throws {Error} If folderId is invalid or API call fails
 */
export async function listFilesInFolder(folderId) {
  if (!folderId || typeof folderId !== 'string') {
    throw new AppError(
      'folderId is required and must be a string',
      400,
      true,
      ERROR_CODES.BAD_REQUEST
    );
  }
  
  if (folderId.trim().length === 0) {
    throw new AppError(
      'folderId cannot be empty',
      400,
      true,
      ERROR_CODES.BAD_REQUEST
    );
  }
  
  logger.debug('Listing files in folder', { folderId });
  
  try {
    const filesListResult = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, modifiedTime, parents)',
      pageSize: 1000
    });
    
    return filesListResult.data.files;
  } catch (error) {
    logger.error('Failed to list files', { folderId, error: error.message });
    throw new AppError(
      `Failed to list files in folder ${folderId}: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
}

/**
 *  Recursively list all files in a folder and subfolders (using iterative approach)
 * @param {string} folderId - Root Google Drive folder ID
 * @param {number} [maxFolders=10000] - Maximum number of folders to process
 * @returns {Promise<Array>} Array of file objects with folderPath property
 * @throws {Error} If folderId is invalid or API call fails
 */
export async function listAllFilesIteratively(folderId, maxFolders = 10000) {
  logger.info('Fetching all files from Drive (optimized)');
  
  const allFiles = [];
  const folderQueue = [{ id: folderId, path: '' }];
  const processedFolders = new Set();
  let apiCallCount = 0;

  try {
    while (folderQueue.length > 0) {
      if (processedFolders.size >= maxFolders) {
        logger.warn('Maximum folder limit reached', { 
          maxFolders, 
          filesFound: allFiles.length 
        });
        break;
      }
      
      const { id: currentFolderId, path: currentPath } = folderQueue.shift();
      // eslint-disable-next-line no-continue
      if (processedFolders.has(currentFolderId)) continue;
      processedFolders.add(currentFolderId);

      apiCallCount += 1;
      
      try {
        const response = await drive.files.list({
          q: `'${currentFolderId}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType, parents, modifiedTime)',
          pageSize: 1000
        });

        const items = response.data.files || [];
        // eslint-disable-next-line no-restricted-syntax
        for (const item of items) {
          if (item.mimeType === 'application/vnd.google-apps.folder') {
            const subfolderPath = currentPath ? `${currentPath}/${item.name}` : item.name;
            folderQueue.push({ id: item.id, path: subfolderPath });
          } else {
            allFiles.push({
              ...item,
              folderPath: currentPath
            });
          }
        }
      } catch (error) {
        logger.error(`Failed to list files in folder ${currentFolderId}:`, error);
        // Continue with other folders even if one fails
      }
    }

    logger.info('Files retrieved successfully', {
      filesFound: allFiles.length,
      apiCalls: apiCallCount,
      foldersProcessed: processedFolders.size
    });
    return allFiles;
  } catch (error) {
    logger.error('Error listing files recursively', { error: error.message });
    throw error;
  }
}

/**
 * Download a file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @param {string} destPath - Destination file path
 * @param {string} mimeType - File MIME type
 * @returns {Promise<string>} Path to downloaded file
 * @throws {Error} If download fails
 */
export async function downloadFile(fileId, destPath, mimeType) {
  const { createWriteStream } = await import('fs');
  const dest = createWriteStream(destPath);

  // Google Docs mimeTypes
  const googleDocsMimeTypes = {
    'application/vnd.google-apps.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX for Sheets
    'application/vnd.google-apps.presentation': 'application/pdf' // PDF for Slides
  };
  
  if (googleDocsMimeTypes[mimeType]) {
    // Export Google Docs as DOCX or PDF
    const exportMimeType = googleDocsMimeTypes[mimeType];
    logger.debug(`Exporting Google Doc (${mimeType}) as ${exportMimeType}`);
    
    await drive.files.export({ fileId, mimeType: exportMimeType }, { responseType: 'stream' }).then(
      (res) =>
        new Promise((resolve, reject) => {
          let bytesWritten = 0;
          res.data
            .on('data', (chunk) => {
              bytesWritten += chunk.length;
            })
            .on('end', () => {
              logger.debug(`Export complete: ${bytesWritten} bytes written to ${destPath}`);
              resolve(destPath);
            })
            .on('error', (err) => {
              logger.error(`Export stream error: ${err.message}`);
              reject(err);
            })
            .pipe(dest);
        })
    );
  } else {
    // Download regular files (PDF, DOCX, etc.)
    logger.debug(`Downloading regular file (${mimeType})`);
    
    await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' }).then(
      (res) =>
        new Promise((resolve, reject) => {
          let bytesWritten = 0;
          res.data
            .on('data', (chunk) => {
              bytesWritten += chunk.length;
            })
            .on('end', () => {
              logger.debug(`Download complete: ${bytesWritten} bytes written to ${destPath}`);
              resolve(destPath);
            })
            .on('error', (err) => {
              logger.error(`Download stream error: ${err.message}`);
              reject(err);
            })
            .pipe(dest);
        })
    );
  }
  
  return destPath;
}

/**
 * Read Google Sheets content directly using Sheets API
 * More reliable than exporting to XLSX
 * @param {string} spreadsheetId - Google Sheets file ID
 * @returns {Promise<string>} Text content from all sheets
 */
export async function readGoogleSheet(spreadsheetId) {
  try {
    logger.debug(`Reading Google Sheet directly: ${spreadsheetId}`);
    
    // Get spreadsheet metadata to find all sheet names
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title'
    });
    
    const sheetNames = metadata.data.sheets.map(sheet => sheet.properties.title);
    logger.debug(`Found ${sheetNames.length} sheets: ${sheetNames.join(', ')}`);
    
    let allText = '';
    
    // Read each sheet
    for (const sheetName of sheetNames) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: sheetName
      });
      
      const values = response.data.values || [];
      if (values.length > 0) {
        allText += `\n[Sheet: ${sheetName}]\n`;
        values.forEach(row => {
          // Join cells with tabs, filter out empty cells
          const rowText = row.filter(cell => cell).join('\t');
          if (rowText.trim()) {
            allText += rowText + '\n';
          }
        });
      }
    }
    
    logger.debug(`Extracted ${allText.length} characters from Google Sheet`);
    return allText.trim();
  } catch (error) {
    logger.error(`Failed to read Google Sheet ${spreadsheetId}: ${error.message}`);
    throw error;
  }
}
