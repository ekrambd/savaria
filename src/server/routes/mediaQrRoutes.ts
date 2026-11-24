import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth';
import { loadSettingsFromDisk, saveSettingsToDisk, setStoreSettings } from '../data/store';
import { MediaQrItem } from '../../types';
import { globalCache } from '../services/cacheEngine';
import fs from 'fs';
import path from 'path';

export const mediaQrRouter = Router();

// Permanent dedicated storage file in addition to settings.json
const MEDIA_QR_PERMANENT_FILE = path.join(process.cwd(), 'prisma', 'media_qr_items.json');
const MEDIA_QR_BACKUP_DIR = path.join(process.cwd(), '.backups', 'media_qr');

// Helper to ensure backups directory
function ensureBackupDir() {
  if (!fs.existsSync(MEDIA_QR_BACKUP_DIR)) {
    fs.mkdirSync(MEDIA_QR_BACKUP_DIR, { recursive: true });
  }
}

// Load items safely from both settings.json and dedicated media_qr_items.json
function getAllMediaQrItems(): MediaQrItem[] {
  let items: MediaQrItem[] = [];

  // 1. Try dedicated file first
  try {
    if (fs.existsSync(MEDIA_QR_PERMANENT_FILE)) {
      const raw = fs.readFileSync(MEDIA_QR_PERMANENT_FILE, 'utf-8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          items = parsed;
        }
      }
    }
  } catch (err) {
    console.warn('[MediaQR] Error reading dedicated media_qr_items.json:', err);
  }

  // 2. Fallback / Merge with settings.json
  try {
    const settings = loadSettingsFromDisk();
    const settingsItems: MediaQrItem[] = settings.mediaQrItems || [];
    if (settingsItems.length > 0) {
      if (items.length === 0) {
        items = settingsItems;
      } else {
        // Merge without duplicating
        const map = new Map<string, MediaQrItem>();
        items.forEach(it => map.set(it.id || it.shortCode, it));
        settingsItems.forEach(it => {
          const key = it.id || it.shortCode;
          if (!map.has(key)) {
            map.set(key, it);
          }
        });
        items = Array.from(map.values());
      }
    }
  } catch (err) {
    console.warn('[MediaQR] Error reading from settings.json:', err);
  }

  return items;
}

// Save items synchronously to both dedicated file + settings.json + timestamped backup
function persistMediaQrItems(items: MediaQrItem[]): void {
  // 1. Dedicated file
  try {
    const dir = path.dirname(MEDIA_QR_PERMANENT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEDIA_QR_PERMANENT_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('[MediaQR] Error writing to media_qr_items.json:', err);
  }

  // 2. Redundant backup
  try {
    ensureBackupDir();
    const backupFile = path.join(MEDIA_QR_BACKUP_DIR, `media_qr_backup_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(items, null, 2), 'utf-8');

    // Keep only last 10 backups to prevent bloat
    const files = fs.readdirSync(MEDIA_QR_BACKUP_DIR)
      .filter(f => f.startsWith('media_qr_backup_'))
      .sort()
      .reverse();
    if (files.length > 10) {
      for (let i = 10; i < files.length; i++) {
        try { fs.unlinkSync(path.join(MEDIA_QR_BACKUP_DIR, files[i])); } catch {}
      }
    }
  } catch (err) {
    console.warn('[MediaQR] Backup write warning:', err);
  }

  // 3. Keep in settings.json as well
  try {
    const settings = loadSettingsFromDisk();
    const updatedSettings = {
      ...settings,
      mediaQrItems: items
    };
    saveSettingsToDisk(updatedSettings);
    setStoreSettings(updatedSettings);
    globalCache.invalidateTag('settings');
  } catch (err) {
    console.error('[MediaQR] Error writing to settings.json:', err);
  }
}

// GET /api/media-qr - Get all media items (public for QR resolution or admin)
mediaQrRouter.get('/', (req, res) => {
  try {
    const items = getAllMediaQrItems();
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, items: [] });
  }
});

// GET /api/media-qr/:code - Resolve media item by shortCode or ID (Supports Bangla / URL Decoded)
mediaQrRouter.get('/:code', (req, res) => {
  try {
    const rawCode = req.params.code || '';
    let decodedCode = rawCode;
    try {
      decodedCode = decodeURIComponent(rawCode);
    } catch {}

    const items = getAllMediaQrItems();
    const normalizedRaw = rawCode.trim().toLowerCase();
    const normalizedDecoded = decodedCode.trim().toLowerCase();
    
    // Look up by shortCode or exact id (matching either decoded Bangla or encoded)
    const item = items.find(m => {
      const itemCode = (m.shortCode || '').trim().toLowerCase();
      return (
        itemCode === normalizedDecoded || 
        itemCode === normalizedRaw || 
        m.id === rawCode || 
        m.id === decodedCode
      );
    });

    if (!item) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    res.json({ success: true, item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/media-qr - Add new media item
mediaQrRouter.post('/', requireAdmin, (req, res) => {
  try {
    const raw = req.body || {};
    const fileUrl = raw.fileUrl || raw.mediaUrl || raw.youtubeUrl || '';
    if (!fileUrl) {
      return res.status(400).json({ success: false, error: 'Media file URL or YouTube URL is required' });
    }

    // Determine short code (Supports Bangla/Unicode, English, numbers, hyphens and underscores)
    const shortCodeRaw = raw.customShortCode || raw.shortCode || `v-${Date.now().toString(36)}`;
    const shortCode = shortCodeRaw.trim().toLowerCase().replace(/[\s/\\?#%&+=@!$^&*()~`'"|<>:;{}[\]]+/g, '-');

    const newItem: MediaQrItem = {
      id: raw.id || `media-${Date.now()}`,
      title: raw.title || 'Untitled',
      mediaType: raw.mediaType || 'video',
      fileUrl: fileUrl,
      youtubeUrl: raw.youtubeUrl || (raw.mediaType === 'youtube' ? fileUrl : undefined),
      description: raw.description,
      shortCode: shortCode,
      bookTitle: raw.bookTitle,
      pageNumber: raw.pageNumber,
      createdAt: raw.createdAt || new Date().toISOString()
    };

    const items = getAllMediaQrItems();

    // Prevent duplicate: replace if same id or same shortCode exists
    const existingIndex = items.findIndex(m => m.id === newItem.id || m.shortCode === newItem.shortCode);
    if (existingIndex !== -1) {
      items[existingIndex] = {
        ...items[existingIndex],
        ...newItem,
        // Keep original createdAt and immutable shortCode
        createdAt: items[existingIndex].createdAt || newItem.createdAt,
        shortCode: items[existingIndex].shortCode || newItem.shortCode
      };
    } else {
      items.unshift(newItem);
    }

    persistMediaQrItems(items);

    res.json({ success: true, item: newItem });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/media-qr/:id - Update existing media item (Short code remains permanent)
mediaQrRouter.put('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body || {};
    const items = getAllMediaQrItems();

    const index = items.findIndex(m => m.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Media item not found' });
    }

    // Preserve immutable short code so printed books NEVER break
    const permanentShortCode = items[index].shortCode;

    items[index] = {
      ...items[index],
      ...updateData,
      id,
      shortCode: permanentShortCode // Immutable for life
    };

    persistMediaQrItems(items);

    res.json({ success: true, item: items[index] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/media-qr/:id - Delete media item
mediaQrRouter.delete('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const items = getAllMediaQrItems();
    const filtered = items.filter(m => m.id !== id);

    persistMediaQrItems(filtered);

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
