import path from 'path';
import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import 'dotenv/config';

import { listAllFilesIteratively, downloadFile, readGoogleSheet } from './googleDriveService.js';
import { addMany, deleteMany, getAll } from './vectorService.js';
import logger from '../config/logger.js';

logger.info('Ingest Google Drive Folder Service Loaded');

// -------------------------
// CACHE MANAGEMENT
// -------------------------
const CACHE_FILE = path.join(process.cwd(), 'tmp', '.drive-sync-cache.json');
const BATCH_SIZE = 50; // Process files in batches

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch (err) {
    logger.warn('Failed to load cache:', err.message);
  }
  return { lastSyncTime: null, fileCount: 0 };
}

function saveCache(data) {
  try {
    const tmpDir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    logger.warn('Failed to save cache:', err.message);
  }
}

// -------------------------
// TEXT EXTRACTION
// -------------------------
async function extractText(filePath, mimeType, fileId = null) {
  // PDF
  if (mimeType === 'application/pdf') {
    try {
      const parser = new PDFParse({ url: filePath });
      const result = await parser.getText();
      return result.text;
    } catch (err) {
      logger.error('PDF extract error:', err);
      return '';
    }
  }

  // Google Sheets - use Sheets API directly (more reliable than XLSX export)
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    try {
      if (!fileId) {
        logger.error('Google Sheets requires fileId for direct API access');
        return '';
      }
      logger.debug('Using Google Sheets API for:', fileId);
      const text = await readGoogleSheet(fileId);
      return text;
    } catch (err) {
      logger.warn('Google Sheets API not available:', err.message);
      if (err.message.includes('has not been used') || err.message.includes('is disabled')) {
        logger.info('💡 Enable Google Sheets API: https://console.developers.google.com/apis/api/sheets.googleapis.com');
      }
      // Fallback to XLSX export attempt (will use filePath if provided)
      logger.debug('⚠️  Falling back to XLSX export (may be unreliable)...');
      if (!filePath) {
        logger.error('No filePath provided for XLSX fallback');
        return '';
      }
      // Continue to XLSX processing below
    }
  }

  // XLSX (MS Excel files)
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    try {
      logger.debug('Extracting XLSX from file:', filePath);
      
      // Check file size and existence
      const stats = fs.statSync(filePath);
      logger.debug(`XLSX file size: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        logger.warn('XLSX file is empty (0 bytes)');
        return '';
      }
      
      if (stats.size < 500) {
        logger.warn(`XLSX file suspiciously small (${stats.size} bytes), may be corrupted`);
      }
      
      const workbook = xlsx.readFile(filePath, { cellDates: true });
      let text = '';
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const sheetText = xlsx.utils.sheet_to_txt(sheet, { blankrows: false });
        text += `\n[Sheet: ${sheetName}]\n${sheetText}`;
      });
      logger.debug(`XLSX extracted ${text.length} characters from ${workbook.SheetNames.length} sheets`);
      return text.trim();
    } catch (err) {
      logger.error('XLSX extract error:', err.message);
      logger.debug('XLSX file path:', filePath);
      logger.debug('Full XLSX error:', err);
      return '';
    }
  }

  // DOCX (both MS Word and Google Docs exported as DOCX)
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/vnd.google-apps.document') {
    try {
      logger.debug('Extracting DOCX from file:', filePath);
      
      // Check file size and existence
      const stats = fs.statSync(filePath);
      logger.debug(`DOCX file size: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        logger.warn('DOCX file is empty (0 bytes)');
        return '';
      }
      
      const result = await mammoth.extractRawText({ path: filePath });
      logger.debug(`DOCX extracted ${result.value.length} characters`);
      return result.value;
    } catch (err) {
      logger.error('DOCX extract error:', err.message);
      logger.debug('DOCX file path:', filePath);
      logger.debug('Full DOCX error:', err);
      
      // Try reading as plain text fallback
      try {
        logger.debug('Attempting plain text fallback for DOCX...');
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.trim()) {
          logger.debug('Plain text fallback succeeded');
          return content;
        }
      } catch (fallbackErr) {
        logger.debug('Plain text fallback also failed:', fallbackErr.message);
      }
      
      return '';
    }
  }

  // TEXT
  if (mimeType.startsWith('text/')) {
    return fs.readFileSync(filePath, 'utf8');
  }

  return '';
}

