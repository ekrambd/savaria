import { Router } from 'express';
import { prisma } from '../db';
import { cacheResponse } from '../middleware/cacheMiddleware';
import { requireAdmin } from '../middleware/adminAuth';
import { storeOrders, loadSettingsFromDisk, updateStoreSettings } from '../data/store';

export const customerRouter = Router();

// GET all customers with aggregated past orders and custom labels
customerRouter.get('/admin/list', requireAdmin, async (_req, res) => {
  try {
    const freshSettings = loadSettingsFromDisk();
    const customerLabels = freshSettings?.customerLabels || {};

    const customerMap = new Map<string, any>();

    // Aggregate from in-memory / persisted orders
    storeOrders.forEach((ord: any) => {
      const rawPhone = ord.phone || '';
      const phoneKey = rawPhone.replace(/[\s\-\+]/g, '').slice(-11);
      if (!phoneKey) return;

      const meta = customerLabels[phoneKey] || customerLabels[rawPhone] || {};

      const existing = customerMap.get(phoneKey);
      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpent += Number(ord.totalPrice || 0);
        existing.orders.push(ord);
        if (new Date(ord.createdAt).getTime() > new Date(existing.lastOrderDate).getTime()) {
          existing.lastOrderDate = ord.createdAt;
          existing.name = ord.customerName || existing.name;
          existing.address = ord.address || existing.address;
          existing.district = ord.district || existing.district;
        }
      } else {
        customerMap.set(phoneKey, {
          id: `cust-${phoneKey}`,
          name: ord.customerName || 'Customer',
          phone: ord.phone,
          address: ord.address || '',
          district: ord.district || '',
          totalOrders: 1,
          totalSpent: Number(ord.totalPrice || 0),
          lastOrderDate: ord.createdAt,
          orders: [ord],
          customLabel: meta.label || null,
          adminNotes: meta.notes || null,
          updatedAt: meta.updatedAt || ord.createdAt
        });
      }
    });

    const list = Array.from(customerMap.values()).sort((a, b) => {
      return new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime();
    });

    res.json({ success: true, customers: list });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch customer directory' });
  }
});

// GET single customer details by phone with full order history
customerRouter.get('/admin/details/:phone', requireAdmin, async (req, res) => {
  try {
    const rawPhone = req.params.phone || '';
    const phoneKey = rawPhone.replace(/[\s\-\+]/g, '').slice(-11);

    const freshSettings = loadSettingsFromDisk();
    const customerLabels = freshSettings?.customerLabels || {};
    const meta = customerLabels[phoneKey] || customerLabels[rawPhone] || {};

    const matchedOrders = storeOrders.filter((ord: any) => {
      const p = (ord.phone || '').replace(/[\s\-\+]/g, '').slice(-11);
      return p === phoneKey || ord.phone === rawPhone;
    }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (matchedOrders.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const latest = matchedOrders[0];
    const totalSpent = matchedOrders.reduce((sum: number, o: any) => sum + Number(o.totalPrice || 0), 0);

    const customerDetails = {
      id: `cust-${phoneKey}`,
      name: latest.customerName || 'Customer',
      phone: latest.phone,
      address: latest.address,
      district: latest.district,
      totalOrders: matchedOrders.length,
      totalSpent,
      firstOrderDate: matchedOrders[matchedOrders.length - 1].createdAt,
      lastOrderDate: latest.createdAt,
      orders: matchedOrders,
      customLabel: meta.label || null,
      adminNotes: meta.notes || null,
      updatedAt: meta.updatedAt || null
    };

    res.json({ success: true, customer: customerDetails });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch customer details' });
  }
});

// POST assign custom label to customer (e.g. VIP, School, Unity)
customerRouter.post('/admin/label', requireAdmin, async (req, res) => {
  try {
    const { phone, label, notes } = req.body || {};
    const cleanPhone = String(phone || '').replace(/[\s\-\+]/g, '').slice(-11);

    if (!cleanPhone) {
      return res.status(400).json({ success: false, message: 'Customer phone number is required' });
    }

    const freshSettings = loadSettingsFromDisk();
    const customerLabels = { ...(freshSettings?.customerLabels || {}) };

    customerLabels[cleanPhone] = {
      label: (label || '').trim(),
      notes: (notes || '').trim(),
      updatedAt: new Date().toISOString()
    };

    updateStoreSettings({ customerLabels });

    res.json({
      success: true,
      message: `Customer label updated to "${label || 'None'}"`,
      phone: cleanPhone,
      label: (label || '').trim(),
      notes: (notes || '').trim()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update customer label' });
  }
});

// GET customer addresses by phone (Public for logged in customer)
customerRouter.get('/address/by-phone', async (req, res) => {
  const phone = String(req.query.phone || '').replace(/\D/g, '').replace(/^880/, '0').replace(/^88/, '');
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Phone is required' });
  }

  try {
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone },
          { phone: `+88${phone}` },
          { phone: `88${phone}` }
        ]
      }
    });

    let addresses: any[] = [];
    if (customer && (customer as any).addresses) {
      try {
        addresses = typeof (customer as any).addresses === 'string' 
          ? JSON.parse((customer as any).addresses) 
          : (customer as any).addresses;
      } catch {}
    }

    // If no explicit addresses array but has main address, synthesize default
    if (addresses.length === 0 && customer?.address) {
      addresses = [{
        id: `addr-${Date.now()}`,
        name: customer.name || 'Default Customer',
        phone: customer.phone,
        address: customer.address,
        deliveryArea: customer.district || 'Dhaka',
        addressType: 'Home',
        isDefault: true
      }];
    }

    res.json({
      success: true,
      addresses,
      customer: customer ? {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email
      } : null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch customer addresses' });
  }
});

