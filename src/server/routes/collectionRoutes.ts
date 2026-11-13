import { Router } from 'express';
import { loadSettingsFromDisk, saveSettingsToDisk, storeSettings, setStoreSettings } from '../data/store';
import { FeaturedCollection } from '../../types';
import { globalCache } from '../services/cacheEngine';

export const collectionRouter = Router();

// GET /api/collections
collectionRouter.get('/', (req, res) => {
  try {
    const settings = loadSettingsFromDisk();
    const collections: FeaturedCollection[] = settings?.featuredCollections || [];
    res.json({ success: true, collections });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, collections: [] });
  }
});

// GET /api/collections/:id
collectionRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const settings = loadSettingsFromDisk();
    const collections: FeaturedCollection[] = settings?.featuredCollections || [];
    const collection = collections.find(c => c.id === id);
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }
    res.json({ success: true, collection });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/collections - create or update a collection
collectionRouter.post('/', (req, res) => {
  try {
    const newCol: FeaturedCollection = req.body;
    if (!newCol || !newCol.title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    if (!newCol.id) {
      newCol.id = `col-${Date.now()}`;
    }

    const settings = loadSettingsFromDisk();
    const collections = settings?.featuredCollections || [];
    const index = collections.findIndex(c => c.id === newCol.id);

    if (index !== -1) {
      collections[index] = newCol;
    } else {
      collections.push(newCol);
    }

    const updatedSettings = {
      ...settings,
      featuredCollections: collections
    };

    saveSettingsToDisk(updatedSettings);
    setStoreSettings(updatedSettings);
    globalCache.invalidateTag('settings');

    res.json({ success: true, collection: newCol });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/collections/:id
collectionRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const settings = loadSettingsFromDisk();
    const collections = settings?.featuredCollections || [];
    const index = collections.findIndex(c => c.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }

    collections[index] = {
      ...collections[index],
      ...updateData,
      id
    };

    const updatedSettings = {
      ...settings,
      featuredCollections: collections
    };

    saveSettingsToDisk(updatedSettings);
    setStoreSettings(updatedSettings);
    globalCache.invalidateTag('settings');

    res.json({ success: true, collection: collections[index] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/collections/:id
collectionRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const settings = loadSettingsFromDisk();
    const collections = settings?.featuredCollections || [];
    const updatedCollections = collections.filter(c => c.id !== id);

    const updatedSettings = {
      ...settings,
      featuredCollections: updatedCollections
    };

    saveSettingsToDisk(updatedSettings);
    setStoreSettings(updatedSettings);
    globalCache.invalidateTag('settings');

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
