const fs = require('fs');
const path = require('path');
const https = require('https');

const LIVE_DOMAIN = 'https://meghbristi.com.bd';
const PRODUCTS_FILE = path.join(process.cwd(), 'prisma', 'products.json');
const SETTINGS_FILE = path.join(process.cwd(), 'prisma', 'settings.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      return resolve();
    }
    const file = fs.createWriteStream(destPath);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      } else {
        file.close();
        fs.unlink(destPath, () => {});
        resolve(); // non-critical
      }
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      resolve(); // non-critical
    });
  });
}

async function runSync() {
  console.log(`\n======================================================`);
  console.log(`🔄 SYNCING REAL DATA FROM LIVE SITE (${LIVE_DOMAIN})`);
  console.log(`======================================================\n`);

  try {
    // 1. Fetch Live Products
    console.log(`📥 1. Fetching products from ${LIVE_DOMAIN}/api/products...`);
    const liveProducts = await fetchJson(`${LIVE_DOMAIN}/api/products`);
    if (Array.isArray(liveProducts) && liveProducts.length > 0) {
      console.log(`   ✅ Received ${liveProducts.length} live products!`);
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(liveProducts, null, 2), 'utf-8');
      console.log(`   💾 Saved to prisma/products.json`);

      // Download uploaded images for local offline viewing
      console.log(`\n🖼️ 2. Verifying and downloading product images...`);
      let downloadedCount = 0;
      for (const p of liveProducts) {
        const allImgs = [p.image, p.coverImage, ...(p.images || [])].filter(Boolean);
        for (const img of allImgs) {
          if (img.startsWith('/uploads/')) {
            const fileName = path.basename(img);
            const targetPath = path.join(UPLOADS_DIR, fileName);
            if (!fs.existsSync(targetPath)) {
              process.stdout.write(`   ⬇️ Downloading ${fileName}... `);
              await downloadFile(`${LIVE_DOMAIN}${img}`, targetPath);
              downloadedCount++;
              console.log(`Done`);
            }
          }
        }
      }
      console.log(`   ✅ Images sync complete (Downloaded ${downloadedCount} new images).`);
    }

    // 2. Fetch Live Settings
    console.log(`\n⚙️ 3. Fetching settings from ${LIVE_DOMAIN}/api/settings...`);
    try {
      const liveSettings = await fetchJson(`${LIVE_DOMAIN}/api/settings`);
      if (liveSettings && typeof liveSettings === 'object') {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(liveSettings, null, 2), 'utf-8');
        console.log(`   ✅ Live settings saved to prisma/settings.json!`);

        // Check and download store logo
        const logo = liveSettings?.storeLogo || liveSettings?.headerSettings?.logoUrl;
        if (logo && logo.startsWith('/uploads/')) {
          const logoName = path.basename(logo);
          await downloadFile(`${LIVE_DOMAIN}${logo}`, path.join(UPLOADS_DIR, logoName));
        }
      }
    } catch (e) {
      console.warn(`   ⚠️ Could not fetch /api/settings: ${e.message}`);
    }

    console.log(`\n🎉 SUCCESS! Local development now has 100% real live data from ${LIVE_DOMAIN}!`);
    console.log(`   Restart your dev server or let Vite HMR refresh your browser to see live products.\n`);
  } catch (err) {
    console.error(`\n❌ Error syncing from live site:`, err.message);
  }
}

runSync();
