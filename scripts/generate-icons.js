/**
 * Script to generate PWA icons from SVG source
 * Run: node scripts/generate-icons.js
 * Requires: npm install sharp
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('Sharp not installed. Install with: npm install sharp -D');
    console.log('Creating placeholder icons instead...');
    await createPlaceholderIcons();
    return;
  }

  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  const svgPath = path.join(__dirname, '../public/icons/icon.svg');
  const outputDir = path.join(__dirname, '../public/icons');

  const svgBuffer = fs.readFileSync(svgPath);

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: icon-${size}x${size}.png`);
  }

  console.log('All icons generated successfully!');
}

async function createPlaceholderIcons() {
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  const outputDir = path.join(__dirname, '../public/icons');

  // Create simple 1x1 blue PNG as placeholder (will be stretched)
  // This is a minimal valid PNG with blue color #3b82f6
  const minimalBluePng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, // IHDR length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, // bit depth: 8, color type: 2 (RGB)
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x90, 0x77, 0x53, 0xde, // CRC
    0x00, 0x00, 0x00, 0x0c, // IDAT length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0xd7, 0x63, 0x38, 0xec, 0xc5, 0x00, 0x00, 0x00, 0x8d, 0x00, 0x81, // compressed data
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4e, 0x44, // IEND
    0xae, 0x42, 0x60, 0x82  // CRC
  ]);

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    fs.writeFileSync(outputPath, minimalBluePng);
    console.log(`Created placeholder: icon-${size}x${size}.png`);
  }

  console.log('\nPlaceholder icons created. For proper icons:');
  console.log('1. Install sharp: npm install sharp -D');
  console.log('2. Run again: node scripts/generate-icons.js');
  console.log('Or use an online tool to convert public/icons/icon.svg to PNGs');
}

generateIcons().catch(console.error);
