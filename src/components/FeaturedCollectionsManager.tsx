import React, { useState, useEffect } from 'react';
import { Product, EcomSettings, FeaturedCollection } from '../types';
import { dbService } from '../lib/dbService';
import { 
  Sparkles, Plus, Trash2, Edit2, Check, X, Search, 
  Layers, ArrowUp, ArrowDown, ShoppingBag, Eye, EyeOff, Save, CheckSquare, Square,
  Upload, Image as ImageIcon, Loader2
} from 'lucide-react';
import { uploadFileToStorage } from '../lib/storageService';
import { FeedbackDialog } from './ui/FeedbackDialog';

interface FeaturedCollectionsManagerProps {
  products: Product[];
  onSettingsUpdated?: () => void;
}

export default function FeaturedCollectionsManager({
  products = [],
  onSettingsUpdated
}: FeaturedCollectionsManagerProps) {
  const [collections, setCollections] = useState<FeaturedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeEditingCol, setActiveEditingCol] = useState<FeaturedCollection | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productPickerCol, setProductPickerCol] = useState<FeaturedCollection | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/collections');
      if (res.ok) {
        const json = await res.json();
        if (json.collections && Array.isArray(json.collections)) {
          setCollections(json.collections);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      // fallback to dbService settings
    }

    try {
      const settings = await dbService.getEcomSettings();
      if (settings?.featuredCollections && settings.featuredCollections.length > 0) {
        setCollections(settings.featuredCollections);
      } else {
        // Initial defaults for fashion store
        const defaults: FeaturedCollection[] = [
          {
            id: 'col-winter',
            title: 'Winter Collection',
            subtitle: 'Cozy velvet three-pieces, pashmina shawls, and festive winter party wears',
            badge: 'WINTER SPECIAL',
            productIds: products.slice(0, 4).map(p => p.id),
            enabled: true,
            displayOrder: 1
          },
          {
            id: 'col-summer',
            title: 'Summer Collection',
            subtitle: 'Breathable cotton lawn, soft organza, and lightweight printed georgettes',
            badge: 'SUMMER EDITION',
            productIds: products.slice(4, 8).map(p => p.id),
            enabled: true,
            displayOrder: 2
          }
        ];
        setCollections(defaults);
      }
    } catch (err) {
      console.warn('Failed loading collections:', err);
    } finally {
      setLoading(false);
    }
  };

  const persistCollections = async (updated: FeaturedCollection[]) => {
    setCollections(updated);
    setIsSaving(true);
    try {
      await dbService.updateEcomSettings({ featuredCollections: updated });
      window.dispatchEvent(new CustomEvent('ecom-settings-updated'));
      if (onSettingsUpdated) onSettingsUpdated();
      setFeedback({
        isOpen: true,
        type: 'success',
        title: 'Collections Saved',
        message: 'Featured collections successfully saved and updated on the storefront.'
      });
    } catch (err: any) {
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Save Failed',
        message: err?.message || 'Failed saving collections.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreateModal = () => {
    setActiveEditingCol({
      id: `col-${Date.now()}`,
      title: '',
      subtitle: '',
      badge: 'SEASON SPECIAL',
      productIds: [],
      enabled: true,
      displayOrder: collections.length + 1
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (col: FeaturedCollection) => {
    setActiveEditingCol({ ...col });
    setIsModalOpen(true);
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeEditingCol) return;
    setIsUploadingCover(true);
    try {
      const url = await uploadFileToStorage(file, 'collections');
      setActiveEditingCol(prev => prev ? { ...prev, coverImage: url } : null);
      setFeedback({
        isOpen: true,
        type: 'success',
        title: 'Image Uploaded',
        message: 'Collection cover image uploaded successfully.'
      });
    } catch (err: any) {
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Upload Failed',
        message: err?.message || 'Failed to upload collection cover image.'
      });
    } finally {
      setIsUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleSaveModal = () => {
    if (!activeEditingCol || !activeEditingCol.title.trim()) {
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Title Required',
        message: 'Please provide a title for the collection (e.g. Winter Collection).'
      });
      return;
    }

    const exists = collections.some(c => c.id === activeEditingCol.id);
    let updated: FeaturedCollection[];
    if (exists) {
      updated = collections.map(c => c.id === activeEditingCol.id ? activeEditingCol : c);
    } else {
      updated = [...collections, activeEditingCol];
    }

    setIsModalOpen(false);
    setActiveEditingCol(null);
    persistCollections(updated);
  };

  const handleDeleteCollection = (id: string) => {
    const updated = collections.filter(c => c.id !== id);
    persistCollections(updated);
  };

  const handleToggleEnable = (id: string) => {
    const updated = collections.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c);
    persistCollections(updated);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= collections.length) return;
    const list = [...collections];
    const item = list[index];
    list.splice(index, 1);
    list.splice(targetIdx, 0, item);
    persistCollections(list);
  };

  const handleToggleProductInCollection = (productId: string) => {
    if (!productPickerCol) return;
    const currentIds = productPickerCol.productIds || [];
    const exists = currentIds.includes(productId);
    const updatedIds = exists 
      ? currentIds.filter(id => id !== productId)
      : [...currentIds, productId];

    const updatedCol = { ...productPickerCol, productIds: updatedIds };
    setProductPickerCol(updatedCol);

    const updatedList = collections.map(c => c.id === updatedCol.id ? updatedCol : c);
    setCollections(updatedList);
  };

  const handleSaveProductPicker = () => {
    if (productPickerCol) {
      persistCollections(collections);
    }
    setProductPickerCol(null);
  };

  const filteredPickerProducts = products.filter(p => {
    const term = productSearch.toLowerCase();
    return !term || 
      (p.title && p.title.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term)) ||
      (p.sku && p.sku.toLowerCase().includes(term));
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-6 w-6 text-teal-600" />
            Featured Collections
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Organize products into curated seasonal collections (e.g. Winter Collection, Summer Collection, Eid Edition) shown on your homepage.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all hover:shadow-md cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Create New Collection
        </button>
      </div>

      {/* Collections List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">
            Active Store Collections ({collections.length})
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">
            (Use Up/Down buttons to adjust order on homepage)
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Loading collections...
          </div>
        ) : collections.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-medium">No collections created yet</p>
            <p className="text-slate-400 text-[11px] mt-0.5">Click &quot;Create New Collection&quot; to create your Winter or Summer collection.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {collections.map((col, idx) => {
              const assignedProds = products.filter(p => col.productIds?.includes(p.id));

              return (
                <div 
                  key={col.id}
                  className={`border rounded-2xl p-4 sm:p-5 transition-all ${
                    col.enabled 
                      ? 'border-slate-200/90 bg-white hover:border-slate-300 shadow-xs' 
                      : 'border-slate-200 bg-slate-50/70 opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    {/* Collection Info */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {col.coverImage ? (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100 shadow-xs">
                          <img 
                            src={col.coverImage} 
                            alt={col.title} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-dashed border-slate-200 shrink-0 bg-slate-50 flex flex-col items-center justify-center text-slate-300">
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                          <span className="text-[9px] text-slate-400 mt-1 font-medium">No Image</span>
                        </div>
                      )}

                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-400">#{idx + 1}</span>
                          {col.badge && (
                            <span className="px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-bold rounded-md uppercase tracking-wider">
                              {col.badge}
                            </span>
                          )}
                          <h4 className="font-bold text-slate-900 text-base">{col.title}</h4>
                          {!col.enabled && (
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                              Hidden from Home
                            </span>
                          )}
                        </div>
                        {col.subtitle && (
                          <p className="text-xs text-slate-500 line-clamp-1">{col.subtitle}</p>
                        )}
                        
                        <div className="flex items-center gap-3 pt-1 text-xs">
                          <span className="font-semibold text-slate-700">
                            {col.productIds?.length || 0} Products Assigned
                          </span>
                          <button
                            type="button"
                            onClick={() => setProductPickerCol(col)}
                            className="text-teal-700 hover:text-teal-800 font-bold underline underline-offset-2 cursor-pointer flex items-center gap-1"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Assign / Manage Products</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Actions & Reorder */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleEnable(col.id)}
                        className={`p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          col.enabled ? 'bg-teal-50 text-teal-700 hover:bg-teal-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                        title={col.enabled ? 'Enabled (Click to hide)' : 'Hidden (Click to show)'}
                      >
                        {col.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(col)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                        title="Edit Details"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, 'up')}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={idx === collections.length - 1}
                        onClick={() => handleMove(idx, 'down')}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCollection(col.id)}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors cursor-pointer"
                        title="Delete Collection"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>

                  {/* Thumbnail Row of Assigned Products */}
                  {assignedProds.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1">
                      {assignedProds.slice(0, 8).map(prod => (
                        <div 
                          key={prod.id} 
                          className="w-12 h-16 rounded-md bg-slate-100 overflow-hidden border border-slate-200 shrink-0 relative group"
                          title={prod.title}
                        >
                          <img 
                            src={prod.coverImage || prod.image} 
                            alt={prod.title} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                      ))}
                      {assignedProds.length > 8 && (
                        <span className="text-[11px] font-bold text-slate-400 pl-1 shrink-0">
                          +{assignedProds.length - 8} more
                        </span>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Collection Details Modal */}
      {isModalOpen && activeEditingCol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                {activeEditingCol.id && collections.some(c => c.id === activeEditingCol.id) ? 'Edit Collection' : 'Create Collection'}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Collection Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Winter Collection / Summer Collection"
                  value={activeEditingCol.title}
                  onChange={(e) => setActiveEditingCol({ ...activeEditingCol, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-teal-500 outline-none text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Badge Tag</label>
                <input
                  type="text"
                  placeholder="e.g. WINTER SPECIAL / NEW ARRIVALS"
                  value={activeEditingCol.badge || ''}
                  onChange={(e) => setActiveEditingCol({ ...activeEditingCol, badge: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-teal-500 outline-none text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Subtitle / Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Cozy velvet three-pieces, pashmina shawls, and festive winter party wears"
                  value={activeEditingCol.subtitle || ''}
                  onChange={(e) => setActiveEditingCol({ ...activeEditingCol, subtitle: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 resize-none"
                />
              </div>

              {/* Optional Collection Cover / Banner Image */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">
                    Collection Banner / Cover Image <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  {activeEditingCol.coverImage && (
                    <button
                      type="button"
                      onClick={() => setActiveEditingCol({ ...activeEditingCol, coverImage: '' })}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                    >
                      Remove Image
                    </button>
                  )}
                </div>

                {activeEditingCol.coverImage ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[21/9] max-h-36 mb-2 group">
                    <img
                      src={activeEditingCol.coverImage}
                      alt={activeEditingCol.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <label className="px-3 py-1.5 bg-white text-slate-800 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-100 shadow-sm flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Change</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverImageUpload}
                          disabled={isUploadingCover}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveEditingCol({ ...activeEditingCol, coverImage: '' })}
                        className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-rose-700 shadow-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl p-3 sm:p-4 text-center bg-slate-50 transition-colors">
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverImageUpload}
                        disabled={isUploadingCover}
                        className="hidden"
                      />
                      {isUploadingCover ? (
                        <div className="flex flex-col items-center justify-center py-2 text-teal-600">
                          <Loader2 className="w-6 h-6 animate-spin mb-1" />
                          <span className="text-xs font-semibold">Uploading collection image...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-2 text-slate-500">
                          <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mb-1">
                            <Upload className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-slate-700">Click to upload cover image</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP up to 10MB</span>
                        </div>
                      )}
                    </label>
                  </div>
                )}

                {/* Direct URL input fallback */}
                <div className="mt-2">
                  <input
                    type="url"
                    placeholder="Or paste direct image URL (optional)"
                    value={activeEditingCol.coverImage || ''}
                    onChange={(e) => setActiveEditingCol({ ...activeEditingCol, coverImage: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-slate-700">Display on Storefront</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeEditingCol.enabled}
                    onChange={(e) => setActiveEditingCol({ ...activeEditingCol, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-sm cursor-pointer"
              >
                Save Collection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Picker Modal (Select products to add to collection) */}
      {productPickerCol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Assign Products to &quot;{productPickerCol.title}&quot;
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select which products belong to this collection ({productPickerCol.productIds?.length || 0} selected)
                </p>
              </div>
              <button 
                type="button" 
                onClick={handleSaveProductPicker}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search filter inside modal */}
            <div className="py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products by title, category, or SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none text-slate-900"
                />
              </div>
            </div>

            {/* Products List with Checkboxes */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1">
              {filteredPickerProducts.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  No matching products found in store inventory.
                </div>
              ) : (
                filteredPickerProducts.map(prod => {
                  const isChecked = productPickerCol.productIds?.includes(prod.id);

                  return (
                    <div 
                      key={prod.id}
                      onClick={() => handleToggleProductInCollection(prod.id)}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-xl transition-colors cursor-pointer select-none ${
                        isChecked ? 'bg-teal-50/70 hover:bg-teal-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-13 rounded-md bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                          <img 
                            src={prod.coverImage || prod.image} 
                            alt={prod.title} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs text-slate-900 truncate">{prod.title}</h5>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-semibold text-teal-700">৳{prod.price}</span>
                            <span>•</span>
                            <span>{prod.category}</span>
                            {prod.sku && <span className="font-mono text-slate-400">({prod.sku})</span>}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-teal-600">
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 text-teal-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Picker Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                {productPickerCol.productIds?.length || 0} Products Selected
              </span>
              <button
                type="button"
                onClick={handleSaveProductPicker}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-sm cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Feedback Dialog */}
      <FeedbackDialog
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