// -------------------------
// GOOGLE LINK GENERATOR
// -------------------------
function generateGoogleLink(fileId, mimeType) {
  if (mimeType === 'application/vnd.google-apps.document') {
    return `https://docs.google.com/document/d/${fileId}`;
  }
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${fileId}`;
  }
  if (mimeType === 'application/vnd.google-apps.presentation') {
    return `https://docs.google.com/presentation/d/${fileId}`;
  }
  return `https://drive.google.com/file/d/${fileId}`;
}

// -------------------------
// EXTENSION MAP
// -------------------------
function getExtension(mimeType, fileName) {
  const map = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.google-apps.document': '.docx',
    'application/vnd.google-apps.spreadsheet': '.xlsx',
    'application/vnd.google-apps.presentation': '.pdf',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'text/html': '.html'
  };

  if (map[mimeType]) return map[mimeType];
  if (mimeType.startsWith('text/')) return '.txt';
  return path.extname(fileName) || '';
}

// -------------------------
// MAIN INGEST WITH SMART SYNC
// -------------------------
async function ingestDriveFolder(folderId) {
  const syncStartTime = new Date().toISOString();
  logger.info('Folder ID:', folderId);
  logger.info('🔄 Starting smart sync...');

  // Load cache
  const cache = loadCache();
  if (cache.lastSyncTime) {
    logger.info(`📅 Last sync: ${cache.lastSyncTime} (${cache.fileCount} files)`);
  }

  // Get all files from Google Drive
  logger.info('🔍 Fetching files from Google Drive...');
  const driveFiles = await listAllFilesIteratively(folderId);
  logger.info(`Found ${driveFiles.length} files in Google Drive`);

  // Early exit if file count unchanged (quick optimization)
  if (cache.fileCount === driveFiles.length && cache.lastSyncTime) {
    logger.info('💡 File count unchanged, checking for modifications...');
  }

  // Get all existing documents from vector DB
  logger.info('🔍 Fetching documents from vector DB...');
  const existingDocs = await getAll();
  logger.info(`Found ${existingDocs.count} documents in vector DB`);

  // Create map of existing documents by ID
  const existingDocsMap = new Map(existingDocs.documents.map((doc) => [doc.id, doc.metadata]));

  // Track what needs to be updated/added/deleted
  const toAdd = [];
  const toUpdate = [];
  const existingIds = new Set();

  // Check each Drive file with progress indicator
  logger.info('🔄 Comparing files...');
  let checkedCount = 0;
  // eslint-disable-next-line no-restricted-syntax
  for (const file of driveFiles) {
    checkedCount += 1;
    if (checkedCount % 100 === 0 || checkedCount === driveFiles.length) {
      logger.info(`  Progress: ${checkedCount}/${driveFiles.length} files checked`);
    }

    existingIds.add(file.id);
    const existing = existingDocsMap.get(file.id);

    if (!existing) {
      // New file
      toAdd.push(file);
      logger.debug(`➕ New file: ${file.name}`);
    } else if (existing.modifiedTime !== file.modifiedTime) {
      // File was modified
      toUpdate.push(file);
      logger.debug(`🔄 Updated file: ${file.name}`);
    }
    // Removed unchanged logging to reduce noise
  }

  // Find files to delete (in DB but not in Drive)
  const toDelete = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const doc of existingDocs.documents) {
    if (!existingIds.has(doc.id)) {
      toDelete.push(doc.id);
      logger.debug(`🗑️  Deleted from Drive: ${doc.metadata.name}`);
    }
  }

  logger.info(`\n📊 Summary: ${toAdd.length} new, ${toUpdate.length} updated, ${toDelete.length} deleted\n`);

  // Early exit if nothing changed
  if (toAdd.length === 0 && toUpdate.length === 0 && toDelete.length === 0) {
    logger.info('✅ Everything is up to date! No changes detected.');
    // Update cache timestamp even if no changes
    saveCache({
      lastSyncTime: syncStartTime,
      fileCount: driveFiles.length
    });
    return;
  }

  // Delete removed files from vector DB
  if (toDelete.length > 0) {
    logger.info(`🗑️  Deleting ${toDelete.length} documents from vector DB...`);
    await deleteMany(toDelete);
    logger.info(`✅ Deleted ${toDelete.length} documents`);
  }

  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // Process new and updated files
  const filesToProcess = [...toAdd, ...toUpdate];

  // Delete old versions of updated files
  if (toUpdate.length > 0) {
    logger.info(`🔄 Removing ${toUpdate.length} old document versions...`);
    const updateIds = toUpdate.map((f) => f.id);
    deleteMany(updateIds);
    logger.info('✅ Removed old versions');
  }

  // Process files in batches for better performance and stability
  let processedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  logger.info(`\n🚀 Processing ${filesToProcess.length} files in batches of ${BATCH_SIZE}...\n`);

  // eslint-disable-next-line no-restricted-syntax
  for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
    const batch = filesToProcess.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(filesToProcess.length / BATCH_SIZE);

    logger.info(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} files)`);

    // eslint-disable-next-line no-restricted-syntax
    for (const file of batch) {
      try {
        const ext = getExtension(file.mimeType, file.name);
        const destPath = path.join(tmpDir, `${file.id}${ext}`);

        // For Google Sheets, try API first, fallback to XLSX export
        let text = '';
        if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
          logger.debug(`  📊 Reading Google Sheet: ${file.name}`);
          
          // Try Sheets API first (no download needed)
          text = await extractText(null, file.mimeType, file.id);
          
          // If Sheets API failed, download and try XLSX
          if (!text || text.trim().length === 0) {
            logger.debug(`  ⚠️  Sheets API failed, trying XLSX export...`);
            await downloadFile(file.id, destPath, file.mimeType);
            
            if (fs.existsSync(destPath)) {
              text = await extractText(destPath, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', file.id);
            }
          }
        } else {
          // Download and extract other file types
          await downloadFile(file.id, destPath, file.mimeType);

          if (!fs.existsSync(destPath)) {
            logger.warn(`  ⚠️  Missing file after download: ${file.name}`);
            failedCount += 1;
            // eslint-disable-next-line no-continue
            continue;
          }

          text = await extractText(destPath, file.mimeType, file.id);
        }

        if (text?.trim()) {
          // Remove extension from name (it's stored separately in extension field)
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
          
          await addMany([
            {
              id: file.id,
              text,
              metadata: {
                name: nameWithoutExt,
                mimeType: file.mimeType,
                folderPath: file.folderPath || '',
                modifiedTime: file.modifiedTime,
                extension: ext,
                googleLink: generateGoogleLink(file.id, file.mimeType)
              }
            }
          ]);
          logger.debug(`  ✅ Indexed: ${file.name} (${text.length} chars)`);
          processedCount += 1;
        } else {
          logger.debug(`  ⏭️  Skipped (empty): ${file.name}`);
          skippedCount += 1;
        }

        // Clean up temp file
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
      } catch (error) {
        logger.error(`  ❌ Failed to process ${file.name}: ${error.message}`);
        failedCount += 1;
      }
    }

    // Progress indicator
    const totalProcessed = processedCount + failedCount + skippedCount;
    logger.info(
      `  Progress: ${totalProcessed}/${filesToProcess.length} (${processedCount} indexed, ${skippedCount} skipped, ${failedCount} failed)\n`
    );
  }

  // Save cache with updated timestamp
  saveCache({
    lastSyncTime: syncStartTime,
    fileCount: driveFiles.length
  });

  logger.info('✅ Smart sync complete!');
  logger.info(`   Processed: ${processedCount}/${filesToProcess.length}`);
  logger.info(`   Skipped: ${skippedCount} (empty files)`);
  logger.info(`   Failed: ${failedCount}`);
  logger.info(`   Total Drive files: ${driveFiles.length}\n`);
}

// Only run directly if executed as a script (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  ingestDriveFolder(process.env.GOOGLE_DRIVE_FOLDER_ID);
}

export default ingestDriveFolder;
