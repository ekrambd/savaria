import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  Flame, 
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  Tag,
  Search,
  Percent,
  Timer
} from 'lucide-react';
import { Product, EcomSettings, FlashSaleSettings, FlashSaleItem } from '../types';
import { dbService } from '../lib/dbService';
import { DEFAULT_FLASH_SALE_SETTINGS } from '../lib/constants';

interface FlashSaleManagerProps {
  products: Product[];
  onSettingsUpdated?: () => void;
}

export default function FlashSaleManager({ products, onSettingsUpdated }: FlashSaleManagerProps) {
  const [ecomSettings, setEcomSettings] = useState<EcomSettings | null>(null);
  const [flashSale, setFlashSale] = useState<FlashSaleSettings>(DEFAULT_FLASH_SALE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Product Search / Selector State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customFlashPrice, setCustomFlashPrice] = useState<number>(0);
  const [productSearch, setProductSearch] = useState<string>('');

  // Live Countdown Demo State for Preview
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; isExpired: boolean }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });

  // Load Settings from DB
  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const settings = await dbService.getEcomSettings();
        setEcomSettings(settings);
        if (settings.flashSale) {
          const loadedSale = settings.flashSale;
          let items: FlashSaleItem[] = loadedSale.items || [];
          
          // Migrate legacy single product flash sale if items array is empty
          if (items.length === 0 && loadedSale.productId) {
            items = [{
              productId: loadedSale.productId,
              flashPrice: loadedSale.flashPrice || 0,
              originalPrice: loadedSale.originalPrice || 0
            }];
          }

          setFlashSale({
            ...DEFAULT_FLASH_SALE_SETTINGS,
            ...loadedSale,
            items
          });
        }
      } catch (err) {
        console.error('Failed to load flash sale settings:', err);
        setErrorMsg('Failed to load settings from database.');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  // Update Countdown Timer
  useEffect(() => {
    const calculateTime = () => {
      if (!flashSale.endDate) return;
      const difference = +new Date(flashSale.endDate) - +new Date();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
          isExpired: false
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [flashSale.endDate]);

  // List of products that can still be added (not yet in campaign)
  const availableProducts = useMemo(() => {
    const itemIds = new Set((flashSale.items || []).map(i => i.productId));
    let list = products.filter(p => !itemIds.has(p.id));
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase().trim();
      list = list.filter(p => p.title.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)));
    }
    return list;
  }, [products, flashSale.items, productSearch]);

  // Set default selection when availableProducts changes
  useEffect(() => {
    if (availableProducts.length > 0 && !selectedProductId) {
      setSelectedProductId(availableProducts[0].id);
      setCustomFlashPrice(Math.round(availableProducts[0].price * 0.8));
    }
  }, [availableProducts, selectedProductId]);

  // Handle Add Product to Campaign
  const handleAddProduct = () => {
    if (!selectedProductId) return;
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    const offerPrice = customFlashPrice > 0 ? customFlashPrice : Math.round(prod.price * 0.8);
    const origPrice = prod.regularPrice && prod.regularPrice > prod.price ? prod.regularPrice : prod.price;

    const newItem: FlashSaleItem = {
      productId: prod.id,
      flashPrice: offerPrice,
      originalPrice: origPrice
    };

    setFlashSale(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));

    setSelectedProductId('');
    setCustomFlashPrice(0);
  };

  // Handle Remove Product from Campaign
  const handleRemoveItem = (productId: string) => {
    setFlashSale(prev => ({
      ...prev,
      items: (prev.items || []).filter(i => i.productId !== productId)
    }));
  };

  // Handle Update Individual Item Price
  const handleUpdateItemPrice = (productId: string, field: 'flashPrice' | 'originalPrice', value: number) => {
    setFlashSale(prev => ({
      ...prev,
      items: (prev.items || []).map(item => {
        if (item.productId === productId) {
          return { ...item, [field]: value };
        }
        return item;
      })
    }));
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg('');
      const current = await dbService.getEcomSettings();

      const items = flashSale.items || [];
      const primaryItem = items[0];

      const updated: EcomSettings = {
        ...current,
        flashSale: {
          enabled: flashSale.enabled,
          campaignTitle: flashSale.campaignTitle?.trim() || '11.11 MEGA FLASH SALE',
          badgeTag: flashSale.badgeTag?.trim() || 'LIMITED FLASH DEAL',
          subtitle: flashSale.subtitle?.trim() || 'Exclusive limited-time discount on top products',
          startDate: flashSale.startDate || new Date().toISOString(),
          endDate: flashSale.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          buttonText: flashSale.buttonText?.trim() || 'SHOP NOW',
          items,
          // backward compatibility sync with 1st product
          productId: primaryItem ? primaryItem.productId : '',
          flashPrice: primaryItem ? primaryItem.flashPrice : 0,
          originalPrice: primaryItem ? (primaryItem.originalPrice || 0) : 0
        }
      };

      await dbService.saveEcomSettings(updated);
      setEcomSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
      onSettingsUpdated?.();
    } catch (err: any) {
      console.error('Failed to save flash sale settings:', err);
      setErrorMsg(err.message || 'Error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs font-medium text-slate-500">Loading flash sale settings...</p>
      </div>
    );
  }

  const campaignItems = flashSale.items || [];

  return (
    <div className="space-y-8 font-sans max-w-5xl pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0 ring-4 ring-orange-500/5">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Multi-Product Flash Sale Campaign
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 uppercase tracking-wider">
                {campaignItems.length} Products in Campaign
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Set special campaign prices for one or multiple products (e.g. 11.11, Summer Deal) with start & end dates.
            </p>
          </div>
        </div>

        {/* Enable / Disable Switch */}
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-700">
            {flashSale.enabled ? 'Campaign Active' : 'Campaign Paused'}
          </span>
          <button
            type="button"
            onClick={() => setFlashSale(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
              flashSale.enabled ? 'bg-orange-500' : 'bg-slate-300'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                flashSale.enabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-semibold animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Flash sale campaign saved! Live storefront and checkout prices are now updated.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-semibold animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Configuration Form */}
      <form onSubmit={handleSave} className="space-y-6">

        {/* Card 1: Campaign Details & Schedule */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-500" />
              <h2 className="text-sm font-bold text-slate-900">Campaign Details & Period</h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <Timer className="w-4 h-4 text-orange-500" />
              <span>{timeLeft.isExpired ? 'Status: Expired' : `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s remaining`}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Campaign Name / Title *
              </label>
              <input
                type="text"
                required
                value={flashSale.campaignTitle || ''}
                onChange={(e) => setFlashSale(prev => ({ ...prev, campaignTitle: e.target.value }))}
                placeholder="e.g. 11.11 MEGA FLASH SALE"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Badge / Tagline
              </label>
              <input
                type="text"
                value={flashSale.badgeTag || ''}
                onChange={(e) => setFlashSale(prev => ({ ...prev, badgeTag: e.target.value }))}
                placeholder="e.g. 11.11 SPECIAL • LIMITED TIME"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                Start Date & Time:
              </label>
              <input
                type="datetime-local"
                value={flashSale.startDate ? flashSale.startDate.slice(0, 16) : ''}
                onChange={(e) => setFlashSale(prev => ({ ...prev, startDate: new Date(e.target.value).toISOString() }))}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:border-orange-500 focus:outline-none cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-orange-500" />
                End Date & Time (Countdown Expiration) *:
              </label>
              <input
                type="datetime-local"
                required
                value={flashSale.endDate ? flashSale.endDate.slice(0, 16) : ''}
                onChange={(e) => setFlashSale(prev => ({ ...prev, endDate: new Date(e.target.value).toISOString() }))}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:border-orange-500 focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Add Products to Campaign */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-orange-500" />
              <h2 className="text-sm font-bold text-slate-900">Add Product to Flash Sale</h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {availableProducts.length} eligible products available
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-6 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Select Product:</label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedProductId(id);
                  const p = products.find(prod => prod.id === id);
                  if (p) {
                    setCustomFlashPrice(Math.round(p.price * 0.8));
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:border-orange-500 focus:outline-none cursor-pointer"
              >
                <option value="">-- Choose a product to add --</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} (Current: Tk.{p.price.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Flash Sale Price (Tk.):</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">Tk.</span>
                <input
                  type="number"
                  min="1"
                  value={customFlashPrice || ''}
                  onChange={(e) => setCustomFlashPrice(Number(e.target.value))}
                  placeholder="e.g. 550"
                  className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-orange-600 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <button
                type="button"
                disabled={!selectedProductId}
                onClick={handleAddProduct}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
                <span>Add To Campaign</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Campaign Products Table */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              <h2 className="text-sm font-bold text-slate-900">Campaign Product List ({campaignItems.length})</h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              Customers will buy at these special flash prices during campaign
            </span>
          </div>

          {campaignItems.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <Flame className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">No products added to this flash sale yet.</p>
              <p className="text-[11px] text-slate-400">Select a product above and click "Add To Campaign".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-3">Regular Price</th>
                    <th className="py-3 px-3">Flash Sale Price</th>
                    <th className="py-3 px-3 text-center">Discount</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaignItems.map((item, idx) => {
                    const prod = products.find(p => p.id === item.productId);
                    const title = prod?.title || 'Unknown Product';
                    const img = prod?.coverImage || prod?.image || 'https://images.unsplash.com/photo-1608248597359-0098f98a329d?w=100';
                    const origPrice = item.originalPrice || prod?.regularPrice || prod?.price || 0;
                    const flashPrice = item.flashPrice || 0;
                    const discount = origPrice > flashPrice && origPrice > 0 
                      ? Math.round(((origPrice - flashPrice) / origPrice) * 100) 
                      : 0;

                    return (
                      <tr key={item.productId} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <img src={img} alt={title} className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0" />
                            <div>
                              <p className="font-bold text-slate-800 line-clamp-1">{title}</p>
                              <p className="text-[10px] text-slate-400 font-mono">ID: {item.productId}</p>
                            </div>
                          </div>
                        </td>

                        {/* Strike-through regular price */}
                        <td className="py-3 px-3">
                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-2 text-[10px] text-slate-400 font-bold">Tk.</span>
                            <input
                              type="number"
                              min="0"
                              value={item.originalPrice || origPrice}
                              onChange={(e) => handleUpdateItemPrice(item.productId, 'originalPrice', Number(e.target.value))}
                              className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 focus:bg-white focus:border-orange-500 focus:outline-none"
                            />
                          </div>
                        </td>

                        {/* Campaign flash sale price */}
                        <td className="py-3 px-3">
                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-2 text-[10px] text-slate-400 font-bold">Tk.</span>
                            <input
                              type="number"
                              min="1"
                              value={item.flashPrice}
                              onChange={(e) => handleUpdateItemPrice(item.productId, 'flashPrice', Number(e.target.value))}
                              className="w-full pl-7 pr-2 py-1.5 bg-white border border-orange-300 rounded-lg text-xs font-bold text-orange-600 focus:border-orange-500 focus:outline-none shadow-2xs"
                            />
                          </div>
                        </td>

                        {/* Calculated Discount Badge */}
                        <td className="py-3 px-3 text-center">
                          {discount > 0 ? (
                            <span className="inline-block bg-orange-100 text-orange-700 font-bold text-[11px] px-2 py-0.5 rounded-full">
                              -{discount}% OFF
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">—</span>
                          )}
                        </td>

                        {/* Remove Action */}
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.productId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Remove from Flash Sale"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-bold text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving Campaign...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Save & Publish Flash Sale ({campaignItems.length} Products)</span>
            </>
          )}
        </button>

      </form>

    </div>
  );
}