import { Router } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/adminAuth';
import { globalCache } from '../services/cacheEngine';
import { loadSettingsFromDisk } from '../data/store';

export const brandRouter = Router();

// No static seed brands - returns empty array unless created in admin/db
const DEFAULT_STORE_BRANDS: any[] = [];

// GET all brands - Always fresh
brandRouter.get('/', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  try {
    const items = await prisma.brand.findMany();
    if (items && items.length > 0) {
      return res.json(items);
    }
  } catch (error) {
    // fallback to file/defaults
  }

  try {
    const currentSettings = loadSettingsFromDisk();
    if (currentSettings.featuredBrands?.brands && currentSettings.featuredBrands.brands.length > 0) {
      return res.json(currentSettings.featuredBrands.brands.map(b => ({
        id: b.id,
        name: b.name,
        logo: b.logoUrl,
        website: b.website
      })));
    }
  } catch {}

  res.json(DEFAULT_STORE_BRANDS);
});

// GET by ID
brandRouter.get('/:id', async (req, res) => {
  try {
    const item = await prisma.brand.findUnique({ where: { id: req.params.id } });
    if (item) res.json(item);
    else res.status(404).json({ error: 'Not found' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// POST create or upsert
brandRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const id = req.body.id || `brand-${Date.now()}`;
    const data = {
      name: req.body.name,
      logo: req.body.logo || null,
      description: req.body.description || null,
      website: req.body.website || null
    };

    const item = await prisma.brand.upsert({
      where: { id },
      update: data,
      create: { id, ...data }
    });

    globalCache.invalidateTag('brands');
    res.status(201).json(item);
  } catch (error: any) {
    console.error('Failed to save brand:', error);
    res.status(500).json({ error: error.message || 'Failed to save brand' });
  }
});

// PUT update
brandRouter.put('/:id', requireAdmin, async (req, res) => {
  try {
    const item = await prisma.brand.update({
      where: { id: req.params.id },
      data: req.body
    });
    globalCache.invalidateTag('brands');
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update' });
  }
});

// DELETE
brandRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.brand.deleteMany({ where: { id: req.params.id } });
    globalCache.invalidateTag('brands');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});
