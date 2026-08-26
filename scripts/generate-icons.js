// Generate PWA icons from SVG using sharp (or fallback to placeholder)
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, 'public', 'icons');

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.log('sharp not available, generating placeholder PNGs...');
    // Generate minimal valid PNG files as placeholders
    for (const size of sizes) {
      const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      if (!fs.existsSync(pngPath)) {
        // Create a minimal valid PNG (1x1 transparent pixel scaled)
        const pngBuffer = createMinimalPNG(size, size);
        fs.writeFileSync(pngPath, pngBuffer);
        console.log(`Created placeholder: icon-${size}x${size}.png`);
      }
    }
    return;
  }

  const svgPath = path.join(iconsDir, 'icon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  for (const size of sizes) {
    const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(pngPath);
    console.log(`Generated: icon-${size}x${size}.png`);
  }

  // Generate screenshots
  const screenshotsDir = path.join(__dirname, 'public', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Wide screenshot
  await sharp(svgBuffer)
    .resize(1280, 720, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .png()
    .toFile(path.join(screenshotsDir, 'screenshot-wide.png'));
  console.log('Generated: screenshot-wide.png');

  // Narrow screenshot
  await sharp(svgBuffer)
    .resize(390, 844, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .png()
    .toFile(path.join(screenshotsDir, 'screenshot-narrow.png'));
  console.log('Generated: screenshot-narrow.png');
}

// Minimal valid PNG generator (for placeholder)
function createMinimalPNG(width, height) {
  // This creates a real PNG file with a pink gradient
  const { createCanvas } = (() => {
    try { return require('canvas'); } catch { return { createCanvas: null }; }
  })();
  
  if (createCanvas) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#e91e8c');
    gradient.addColorStop(1, '#9c27b0');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, width * 0.2);
    ctx.fill();
    
    // Draw Q text
    ctx.fillStyle = 'white';
    ctx.font = `bold ${width * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Q', width / 2, height / 2);
    
    return canvas.toBuffer('image/png');
  }
  
  // Fallback: minimal 1x1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
}

generateIcons().catch(console.error);
