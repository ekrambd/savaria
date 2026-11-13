import React, { useState, useEffect, useRef, useMemo } from 'react';
import { EcomSettings, CategoryItem, SubCategoryItem, Product } from '../types';
import { dbService } from '../lib/dbService';
import { compressImage } from '../lib/imageUtils';
import { CircularProgress } from './LoadingSkeleton';
import { 
  Tag, Plus, Trash2, Save, RefreshCw, Check, Edit3, X, 
  ArrowUp, ArrowDown, FolderPlus, Upload, Search, Layers, 
  AlertCircle, ChevronRight, Filter, Eye, Image as ImageIcon
} from 'lucide-react';
import { FeedbackDialog } from './ui/FeedbackDialog';

type ActiveModule = 'categories' | 'subcategories';

interface FlattenedSubCategory {
  id: string;
  name: string;
  image?: string;
  order?: number;
  categoryId: string;
  categoryName: string;
}

export default function CategoryManager() {
  const [settings, setSettings] = useState<EcomSettings>({
    deliveryChargeInsideDhaka: 60,
    deliveryChargeOutsideDhaka: 110,
    categories: [],
    categoryItems: []
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Active Module State (Categories vs Subcategories)
  const [activeModule, setActiveModule] = useState<ActiveModule>('categories');

  // Search & Filter States
  const [categorySearch, setCategorySearch] = useState('');
  const [subcategorySearch, setSubcategorySearch] = useState('');
  const [selectedParentCategoryFilter, setSelectedParentCategoryFilter] = useState<string>('all');

  // Modals & Forms State
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddSubcategoryOpen, setIsAddSubcategoryOpen] = useState(false);

  // Category Inputs (Add / Edit)
  const [newCatName, setNewCatName] = useState('');
  const [newCatBanglaName, setNewCatBanglaName] = useState('');
  const [newCatSortOrder, setNewCatSortOrder] = useState<number>(0);
  const [newCatProductOrder, setNewCatProductOrder] = useState<string>('default');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [newCatImage, setNewCatImage] = useState('');
  const [isUploadingNewCat, setIsUploadingNewCat] = useState(false);

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatBanglaName, setNewEditingCatBanglaName] = useState('');
  const [editingCatSortOrder, setEditingCatSortOrder] = useState<number>(0);
  const [editingCatProductOrder, setEditingCatProductOrder] = useState<string>('default');
  const [editingCatDescription, setEditingCatDescription] = useState('');
  const [editingCatImage, setEditingCatImage] = useState('');
  const [isUploadingEditCat, setIsUploadingEditCat] = useState(false);

  // Subcategory Inputs (Add / Edit)
  const [newSubParentCatId, setNewSubParentCatId] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubImage, setNewSubImage] = useState('');
  const [isUploadingNewSub, setIsUploadingNewSub] = useState(false);

  const [editingSub, setEditingSub] = useState<{
    id: string;
    originalCatId: string;
    targetCatId: string;
    name: string;
    image: string;
  } | null>(null);
  const [isUploadingEditSub, setIsUploadingEditSub] = useState(false);

  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'category' | 'subcategory';
    catId: string;
    subId?: string;
    name: string;
    warning?: string;
  }>({
    isOpen: false,
    type: 'category',
    catId: '',
    name: ''
  });

  // Feedback Notification
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

  // File Inputs
  const newCatFileRef = useRef<HTMLInputElement>(null);
  const editCatFileRef = useRef<HTMLInputElement>(null);
  const newSubFileRef = useRef<HTMLInputElement>(null);
  const editSubFileRef = useRef<HTMLInputElement>(null);

  // Initial Data Fetch
  useEffect(() => {
    async function loadData() {
      try {
        const [settingsData, productsData] = await Promise.all([
          dbService.getEcomSettings(),
          dbService.getProducts()
        ]);

        if (Array.isArray(productsData)) {
          setProducts(productsData);
        }

        let catItems: CategoryItem[] = [];

        // Direct fetch from backend Express API if available
        try {
          const res = await fetch('/api/categories');
          if (res.ok) {
            const serverCats = await res.json();
            if (Array.isArray(serverCats) && serverCats.length > 0) {
              catItems = serverCats;
            }
          }
        } catch {}

        if (catItems.length === 0) {
          catItems = settingsData.categoryItems || [];
        }

        // If categories list exists but categoryItems is empty, build categoryItems
        if ((!catItems || catItems.length === 0) && settingsData.categories && settingsData.categories.length > 0) {
          catItems = settingsData.categories.map((c, idx) => ({
            id: `cat-${Date.now()}-${idx}`,
            name: c,
            order: idx,
            subcategories: []
          }));
        }

        // Make sure all product categories are represented in categoryItems
        if (Array.isArray(productsData) && productsData.length > 0) {
          const existingNames = new Set(catItems.map(c => c.name.toLowerCase().trim()));
          const missingProductCats = Array.from(
            new Set(productsData.map(p => p.category?.trim()).filter(Boolean) as string[])
          ).filter(catName => !existingNames.has(catName.toLowerCase()));

          if (missingProductCats.length > 0) {
            const newCreatedItems: CategoryItem[] = missingProductCats.map((catName, idx) => {
              const matchedProd = productsData.find(p => p.category?.trim() === catName);
              return {
                id: `cat-${catName.toLowerCase().replace(/\s+/g, '-')}`,
                name: catName,
                order: catItems.length + idx,
                image: matchedProd?.coverImage || matchedProd?.image || matchedProd?.images?.[0] || '',
                subcategories: []
              };
            });
            catItems = [...catItems, ...newCreatedItems];
          }
        }

        setSettings({
          ...settingsData,
          categories: catItems.map(c => c.name),
          categoryItems: catItems
        });

        if (catItems.length > 0 && !newSubParentCatId) {
          setNewSubParentCatId(catItems[0].id);
        }
      } catch (err) {
        console.error('Error loading category settings:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const categoryItems = settings.categoryItems || [];

  const sortedCategoryItems = useMemo(() => {
    return [...categoryItems].sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 0;
      const orderB = typeof b.order === 'number' ? b.order : 0;
      return orderA - orderB;
    });
  }, [categoryItems]);

  // Flattened Subcategories with Parent Category Details
  const allSubcategories = useMemo<FlattenedSubCategory[]>(() => {
    const list: FlattenedSubCategory[] = [];
    sortedCategoryItems.forEach(cat => {
      const sortedSubs = [...(cat.subcategories || [])].sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 0;
        const orderB = typeof b.order === 'number' ? b.order : 0;
        return orderA - orderB;
      });
      sortedSubs.forEach(sub => {
        list.push({
          id: sub.id,
          name: sub.name,
          image: sub.image,
          order: sub.order,
          categoryId: cat.id,
          categoryName: cat.name
        });
      });
    });
    return list;
  }, [sortedCategoryItems]);

  // Product Counts per Category & Subcategory
  const productCountMap = useMemo(() => {
    const catMap = new Map<string, number>();
    const subMap = new Map<string, number>();

    products.forEach(p => {
      const c = p.category?.trim();
      const s = p.subcategory?.trim();
      if (c) {
        catMap.set(c.toLowerCase(), (catMap.get(c.toLowerCase()) || 0) + 1);
      }
      if (s) {
        subMap.set(s.toLowerCase(), (subMap.get(s.toLowerCase()) || 0) + 1);
      }
    });

    return {
      getCategoryCount: (catName: string) => catMap.get(catName.toLowerCase()) || 0,
      getSubcategoryCount: (subName: string) => subMap.get(subName.toLowerCase()) || 0
    };
  }, [products]);

  // Filtered Categories (Priority/Sort Order based)
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return sortedCategoryItems;
    const term = categorySearch.toLowerCase().trim();
    return sortedCategoryItems.filter(c => 
      c.name.toLowerCase().includes(term) ||
      (c.banglaName && c.banglaName.toLowerCase().includes(term))
    );
  }, [sortedCategoryItems, categorySearch]);

  // Filtered Subcategories
  const filteredSubcategories = useMemo(() => {
    let list = allSubcategories;

    if (selectedParentCategoryFilter !== 'all') {
      list = list.filter(s => s.categoryId === selectedParentCategoryFilter);
    }

    if (subcategorySearch.trim()) {
      const term = subcategorySearch.toLowerCase().trim();
      list = list.filter(s => 
        s.name.toLowerCase().includes(term) || 
        s.categoryName.toLowerCase().includes(term)
      );
    }

    return list;
  }, [allSubcategories, selectedParentCategoryFilter, subcategorySearch]);

  // Compress & Handle Image Upload
  const handleImageCompress = async (
    file: File,
    setImage: (url: string) => void,
    setLoading: (val: boolean) => void
  ) => {
    setLoading(true);
    try {
      const compressed = await compressImage(file, 600, 0.85, 300000);
      setImage(compressed);
    } catch (err) {
      console.error('Failed to compress image:', err);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setLoading(false);
    }
  };

  // Persist Category Items to LocalStorage & Server
  const persistCategories = async (updatedItems: CategoryItem[]) => {
    try {
      const currentFullSettings = await dbService.getEcomSettings();
      const updatedCategoriesList = updatedItems.map(c => c.name);

      await dbService.saveEcomSettings({
        ...currentFullSettings,
        categories: updatedCategoriesList,
        categoryItems: updatedItems
      });

      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categories: updatedCategoriesList,
            categoryItems: updatedItems
          })
        });
      } catch {}
    } catch (err) {
      console.error('Error saving categories:', err);
    }
  };

  // Global Save Button
  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await persistCategories(settings.categoryItems || []);
      setSaveSuccess(true);
      setFeedback({
        isOpen: true,
        type: 'success',
        title: 'Changes Saved Successfully',
        message: 'All categories and subcategories have been synchronized and persisted.'
      });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving categories:', err);
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Error Saving Changes',
        message: 'Could not save category updates. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // CATEGORY CRUD OPERATIONS
  // ==========================================

  // 1. Create Category
  const handleCreateCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;

    const exists = categoryItems.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setFeedback({
        isOpen: true,
        type: 'info',
        title: 'Category Already Exists',
        message: `A category named "${name}" already exists.`
      });
      return;
    }

    const assignedOrder = Number.isFinite(Number(newCatSortOrder)) ? Number(newCatSortOrder) : categoryItems.length;

    const newCat: CategoryItem = {
      id: `cat-${Date.now()}`,
      name,
      banglaName: newCatBanglaName.trim() || undefined,
      order: assignedOrder,
      productOrder: (newCatProductOrder as any) || 'default',
      description: newCatDescription.trim() || undefined,
      image: newCatImage.trim() || undefined,
      subcategories: []
    };

    const updatedItems = [...categoryItems, newCat].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setSettings(prev => ({
      ...prev,
      categories: updatedItems.map(c => c.name),
      categoryItems: updatedItems
    }));

    persistCategories(updatedItems);
    setNewCatName('');
    setNewCatBanglaName('');
    setNewCatSortOrder(0);
    setNewCatProductOrder('default');
    setNewCatDescription('');
    setNewCatImage('');
    setIsAddCategoryOpen(false);
    if (newCatFileRef.current) newCatFileRef.current.value = '';

    setFeedback({
      isOpen: true,
      type: 'success',
      title: 'Category Created',
      message: `Category "${name}" with priority sort order ${assignedOrder} has been created.`
    });
  };

  // 2. Start Edit Category
  const handleStartEditCategory = (cat: CategoryItem) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setNewEditingCatBanglaName(cat.banglaName || '');
    setEditingCatSortOrder(typeof cat.order === 'number' ? cat.order : 0);
    setEditingCatProductOrder(cat.productOrder || 'default');
    setEditingCatDescription(cat.description || '');
    setEditingCatImage(cat.image || '');
  };

  // 3. Save Edit Category
  const handleSaveEditCategory = (catId: string) => {
    const name = editingCatName.trim();
    if (!name) return;

    const duplicate = categoryItems.some(
      c => c.id !== catId && c.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setFeedback({
        isOpen: true,
        type: 'info',
        title: 'Category Name Conflict',
        message: `Another category named "${name}" already exists.`
      });
      return;
    }

    const assignedOrder = Number.isFinite(Number(editingCatSortOrder)) ? Number(editingCatSortOrder) : 0;

    const updatedItems = categoryItems.map(c => 
      c.id === catId ? {
        ...c,
        name,
        banglaName: editingCatBanglaName.trim() || undefined,
        order: assignedOrder,
        productOrder: (editingCatProductOrder as any) || 'default',
        description: editingCatDescription.trim() || undefined,
        image: editingCatImage.trim() || undefined
      } : c
    ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    setSettings(prev => ({
      ...prev,
      categories: updatedItems.map(c => c.name),
      categoryItems: updatedItems
    }));

    persistCategories(updatedItems);
    setEditingCatId(null);
    setEditingCatImage('');

    setFeedback({
      isOpen: true,
      type: 'success',
      title: 'Category Updated',
      message: `Category "${name}" updated successfully.`
    });
  };

  // Direct change of sort order from row input
  const handleQuickUpdateSortOrder = (catId: string, newOrderVal: number) => {
    const updatedItems = categoryItems.map(c => {
      if (c.id === catId) {
        return { ...c, order: newOrderVal };
      }
      return c;
    }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    setSettings(prev => ({
      ...prev,
      categories: updatedItems.map(c => c.name),
      categoryItems: updatedItems
    }));
    persistCategories(updatedItems);
  };

  // 4. Move Category Up / Down
  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    const list = [...categoryItems];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const reordered = list.map((item, idx) => ({ ...item, order: idx }));
    setSettings(prev => ({
      ...prev,
      categories: reordered.map(c => c.name),
      categoryItems: reordered
    }));
    persistCategories(reordered);
  };

  // 5. Delete Category Request
  const handleRequestDeleteCategory = (cat: CategoryItem) => {
    const subCount = cat.subcategories?.length || 0;
    const prodCount = productCountMap.getCategoryCount(cat.name);

    let warning = '';
    if (subCount > 0 && prodCount > 0) {
      warning = `Warning: This category contains ${subCount} subcategories and ${prodCount} products!`;
    } else if (subCount > 0) {
      warning = `Warning: This category contains ${subCount} nested subcategories that will also be removed.`;
    } else if (prodCount > 0) {
      warning = `Warning: ${prodCount} products currently belong to this category.`;
    }

    setDeleteModal({
      isOpen: true,
      type: 'category',
      catId: cat.id,
      name: cat.name,
      warning
    });
  };

  // ==========================================
  // SUBCATEGORY CRUD OPERATIONS
  // ==========================================

  // 1. Create Subcategory
  const handleCreateSubcategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newSubName.trim();
    const targetCatId = newSubParentCatId;

    if (!name || !targetCatId) return;

    const parentCat = categoryItems.find(c => c.id === targetCatId);
    if (!parentCat) return;

    const subExists = (parentCat.subcategories || []).some(
      s => s.name.toLowerCase() === name.toLowerCase()
    );
    if (subExists) {
      setFeedback({
        isOpen: true,
        type: 'info',
        title: 'Subcategory Exists',
        message: `"${name}" is already a subcategory under "${parentCat.name}".`
      });
      return;
    }

    const newSub: SubCategoryItem = {
      id: `sub-${Date.now()}`,
      name,
      image: newSubImage.trim() || undefined,
      order: parentCat.subcategories?.length || 0
    };

    const updatedItems = categoryItems.map(c => {
      if (c.id !== targetCatId) return c;
      return {
        ...c,
        subcategories: [...(c.subcategories || []), newSub]
      };
    });

    setSettings(prev => ({
      ...prev,
      categoryItems: updatedItems
    }));

    persistCategories(updatedItems);
    setNewSubName('');
    setNewSubImage('');
    setIsAddSubcategoryOpen(false);
    if (newSubFileRef.current) newSubFileRef.current.value = '';

    setFeedback({
      isOpen: true,
      type: 'success',
      title: 'Subcategory Created',
      message: `Subcategory "${name}" added under "${parentCat.name}".`
    });
  };

  // 2. Start Edit Subcategory
  const handleStartEditSubcategory = (sub: FlattenedSubCategory) => {
    setEditingSub({
      id: sub.id,
      originalCatId: sub.categoryId,
      targetCatId: sub.categoryId,
      name: sub.name,
      image: sub.image || ''
    });
  };

  // 3. Save Edit Subcategory (Supports Re-parenting)
  const handleSaveEditSubcategory = () => {
    if (!editingSub || !editingSub.name.trim()) return;

    const { id: subId, originalCatId, targetCatId, name, image } = editingSub;
    const trimmedName = name.trim();

    // Check duplicate in target category
    const targetCat = categoryItems.find(c => c.id === targetCatId);
    if (!targetCat) return;

    const duplicate = (targetCat.subcategories || []).some(
      s => s.id !== subId && s.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setFeedback({
        isOpen: true,
        type: 'info',
        title: 'Subcategory Conflict',
        message: `"${trimmedName}" already exists in "${targetCat.name}".`
      });
      return;
    }

    let updatedItems: CategoryItem[];

    if (originalCatId === targetCatId) {
      // Same parent category, update inline
      updatedItems = categoryItems.map(c => {
        if (c.id !== targetCatId) return c;
        return {
          ...c,
          subcategories: (c.subcategories || []).map(s => 
            s.id === subId ? {
              ...s,
              name: trimmedName,
              image: image.trim() || undefined
            } : s
          )
        };
      });
    } else {
      // Re-parenting subcategory to a different category
      const subItem: SubCategoryItem = {
        id: subId,
        name: trimmedName,
        image: image.trim() || undefined,
        order: targetCat.subcategories?.length || 0
      };

      updatedItems = categoryItems.map(c => {
        if (c.id === originalCatId) {
          // Remove from old parent
          return {
            ...c,
            subcategories: (c.subcategories || []).filter(s => s.id !== subId)
          };
        }
        if (c.id === targetCatId) {
          // Append to new parent
          return {
            ...c,
            subcategories: [...(c.subcategories || []), subItem]
          };
        }
        return c;
      });
    }

    setSettings(prev => ({
      ...prev,
      categoryItems: updatedItems
    }));

    persistCategories(updatedItems);
    setEditingSub(null);

    setFeedback({
      isOpen: true,
      type: 'success',
      title: 'Subcategory Saved',
      message: `Subcategory "${trimmedName}" updated successfully.`
    });
  };

  // 4. Move Subcategory Up / Down within parent
  const handleMoveSubcategory = (catId: string, subId: string, direction: 'up' | 'down') => {
    const parentCat = categoryItems.find(c => c.id === catId);
    if (!parentCat || !parentCat.subcategories) return;

    const subs = [...parentCat.subcategories];
    const index = subs.findIndex(s => s.id === subId);
    if (index === -1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= subs.length) return;

    const temp = subs[index];
    subs[index] = subs[targetIdx];
    subs[targetIdx] = temp;

    const reorderedSubs = subs.map((s, idx) => ({ ...s, order: idx }));

    const updatedItems = categoryItems.map(c => 
      c.id === catId ? { ...c, subcategories: reorderedSubs } : c
    );

    setSettings(prev => ({
      ...prev,
      categoryItems: updatedItems
    }));

    persistCategories(updatedItems);
  };

  // 5. Delete Subcategory Request
  const handleRequestDeleteSubcategory = (sub: FlattenedSubCategory) => {
    const prodCount = productCountMap.getSubcategoryCount(sub.name);
    let warning = '';
    if (prodCount > 0) {
      warning = `Warning: ${prodCount} products are tagged with this subcategory.`;
    }

    setDeleteModal({
      isOpen: true,
      type: 'subcategory',
      catId: sub.categoryId,
      subId: sub.id,
      name: sub.name,
      warning
    });
  };

  // ==========================================
  // CONFIRM DELETE DISPATCHER
  // ==========================================
  const handleConfirmDelete = () => {
    if (deleteModal.type === 'category') {
      const updatedItems = categoryItems.filter(c => c.id !== deleteModal.catId);
      setSettings(prev => ({
        ...prev,
        categories: updatedItems.map(c => c.name),
        categoryItems: updatedItems
      }));
      persistCategories(updatedItems);
      setFeedback({
        isOpen: true,
        type: 'success',
        title: 'Category Removed',
        message: `Category "${deleteModal.name}" and its subcategories were deleted.`
      });
    } else if (deleteModal.type === 'subcategory' && deleteModal.subId) {
      const updatedItems = categoryItems.map(c => {
        if (c.id !== deleteModal.catId) return c;
        return {
          ...c,
          subcategories: (c.subcategories || []).filter(s => s.id !== deleteModal.subId)
        };
      });
      setSettings(prev => ({
        ...prev,
        categoryItems: updatedItems
      }));
      persistCategories(updatedItems);
      setFeedback({
        isOpen: true,
        type: 'success',
        title: 'Subcategory Removed',
        message: `Subcategory "${deleteModal.name}" was deleted.`
      });
    }
    setDeleteModal({ isOpen: false, type: 'category', catId: '', name: '' });
  };

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center items-center">
        <CircularProgress label="Loading category modules..." size="md" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 font-sans">
      
      {/* Header Bar with Global Save Button */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Store Hierarchy & Catalog</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              CRUD Modules
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage primary product categories and their linked subcategories independently with dedicated module cards.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Saving All...</span>
              </>
            ) : saveSuccess ? (
              <>
                <Check className="h-4 w-4 text-emerald-200" />
                <span>Saved All Successfully!</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save All Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ============================================================
          TWO MODULE CARDS: CATEGORIES & SUBCATEGORIES
          ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Module Card 1: Categories */}
        <div
          onClick={() => setActiveModule('categories')}
          className={`relative p-5 sm:p-6 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs select-none ${
            activeModule === 'categories'
              ? 'bg-emerald-50/40 border-[#2563eb] ring-2 ring-[#2563eb]/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className={`p-3 rounded-2xl ${
              activeModule === 'categories' ? 'bg-[#2563eb] text-white shadow-sm' : 'bg-slate-100 text-slate-700'
            }`}>
              <Layers className="h-6 w-6" />
            </div>

            <span className={`text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
              activeModule === 'categories'
                ? 'bg-[#2563eb] text-white'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {activeModule === 'categories' ? '● Active Module' : 'Click to Manage'}
            </span>
          </div>

          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Categories Module
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Main store departments (e.g. Women's, Kids Fashion, Hijab, Bags). Primary navigation & storefront highlights.
            </p>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-200/80 flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="text-base font-black text-[#2563eb]">{categoryItems.length}</span>
              <span>Active Categories</span>
            </div>
            <div className="text-slate-400 text-[11px]">
              Full CRUD Enabled →
            </div>
          </div>
        </div>

        {/* Module Card 2: Subcategories */}
        <div
          onClick={() => setActiveModule('subcategories')}
          className={`relative p-5 sm:p-6 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs select-none ${
            activeModule === 'subcategories'
              ? 'bg-emerald-50/40 border-[#2563eb] ring-2 ring-[#2563eb]/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className={`p-3 rounded-2xl ${
              activeModule === 'subcategories' ? 'bg-[#2563eb] text-white shadow-sm' : 'bg-slate-100 text-slate-700'
            }`}>
              <Tag className="h-6 w-6" />
            </div>

            <span className={`text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
              activeModule === 'subcategories'
                ? 'bg-[#2563eb] text-white'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {activeModule === 'subcategories' ? '● Active Module' : 'Click to Manage'}
            </span>
          </div>

          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Subcategories Module
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Fine-grained product categories linked to their parent categories. Filterable, re-orderable, and re-parentable.
            </p>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-200/80 flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="text-base font-black text-[#2563eb]">{allSubcategories.length}</span>
              <span>Total Subcategories</span>
            </div>
            <div className="text-slate-400 text-[11px]">
              Parent-Linked CRUD →
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          MODULE 1: CATEGORY MANAGEMENT VIEW
          ============================================================ */}
      {activeModule === 'categories' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* Action Toolbar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search categories by name..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] outline-none transition-all placeholder:text-slate-400"
              />
              {categorySearch && (
                <button
                  type="button"
                  onClick={() => setCategorySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsAddCategoryOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Category</span>
              </button>
            </div>
          </div>

          {/* Add Category Slide-Down Drawer / Form */}
          {isAddCategoryOpen && (
            <div className="bg-white border-2 border-[#2563eb]/30 rounded-2xl p-5 shadow-sm space-y-4 animate-in slide-in-from-top-3 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-green-50 text-green-700 rounded-lg">
                    <FolderPlus className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    Create New Category
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateCategory} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Women's Clothing, Kids Fashion..."
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] outline-none transition-all placeholder:text-slate-400"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Bangla name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. মেয়েদের পোশাক, শিশুদের কালেকশন..."
                      value={newCatBanglaName}
                      onChange={(e) => setNewCatBanglaName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Sort order (Priority)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={newCatSortOrder}
                      onChange={(e) => setNewCatSortOrder(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] outline-none transition-all"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Lower number (e.g. 0, 1, 2) displays first</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Product order
                    </label>
                    <select
                      value={newCatProductOrder}
                      onChange={(e) => setNewCatProductOrder(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] outline-none transition-all cursor-pointer"
                    >
                      <option value="default">Default</option>
                      <option value="newest">Newest First</option>
                      <option value="popular">Most Popular</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Category description..."
                    value={newCatDescription}
                    onChange={(e) => setNewCatDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] outline-none transition-all resize-y placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Pictures / Image
                  </label>
                  {newCatImage ? (
                    <div className="flex items-center gap-3">
                      <img 
                        src={newCatImage} 
                        alt="Category preview" 
                        className="w-12 h-12 object-cover rounded-xl border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setNewCatImage('')}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                      >
                        Remove Image
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer transition-colors">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-slate-400" />
                        <span>Image *</span>
                      </div>
                      <span className="text-[#2563eb] font-bold hover:underline">
                        {isUploadingNewCat ? 'Uploading...' : 'Upload'}
                      </span>
                      <input
                        ref={newCatFileRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageCompress(file, setNewCatImage, setIsUploadingNewCat);
                        }}
                        className="hidden"
                        disabled={isUploadingNewCat}
                      />
                    </label>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddCategoryOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newCatName.trim()}
                    className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    Save Category
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Categories List View */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <span>Category Item ({filteredCategories.length})</span>
              <div className="flex items-center gap-8">
                <span className="text-center">Priority / Sort Order</span>
                <span>Subcategories & Products</span>
                <span className="w-24 text-right">Actions</span>
              </div>
            </div>

            {filteredCategories.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {filteredCategories.map((cat, idx) => {
                  const isEditing = editingCatId === cat.id;
                  const subCount = cat.subcategories?.length || 0;
                  const prodCount = productCountMap.getCategoryCount(cat.name);

                  return (
                    <div
                      key={cat.id}
                      className="p-4 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: Thumbnail & Name (or Inline Edit) */}
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {/* Order buttons */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveCategory(idx, 'up')}
                            className="p-1 text-slate-400 hover:text-[#2563eb] hover:bg-green-50 rounded disabled:opacity-20 cursor-pointer transition-colors"
                            title="Move Up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === filteredCategories.length - 1}
                            onClick={() => handleMoveCategory(idx, 'down')}
                            className="p-1 text-slate-400 hover:text-[#2563eb] hover:bg-green-50 rounded disabled:opacity-20 cursor-pointer transition-colors"
                            title="Move Down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Thumbnail */}
                        {cat.image ? (
                          <img
                            src={cat.image}
                            alt={cat.name}
                            className="w-11 h-11 object-cover rounded-xl border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-green-50 text-green-700 border border-green-100 flex items-center justify-center shrink-0">
                            <Layers className="h-5 w-5" />
                          </div>
                        )}

                        {/* Name or Edit Input */}
                        {isEditing ? (
                          <div className="space-y-3 flex-1 max-w-xl bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Name *</label>
                                <input
                                  type="text"
                                  value={editingCatName}
                                  onChange={(e) => setEditingCatName(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                                  autoFocus
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Bangla Name</label>
                                <input
                                  type="text"
                                  placeholder="বাংলা নাম..."
                                  value={editingCatBanglaName}
                                  onChange={(e) => setNewEditingCatBanglaName(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Sort Order</label>
                                <input
                                  type="number"
                                  value={editingCatSortOrder}
                                  onChange={(e) => setEditingCatSortOrder(parseInt(e.target.value, 10) || 0)}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Product Order</label>
                                <select
                                  value={editingCatProductOrder}
                                  onChange={(e) => setEditingCatProductOrder(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] cursor-pointer"
                                >
                                  <option value="default">Default</option>
                                  <option value="newest">Newest First</option>
                                  <option value="popular">Most Popular</option>
                                  <option value="price-asc">Price: Low to High</option>
                                  <option value="price-desc">Price: High to Low</option>
                                </select>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Image selector */}
                              {editingCatImage ? (
                                <div className="relative group shrink-0">
                                  <img
                                    src={editingCatImage}
                                    alt="Edit preview"
                                    className="w-9 h-9 object-cover rounded-lg border border-slate-300"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditingCatImage('')}
                                    className="absolute -top-1.5 -right-1.5 p-0.5 bg-rose-500 text-white rounded-full shadow-xs cursor-pointer"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              ) : (
                                <label className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer text-[10px] font-bold flex items-center gap-1 shrink-0">
                                  <Upload className="h-3 w-3" />
                                  <span>Thumbnail</span>
                                  <input
                                    ref={editCatFileRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleImageCompress(file, setEditingCatImage, setIsUploadingEditCat);
                                    }}
                                    className="hidden"
                                  />
                                </label>
                              )}

                              <div className="flex items-center gap-1.5 ml-auto">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditCategory(cat.id)}
                                  className="px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                                  title="Save Changes"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Save</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCatId(null)}
                                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                                  title="Cancel"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900">
                                {cat.name}
                              </h4>
                              {cat.banglaName && (
                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                  {cat.banglaName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span>ID: {cat.id}</span>
                              {cat.productOrder && cat.productOrder !== 'default' && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-600 font-semibold">Order: {cat.productOrder}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Sort Order badge / input + Subcategory Count + Actions */}
                      <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                        {/* Priority / Sort Order display */}
                        <div className="flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Priority:</span>
                          <input
                            type="number"
                            value={cat.order ?? idx}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (Number.isFinite(val)) {
                                handleQuickUpdateSortOrder(cat.id, val);
                              }
                            }}
                            className="w-12 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-center text-xs font-black text-slate-800 outline-none focus:ring-1 focus:ring-[#2563eb]"
                            title="Directly edit priority sort order"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedParentCategoryFilter(cat.id);
                              setActiveModule('subcategories');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-full text-xs font-bold cursor-pointer transition-colors"
                            title="Click to view and manage subcategories under this category"
                          >
                            <Tag className="h-3 w-3" />
                            <span>{subCount} Subcategories</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>

                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
                            {prodCount} Products
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 w-16 justify-end">
                          <button
                            type="button"
                            onClick={() => handleStartEditCategory(cat)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                            title="Edit Category"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestDeleteCategory(cat)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                            title="Delete Category"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-bold text-slate-700">No categories found</p>
                <p className="text-xs text-slate-400">Try adjusting your search or add a new category.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          MODULE 2: SUBCATEGORY MANAGEMENT VIEW
          ============================================================ */}
      {activeModule === 'subcategories' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* Action Toolbar with Parent Category Filter */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              
              {/* Parent Category Filter Selector (Critical for Logic Sync) */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                <select
                  value={selectedParentCategoryFilter}
                  onChange={(e) => setSelectedParentCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] outline-none transition-all cursor-pointer"
                >
                  <option value="all">All Parent Categories ({allSubcategories.length})</option>
                  {categoryItems.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.subcategories?.length || 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Subcategories */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search subcategories..."
                  value={subcategorySearch}
                  onChange={(e) => setSubcategorySearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] outline-none transition-all placeholder:text-slate-400"
                />
                {subcategorySearch && (
                  <button
                    type="button"
                    onClick={() => setSubcategorySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (selectedParentCategoryFilter !== 'all') {
                    setNewSubParentCatId(selectedParentCategoryFilter);
                  } else if (categoryItems.length > 0) {
                    setNewSubParentCatId(categoryItems[0].id);
                  }
                  setIsAddSubcategoryOpen(true);
                }}
                disabled={categoryItems.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Subcategory</span>
              </button>
            </div>
          </div>

          {/* Add Subcategory Form */}
          {isAddSubcategoryOpen && (
            <div className="bg-white border-2 border-[#2563eb]/30 rounded-2xl p-5 shadow-sm space-y-4 animate-in slide-in-from-top-3 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-green-50 text-green-700 rounded-lg">
                    <Tag className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    Create New Subcategory
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddSubcategoryOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubcategory} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Select Parent Category (CRITICAL FOR LOGIC INTEGRITY) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Parent Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newSubParentCatId}
                      onChange={(e) => setNewSubParentCatId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] outline-none transition-all cursor-pointer"
                      required
                    >
                      {categoryItems.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subcategory Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Subcategory Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Salwar Kameez, Baby Frock..."
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] outline-none transition-all placeholder:text-slate-400"
                      autoFocus
                    />
                  </div>

                  {/* Subcategory Image Upload */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Thumbnail (Optional)
                    </label>
                    {newSubImage ? (
                      <div className="flex items-center gap-3">
                        <img 
                          src={newSubImage} 
                          alt="Subcategory preview" 
                          className="w-10 h-10 object-cover rounded-xl border border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => setNewSubImage('')}
                          className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer transition-colors">
                        <Upload className="h-4 w-4 text-slate-400" />
                        <span>{isUploadingNewSub ? 'Uploading...' : 'Upload Image'}</span>
                        <input
                          ref={newSubFileRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageCompress(file, setNewSubImage, setIsUploadingNewSub);
                          }}
                          className="hidden"
                          disabled={isUploadingNewSub}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddSubcategoryOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newSubName.trim() || !newSubParentCatId}
                    className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    Save Subcategory
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Subcategories List View */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <span>Subcategory Item ({filteredSubcategories.length})</span>
              <div className="flex items-center gap-8">
                <span>Parent Category & Products</span>
                <span className="w-24 text-right">Actions</span>
              </div>
            </div>

            {filteredSubcategories.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {filteredSubcategories.map((sub, idx) => {
                  const prodCount = productCountMap.getSubcategoryCount(sub.name);

                  return (
                    <div
                      key={`${sub.categoryId}-${sub.id}`}
                      className="p-4 hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-4"
                    >
                      {/* Left: Thumbnail & Name */}
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {/* Order buttons */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveSubcategory(sub.categoryId, sub.id, 'up')}
                            className="p-1 text-slate-400 hover:text-[#2563eb] hover:bg-green-50 rounded cursor-pointer transition-colors"
                            title="Move Up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSubcategory(sub.categoryId, sub.id, 'down')}
                            className="p-1 text-slate-400 hover:text-[#2563eb] hover:bg-green-50 rounded cursor-pointer transition-colors"
                            title="Move Down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Thumbnail */}
                        {sub.image ? (
                          <img
                            src={sub.image}
                            alt={sub.name}
                            className="w-10 h-10 object-cover rounded-xl border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
                            <Tag className="h-4 w-4" />
                          </div>
                        )}

                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            {sub.name}
                          </h4>
                          <span className="text-[11px] text-slate-400">
                            ID: {sub.id}
                          </span>
                        </div>
                      </div>

                      {/* Right: Parent Category Badge + Product Count + Actions */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex items-center gap-2">
                          {/* Parent Category Badge */}
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-full text-xs font-bold flex items-center gap-1.5">
                            <Layers className="h-3 w-3 text-emerald-600" />
                            <span>{sub.categoryName}</span>
                          </span>

                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
                            {prodCount} Products
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 w-20 justify-end">
                          <button
                            type="button"
                            onClick={() => handleStartEditSubcategory(sub)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                            title="Edit Subcategory"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestDeleteSubcategory(sub)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                            title="Delete Subcategory"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-bold text-slate-700">No subcategories found</p>
                <p className="text-xs text-slate-400">
                  {selectedParentCategoryFilter !== 'all'
                    ? 'No subcategories exist for the selected parent category.'
                    : 'Use the "Add Subcategory" button to add one.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          EDIT SUBCATEGORY MODAL (WITH RE-PARENTING SUPPORT)
          ============================================================ */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                Edit Subcategory
              </h3>
              <button
                type="button"
                onClick={() => setEditingSub(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Parent Category
                </label>
                <select
                  value={editingSub.targetCatId}
                  onChange={(e) => setEditingSub({ ...editingSub, targetCatId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] outline-none transition-all cursor-pointer"
                >
                  {categoryItems.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Subcategory Name
                </label>
                <input
                  type="text"
                  value={editingSub.name}
                  onChange={(e) => setEditingSub({ ...editingSub, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] outline-none transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Thumbnail
                </label>
                {editingSub.image ? (
                  <div className="flex items-center gap-3">
                    <img 
                      src={editingSub.image} 
                      alt="Preview" 
                      className="w-10 h-10 object-cover rounded-xl border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingSub({ ...editingSub, image: '' })}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer transition-colors">
                    <Upload className="h-4 w-4 text-slate-400" />
                    <span>{isUploadingEditSub ? 'Uploading...' : 'Upload Image'}</span>
                    <input
                      ref={editSubFileRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageCompress(
                            file, 
                            (url) => setEditingSub({ ...editingSub, image: url }),
                            setIsUploadingEditSub
                          );
                        }
                      }}
                      className="hidden"
                      disabled={isUploadingEditSub}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100 justify-end">
              <button
                type="button"
                onClick={() => setEditingSub(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditSubcategory}
                disabled={!editingSub.name.trim()}
                className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          DELETE CONFIRMATION MODAL
          ============================================================ */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 mx-auto">
              <AlertCircle className="h-6 w-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Delete {deleteModal.type === 'category' ? 'Category' : 'Subcategory'}?
              </h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove <span className="font-bold text-slate-800">"{deleteModal.name}"</span>?
              </p>
              {deleteModal.warning && (
                <p className="text-xs text-amber-600 font-semibold bg-amber-50 p-2 rounded-lg mt-2">
                  {deleteModal.warning}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, type: 'category', catId: '', name: '' })}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Feedback Dialog */}
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
