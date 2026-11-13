import { Product } from '../types';

/**
 * Escapes a field for CSV export according to RFC 4180
 */
function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Robust CSV parser that correctly handles quoted strings, escaped quotes, and newlines.
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let cell = '';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some(r => r.length > 0)) lines.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some(r => r.length > 0)) lines.push(row);
  }

  return lines;
}

/**
 * Exports products as an Excel-compatible CSV file (UTF-8 BOM).
 */
export function exportProductsToExcel(products: Product[], filename?: string): void {
  const headers = [
    'ID',
    'Title',
    'Category',
    'SubCategory',
    'Price',
    'RegularPrice',
    'Stock',
    'SKU',
    'Brand',
    'Series',
    'Subtitle',
    'Description',
    'CoverImage',
    'AdditionalImages'
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(',')];

  for (const p of products) {
    const additionalImgs = Array.isArray(p.additionalImages) 
      ? p.additionalImages.join(';') 
      : (Array.isArray(p.images) ? p.images.slice(1).join(';') : '');

    const row = [
      escapeCsvCell(p.id || ''),
      escapeCsvCell(p.title || ''),
      escapeCsvCell(p.category || ''),
      escapeCsvCell(p.subCategory || ''),
      escapeCsvCell(p.price || 0),
      escapeCsvCell(p.regularPrice || ''),
      escapeCsvCell(p.stock !== undefined ? p.stock : 100),
      escapeCsvCell(p.sku || ''),
      escapeCsvCell(p.brand || ''),
      escapeCsvCell(p.series || ''),
      escapeCsvCell(p.subtitle || ''),
      escapeCsvCell(p.description || ''),
      escapeCsvCell(p.coverImage || p.image || ''),
      escapeCsvCell(additionalImgs)
    ];

    rows.push(row.join(','));
  }

  // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel opens it directly without character encoding issues
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', filename || `meghbristi-products-${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a ready-to-fill sample CSV template formatted for Excel.
 */
export function downloadProductExcelTemplate(): void {
  const sampleProducts: Product[] = [
    {
      id: 'MBF-001',
      title: 'Embroidered Silk Salwar Kameez',
      category: 'Salwar Kameez',
      subCategory: 'Three Piece',
      price: 3650,
      regularPrice: 4200,
      stock: 45,
      sku: 'MBF-SK-101',
      brand: 'Megh Bristi',
      series: 'Festive Luxury',
      subtitle: 'Premium handcrafted embroidery on fine silk fabric',
      description: 'Luxury three-piece salwar kameez set crafted with exquisite organza dupatta and tailored trousers.',
      coverImage: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
      additionalImages: []
    },
    {
      id: 'MBF-002',
      title: 'Designer Floral Organza Saree',
      category: 'Designer Saree',
      subCategory: 'Organza',
      price: 4800,
      regularPrice: 5500,
      stock: 30,
      sku: 'MBF-SR-202',
      brand: 'Megh Bristi',
      series: 'Signature',
      subtitle: 'Pure organza saree with delicate floral hand-work',
      description: 'Stunning designer saree with running blouse piece and gold foil accents.',
      coverImage: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
      additionalImages: []
    },
    {
      id: 'MBF-003',
      title: 'Mens Premium Jacquard Panjabi',
      category: 'Mens Panjabi',
      subCategory: 'Slim Fit',
      price: 2450,
      regularPrice: 2850,
      stock: 60,
      sku: 'MBF-PJ-303',
      brand: 'Megh Bristi',
      series: 'Royal Classics',
      subtitle: '100% Cotton Jacquard with mandarin collar and metallic buttons',
      description: 'Classic bespoke mens Panjabi suited for Eid, weddings, and formal celebrations.',
      coverImage: 'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?auto=format&fit=crop&w=800&q=80',
      additionalImages: []
    }
  ];

  exportProductsToExcel(sampleProducts, 'meghbristi-products-sample-template.csv');
}

/**
 * Normalizes headers and parses imported CSV file into partial Product objects.
 */
export function parseProductExcel(csvText: string): {
  validProducts: Partial<Product>[];
  errors: string[];
} {
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    return {
      validProducts: [],
      errors: ['The selected file does not contain enough data or is empty. Please include a header row and at least 1 product row.']
    };
  }

  const rawHeaders = rows[0].map(h => h.trim().toLowerCase().replace(/[\s_-]+/g, ''));
  const headerMap: { [key: string]: number } = {};

  rawHeaders.forEach((h, idx) => {
    headerMap[h] = idx;
  });

  const getColIndex = (...candidates: string[]): number => {
    for (const c of candidates) {
      const normalized = c.toLowerCase().replace(/[\s_-]+/g, '');
      if (headerMap[normalized] !== undefined) return headerMap[normalized];
    }
    return -1;
  };

  const titleIdx = getColIndex('title', 'name', 'productname', 'product', 'নাম', 'প্রোডাক্ট');
  const priceIdx = getColIndex('price', 'sellprice', 'saleprice', 'বিক্রয়মূল্য', 'দাম', 'মূল্য');
  const regPriceIdx = getColIndex('regularprice', 'originalprice', 'oldprice', 'listprice', 'পূর্বেরমূল্য');
  const catIdx = getColIndex('category', 'cat', 'ক্যাটাগরি');
  const subCatIdx = getColIndex('subcategory', 'subcat');
  const stockIdx = getColIndex('stock', 'quantity', 'qty', 'স্টক');
  const skuIdx = getColIndex('sku', 'code', 'barcode', 'কোড');
  const brandIdx = getColIndex('brand', 'ব্র্যান্ড');
  const seriesIdx = getColIndex('series', 'সিরিজ');
  const subtitleIdx = getColIndex('subtitle', 'shortdescription', 'সংক্ষিপ্তবিবরণ');
  const descIdx = getColIndex('description', 'details', 'বিবরণ');
  const coverImgIdx = getColIndex('coverimage', 'image', 'photo', 'ছবি');
  const addImgsIdx = getColIndex('additionalimages', 'images', 'moreimages');

  if (titleIdx === -1) {
    return {
      validProducts: [],
      errors: ['Missing required column: "Title" or "Product Name" header not found in the file.']
    };
  }

  const validProducts: Partial<Product>[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
      continue;
    }

    const title = row[titleIdx]?.trim();
    if (!title) {
      errors.push(`Row ${i + 1}: Skipped because Title is empty.`);
      continue;
    }

    let price = 0;
    if (priceIdx !== -1 && row[priceIdx]) {
      const cleanPrice = row[priceIdx].replace(/[^0-9.]/g, '');
      price = parseFloat(cleanPrice) || 0;
    }

    let regularPrice: number | undefined;
    if (regPriceIdx !== -1 && row[regPriceIdx]) {
      const cleanReg = row[regPriceIdx].replace(/[^0-9.]/g, '');
      const parsedReg = parseFloat(cleanReg);
      if (parsedReg > 0) regularPrice = parsedReg;
    }

    let stock = 100;
    if (stockIdx !== -1 && row[stockIdx]) {
      const cleanStock = row[stockIdx].replace(/[^0-9]/g, '');
      const parsedStock = parseInt(cleanStock, 10);
      if (!isNaN(parsedStock)) stock = parsedStock;
    }

    const category = (catIdx !== -1 && row[catIdx]?.trim()) || 'Salwar Kameez';
    const subCategory = (subCatIdx !== -1 && row[subCatIdx]?.trim()) || '';
    const sku = (skuIdx !== -1 && row[skuIdx]?.trim()) || `MBF-${Date.now().toString().slice(-6)}-${i}`;
    const brand = (brandIdx !== -1 && row[brandIdx]?.trim()) || 'Megh Bristi';
    const series = (seriesIdx !== -1 && row[seriesIdx]?.trim()) || '';
    const subtitle = (subtitleIdx !== -1 && row[subtitleIdx]?.trim()) || '';
    const description = (descIdx !== -1 && row[descIdx]?.trim()) || '';
    const coverImage = (coverImgIdx !== -1 && row[coverImgIdx]?.trim()) || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80';

    const rawAddImgs = (addImgsIdx !== -1 && row[addImgsIdx]?.trim()) || '';
    const additionalImages = rawAddImgs
      ? rawAddImgs.split(/[;,|]/).map(s => s.trim()).filter(Boolean)
      : [];

    validProducts.push({
      title,
      category,
      subCategory,
      price: price > 0 ? price : 1500,
      regularPrice,
      stock,
      sku,
      brand,
      series,
      subtitle,
      description,
      coverImage,
      image: coverImage,
      additionalImages,
      inStock: stock > 0
    });
  }

  return { validProducts, errors };
}