// POST save / update customer address
customerRouter.post('/address/save', async (req, res) => {
  const { phone, addressItem } = req.body || {};
  const cleanPhone = String(phone || '').replace(/\D/g, '').replace(/^880/, '0').replace(/^88/, '');

  if (!cleanPhone || !addressItem) {
    return res.status(400).json({ success: false, message: 'Phone and addressItem are required' });
  }

  try {
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { phone: `+88${cleanPhone}` },
          { phone: `88${cleanPhone}` }
        ]
      }
    });

    let addresses: any[] = [];
    if (customer && (customer as any).addresses) {
      try {
        addresses = typeof (customer as any).addresses === 'string'
          ? JSON.parse((customer as any).addresses)
          : (customer as any).addresses;
      } catch {}
    }

    const addrId = addressItem.id || `addr-${Date.now()}`;
    const newAddress = {
      id: addrId,
      name: addressItem.name || customer?.name || 'Customer',
      phone: addressItem.phone || cleanPhone,
      address: addressItem.address || '',
      deliveryArea: addressItem.deliveryArea || '',
      addressType: addressItem.addressType || 'Home',
      isDefault: Boolean(addressItem.isDefault)
    };

    if (newAddress.isDefault) {
      addresses = addresses.map(a => ({ ...a, isDefault: false }));
    }

    const existingIdx = addresses.findIndex(a => a.id === addrId);
    if (existingIdx >= 0) {
      addresses[existingIdx] = newAddress;
    } else {
      // If first address, make it default
      if (addresses.length === 0) newAddress.isDefault = true;
      addresses.push(newAddress);
    }

    // Persist or create customer record
    if (customer) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: addressItem.name || customer.name,
          address: newAddress.address,
          district: newAddress.deliveryArea,
          addresses: JSON.stringify(addresses) as any
        }
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          name: addressItem.name || 'Customer',
          phone: cleanPhone,
          address: newAddress.address,
          district: newAddress.deliveryArea,
          addresses: JSON.stringify(addresses) as any
        }
      });
    }

    res.json({
      success: true,
      address: newAddress,
      addresses
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to save address' });
  }
});

// GET all customers
customerRouter.get('/', cacheResponse({ ttlSeconds: 60, staleWhileRevalidateSeconds: 120, tag: 'customers' }), async (req, res) => {
  try {
    const items = await prisma.customer.findMany();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET by ID
customerRouter.get('/:id', async (req, res) => {
  try {
    const item = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (item) res.json(item);
    else res.status(404).json({ error: 'Not found' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// POST create
customerRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const item = await prisma.customer.create({ data: req.body });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create' });
  }
});

// PUT update
customerRouter.put('/:id', requireAdmin, async (req, res) => {
  try {
    const item = await prisma.customer.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update' });
  }
});

// DELETE
customerRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});
