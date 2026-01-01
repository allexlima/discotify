/**
 * Discotify Icon Generator Script
 * Generates PNG icons from the SVG source
 *
 * Usage: node scripts/generate-icons.js
 *
 * Prerequisites:
 *   npm install sharp
 *
 * Or use external tools:
 *   - Inkscape: inkscape -w 128 -h 128 icons/icon.svg -o icons/icon128.png
 *   - ImageMagick: convert -background none -resize 128x128 icons/icon.svg icons/icon128.png
 */

'use strict';

const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, '..', 'icons');
const svgPath = path.join(iconsDir, 'icon.svg');

async function generateIcons() {
  // Try to use Sharp if available
  try {
    const sharp = require('sharp');

    console.log('=== Discotify Icon Generator ===\n');
    console.log('Using Sharp to generate PNG icons...\n');

    const svgBuffer = fs.readFileSync(svgPath);

    for (const size of sizes) {
      const outputPath = path.join(iconsDir, `icon${size}.png`);

      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated icon${size}.png`);
    }

    console.log('\n✅ All icons generated successfully!');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      showManualInstructions();
    } else {
      console.error('Error generating icons:', error.message);
    }
  }
}

function showManualInstructions() {
  console.log('=== Discotify Icon Generator ===\n');
  console.log('Sharp module not found. To generate PNG icons:\n');

  console.log('Option 1: Install Sharp and run again');
  console.log('  npm install sharp');
  console.log('  node scripts/generate-icons.js\n');

  console.log('Option 2: Use Inkscape (command line)');
  sizes.forEach(size => {
    console.log(`  inkscape -w ${size} -h ${size} icons/icon.svg -o icons/icon${size}.png`);
  });

  console.log('\nOption 3: Use ImageMagick');
  sizes.forEach(size => {
    console.log(`  convert -background none -resize ${size}x${size} icons/icon.svg icons/icon${size}.png`);
  });

  console.log('\nOption 4: Online converters');
  console.log('  - https://cloudconvert.com/svg-to-png');
  console.log('  - https://svgtopng.com/');
  console.log('  - https://convertio.co/svg-png/');
}

generateIcons();
