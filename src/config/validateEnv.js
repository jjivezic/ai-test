import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Validates that all required environment variables from .env.example are present
 * @throws {Error} If any required environment variable is missing
 */
export const validateEnv = () => {
  const envExamplePath = path.join(__dirname, '../../.env.example');
  
  if (!fs.existsSync(envExamplePath)) {
    console.warn('Warning: .env.example file not found. Skipping environment validation.');
    return;
  }

  const envExample = fs.readFileSync(envExamplePath, 'utf8');
  const requiredVars = [];
  
  // Parse .env.example to extract variable names
  envExample.split('\n').forEach(line => {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (trimmed && !trimmed.startsWith('#')) {
      const [varName] = trimmed.split('=');
      if (varName) {
        requiredVars.push(varName.trim());
      }
    }
  });

  // Check for missing variables
  const missingVars = requiredVars.filter(varName => {
    const value = process.env[varName];
    return !value || value === '' || value.startsWith('your_');
  });

  if (missingVars.length > 0) {
    const errorMessage = `
╔════════════════════════════════════════════════════════════════╗
║  ENVIRONMENT CONFIGURATION ERROR                               ║
╚════════════════════════════════════════════════════════════════╝

Missing or invalid environment variables:
${missingVars.map(v => `  ❌ ${v}`).join('\n')}

Please ensure all required variables are set in your .env file.
You can use .env.example as a reference.
    `.trim();

    throw new Error(errorMessage);
  }

  console.log('✅ Environment variables validated successfully');
};

export default validateEnv;
