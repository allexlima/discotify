#!/usr/bin/env node

/**
 * Build Script for Discotify Chrome Extension
 *
 * Creates a production-ready zip file for Chrome Web Store upload.
 * Excludes development files and validates manifest.json before building.
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const DIST_DIR = 'dist';
const OUTPUT_FILE = 'extension.zip';

// Files and directories to exclude from the build
const EXCLUDE_PATTERNS = [
  '.git',
  '.github',
  'node_modules',
  'dist',
  'scripts',
  '.eslintrc.json',
  '.prettierrc',
  '.gitignore',
  'package.json',
  'package-lock.json',
  'promo-generator.html',
  'README.md',
  'LICENSE',
  'PRIVACY_POLICY.md',
  '.DS_Store'
];

function validateManifest() {
  console.log('🔍 Validating manifest.json...');

  try {
    const manifestPath = path.join(process.cwd(), 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Validate required fields
    const required = ['manifest_version', 'name', 'version', 'description'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field in manifest.json: ${field}`);
      }
    }

    // Validate version format
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(manifest.version)) {
      throw new Error(`Invalid version format: ${manifest.version}. Must be X.Y.Z`);
    }

    console.log(`✅ Manifest valid: ${manifest.name} v${manifest.version}`);
    return manifest;
  } catch (error) {
    console.error(`❌ Manifest validation failed: ${error.message}`);
    process.exit(1);
  }
}

function shouldExclude(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return EXCLUDE_PATTERNS.some(pattern => {
    if (normalizedPath === pattern) return true;
    if (normalizedPath.startsWith(pattern + '/')) return true;
    if (normalizedPath.endsWith('/' + pattern)) return true;
    return false;
  });
}

async function createZip(manifest) {
  return new Promise((resolve, reject) => {
    console.log('\n📦 Creating extension package...');

    // Create dist directory if it doesn't exist
    if (!fs.existsSync(DIST_DIR)) {
      fs.mkdirSync(DIST_DIR, { recursive: true });
    }

    const outputPath = path.join(DIST_DIR, OUTPUT_FILE);
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`✅ Package created: ${outputPath} (${sizeInMB} MB)`);
      console.log(`   Files: ${archive.pointer()} bytes`);
      resolve(outputPath);
    });

    archive.on('error', reject);
    archive.on('warning', (err) => {
      if (err.code !== 'ENOENT') {
        console.warn('⚠️  Warning:', err.message);
      }
    });

    archive.pipe(output);

    // Add files to archive
    const rootDir = process.cwd();
    let fileCount = 0;

    function addDirectory(dirPath, zipPath = '') {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(rootDir, fullPath);
        const zipFilePath = zipPath ? path.join(zipPath, entry.name) : entry.name;

        if (shouldExclude(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          addDirectory(fullPath, zipFilePath);
        } else if (entry.isFile()) {
          archive.file(fullPath, { name: zipFilePath });
          fileCount++;
          process.stdout.write(`\r   Adding files... ${fileCount}`);
        }
      }
    }

    addDirectory(rootDir);

    console.log(`\n   Total files added: ${fileCount}`);
    archive.finalize();
  });
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Discotify Extension Builder                                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    const manifest = validateManifest();
    await createZip(manifest);

    console.log('\n✅ Build complete!');
    console.log('\n📤 Ready to upload to Chrome Web Store');
    console.log(`   Extension: ${manifest.name} v${manifest.version}`);
    console.log(`   Package: dist/${OUTPUT_FILE}\n`);
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

main();
