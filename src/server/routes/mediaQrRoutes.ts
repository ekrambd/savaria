import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth';
import { loadSettingsFromDisk, saveSettingsToDisk, setStoreSettings } from '../data/store';
import { MediaQrItem } from '../../types';
import { globalCache } from '../services/cacheEngine';

export const mediaQrRouter = Router();

// GET /api/media-qr - Get all media items (public for QR resolution or admin)
mediaQrRouter.get('/', (req, res) => {
  try {
    const settings = loadSettingsFromDisk();
    const items: MediaQrItem[] = settings.mediaQrItems || [];
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, items: [] });
  }
});

// GET /api/media-qr/:code - Resolve media item by shortCode or ID
mediaQrRouter.get('/:code', (req, res) => {
  try {
    const { code } = req.params;
    const settings = loadSettingsFromDisk();
    const items: MediaQrItem[] = settings.mediaQrItems || [];
    const item = items.find(m => m.shortCode.toLowerCase() === code.toLowerCase() || m.id === code);

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

    const newItem: MediaQrItem = {
      id: raw.id || `media-${Date.now()}`,
      title: raw.title || 'Untitled',
      mediaType: raw.mediaType || 'video',
      fileUrl: fileUrl,
      youtubeUrl: raw.youtubeUrl || (raw.mediaType === 'youtube' ? fileUrl : undefined),
      description: raw.description,
      shortCode: raw.customShortCode || raw.shortCode || `v-${Date.now().toString(36)}`,
      bookTitle: raw.bookTitle,
      pageNumber: raw.pageNumber,
      createdAt: raw.createdAt || new Date().toISOString()
    };

    const settings = loadSettingsFromDisk();
    const items: MediaQrItem[] = settings.mediaQrItems || [];

    // Generate unique shortCode if not provided
    if (!newItem.shortCode) {
      newItem.shortCode = `v-${Date.now().toString(36)}`;
    }
    // Clean code: alphanumeric, dashes
    newItem.shortCode = newItem.shortCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    if (!newItem.id) {
      newItem.id = `media-${Date.now()}`;
    }
    if (!newItem.createdAt) {
      newItem.createdAt = new Date().toISOString();
    }

    // Replace if exists, or append
    const existingIndex = items.findIndex(m => m.id === newItem.id || m.shortCode === newItem.shortCode);
    if (existingIndex !== -1) {
      items[existingIndex] = newItem;
    } else {
      items.unshift(newItem);
    }

    const updatedSettings = {
      ...settings,
      mediaQrItems: items
    };

    saveSettingsToDisk(updatedSettings);
    setStoreSettings(updatedSettings);
    globalCache.invalidateTag('settings');

    res.json({ success: true, item: newItem });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/media-qr/:id - Update existing media item
mediaQrRouter.put('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const settings = loadSettingsFromDisk();
    const items: MediaQrItem[] = settings.mediaQrItems || [];

    const index = items.findIndex(m => m.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Media item not found' });
    }

    items[index] = {
      ...items[index],
      ...updateData,
      id
    };

    const updatedSettings = {
      ...settings,
      mediaQrItems: items
    };

    saveSettingsToDisk(updatedSettings);
    setStoreSettings(updatedSettings);
    globalCache.invalidateTag('settings');

    res.json({ success: true, item: items[index] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/media-qr/:id - Delete media item
mediaQrRouter.delete('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const settings = loadSettingsFromDisk();
    const items: MediaQrItem[] = settings.mediaQrItems || [];

    const filtered = items.filter(m => m.id !== id);

    const updatedSettings = {
      ...settings,
      mediaQrItems: filtered
    };

    saveSettingsToDisk(updatedSettings);
    setStoreSettings(updatedSettings);
    globalCache.invalidateTag('settings');

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
