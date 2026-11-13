import { dbService } from "../lib/dbService";
//fix pixel event 2

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  ShoppingBag, User, Search, ChevronDown, ChevronLeft, ChevronRight,
  ArrowRight, ArrowLeft, Heart, Star, Check, Sparkles, X, Plus, Minus,
  ShieldCheck, Truck, RefreshCw, Send, HelpCircle, Eye, Share2, Award,
  Phone, Mail, Globe, Droplet, Sun, Moon, Zap, Flame, Layers, MessageCircle, ArrowUp, MapPin, ZoomIn, Clock,
  Building2, BookOpen, Microscope, Quote, Sprout, FlaskConical, CreditCard, Smartphone, Copy, Tag,
  Play, Pause, Volume2, VolumeX, Menu, CheckCircle2, AlertCircle, Info, Trash2,
  Home, LayoutGrid, ShoppingCart
} from 'lucide-react';
import { trackEvent, createEventId } from '../lib/pixelGtmService';
import { Product, BookOrder, EcomSettings, InstituteInfo, ContactMessage, AboutPageSettings, DeliveryMethodItem, PaymentGatewayItem, Coupon, HeaderSettings, HeroBannerItem, Brand, CategoryItem, SubCategoryItem } from '../types';
import { publicStoreService, optimizeImageUrl, readStorefrontCache } from '../lib/publicStoreService';
import { 
  DEFAULT_ABOUT_SETTINGS, DEFAULT_DELIVERY_METHODS, DEFAULT_PAYMENT_GATEWAYS, 
  DEFAULT_HEADER_SETTINGS, DEFAULT_HERO_BANNERS, DEFAULT_PRODUCTS, 
  BANGLADESHI_FEMALE_CART_REVIEWS,
  DEFAULT_CLIENT_LOGOS_SETTINGS, DEFAULT_BEFORE_AFTER_SETTINGS,
  DEFAULT_PHOTO_REVIEWS_SETTINGS, DEFAULT_TESTIMONIAL_SETTINGS
} from '../lib/constants';
import { ProductSearchEngine } from '../lib/searchIndex';
import { useAppStore } from '../store/useAppStore';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { updateMetaTags, updateProductSchema, getProductSlug } from '../lib/seoUtils';
import ResponsiveImage from './ResponsiveImage';
import { DoctorFloatingTrigger } from './ai/DoctorFloatingTrigger';
import { FeedbackDialog } from './ui/FeedbackDialog';
import ProductReviewsSection from './ProductReviewsSection';
import { getCustomerSession, clearCustomerSession, type CustomerSession } from '../lib/customerAuth';
import { calculateCartTotalWeight, calculateDeliveryCharge } from '../lib/deliveryCalculator';
import { ScrollReveal } from './ScrollReveal';
import BeforeAfterSection from './BeforeAfterSection';
import PhotoReviewsSection from './PhotoReviewsSection';
import CustomerTestimonialsSection from './CustomerTestimonialsSection';
import FaqSection from './FaqSection';
import AmbientSoapBubbles from './AmbientSoapBubbles';
import WashingComparisonSection from './WashingComparisonSection';
import { validateOrderCustomerDetails } from '../lib/orderValidation';
import SimpleAuth from './SimpleAuth';

const CheckoutPage = React.lazy(() => import('./CheckoutPage'));
const AboutUsPage = React.lazy(() => import('./AboutUsPage'));
const StoreFooter = React.lazy(() => import('./StoreFooter'));

interface StorefrontPageProps {
  onGoToLogin?: () => void;
  onGoToLanding?: () => void;
}

export interface StoreProductItem extends Product {
  series: string;
  isSet?: boolean;
  benefitsHighlights?: string;
  howToUse?: string;
  ingredients?: string;
}

export interface BestSellerStoreProduct extends StoreProductItem {
  salesCount: number;
}

// Backwards compatibility alias
export type FantineProductItem = StoreProductItem;


// Dynamic Product Helpers & Fallbacks (Driven by Server Database & Admin Catalog)
export const DEFAULT_PRODUCT_FALLBACK_IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23f8fafc"/><text x="50%" y="50%" font-family="sans-serif" font-size="14" fill="%2394a3b8" dominant-baseline="middle" text-anchor="middle">Product</text></svg>';
export const DEFAULT_STORE_FALLBACK_IMAGE = DEFAULT_PRODUCT_FALLBACK_IMAGE;
export const DEFAULT_FANTINE_FALLBACK_IMAGE = DEFAULT_STORE_FALLBACK_IMAGE;

export const getSafeProductImage = (rawImg?: any, _indexOrSeed?: number | string): string => {
  if (!rawImg || typeof rawImg !== 'string' || !rawImg.trim()) {
    return DEFAULT_STORE_FALLBACK_IMAGE;
  }
  const trimmed = rawImg.trim();
  if (
    trimmed.includes('photo-1544716278-ca5e3f4abd8c') ||
    trimmed.includes('/watch.jpg') ||
    trimmed.includes('/book.png') ||
    trimmed === 'undefined' ||
    trimmed === 'null'
  ) {
    return DEFAULT_STORE_FALLBACK_IMAGE;
  }
  return trimmed;
};

export const getSafeSkincareImage = getSafeProductImage;

export const normalizeStoreProduct = (p: Product, index: number = 0): StoreProductItem => {
  const price = typeof p.price === 'number' ? p.price : (Number(p.price) || 0);
  const regularPrice = p.regularPrice ? (typeof p.regularPrice === 'number' ? p.regularPrice : Number(p.regularPrice)) : undefined;
  const discountPercentage = p.discountPercentage || (regularPrice && regularPrice > price ? Math.round(((regularPrice - price) / regularPrice) * 100) : undefined);
  
  const rawCover = (p as any).coverImage || p.image || (p as any).imageUrl || ((p as any).images && (p as any).images[0]) || ((p as any).samplePages && (p as any).samplePages[0]);
  const coverImage = getSafeProductImage(rawCover, index);
  
  const rawAdditional = (p as any).additionalImages || (p as any).images || (p as any).samplePages;
  const additionalImages = Array.isArray(rawAdditional) && rawAdditional.length > 0 
    ? rawAdditional.map((img: string, i: number) => getSafeProductImage(img, i))
    : [coverImage];

  return {
    ...p,
    id: p.id || `prod_${Date.now()}_${index}`,
    title: p.title || 'Product Item',
    author: (p as any).author || p.brand || 'Store',
    regularPrice,
    price,
    discountPercentage,
    stockQuantity: p.stockQuantity ?? p.stock ?? 500,
    category: p.category || 'General',
    series: (p as any).series || p.category || 'Standard Series',
    coverImage,
    additionalImages,
    description: p.description || p.shortSummary || '',
    benefitsHighlights: (p as any).benefitsHighlights || '',
    howToUse: (p as any).howToUse || (p as any).howToUseIt || '',
    ingredients: (p as any).ingredients || '',
    badge: (p as any).badge || (p.isFeatured ? 'Featured' : undefined),
    rating: p.rating || 5.0,
    reviewsCount: p.reviewsCount || 1,
    isFeatured: p.isFeatured ?? true
  };
};

export const normalizeFantineProduct = normalizeStoreProduct;

// Fallback products from constants (only if server database has not returned yet)
const FALLBACK_PRODUCTS: StoreProductItem[] = DEFAULT_PRODUCTS.map((p, idx) => normalizeStoreProduct(p, idx));
const STORE_PRODUCTS = FALLBACK_PRODUCTS;
const FANTINE_PRODUCTS = FALLBACK_PRODUCTS;

export const BLANK_STORE_PRODUCT: StoreProductItem = {
  id: '',
  title: '',
  price: 0,
  regularPrice: 0,
  stockQuantity: 0,
  category: 'General',
  series: 'General',
  coverImage: DEFAULT_STORE_FALLBACK_IMAGE,
  additionalImages: [DEFAULT_STORE_FALLBACK_IMAGE],
  description: '',
  rating: 5,
  reviewsCount: 0,
  isFeatured: false,
};

export const BLANK_FANTINE_PRODUCT = BLANK_STORE_PRODUCT;

const DEFAULT_SHOP_CATEGORIES = [
  'All'
];

function extractYouTubeVideoId(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match && match[1]) {
    return match[1];
  }
  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}


const DEFAULT_PODS_SPEC_TABLE = [
  { feature: 'Product Name', details: 'Laundry Detergent Pods' },
  { feature: 'Product Type', details: 'All-in-1 / 3-in-1 / 4-in-1 / 5-in-1 Laundry Pods' },
  { feature: 'Pod Weight', details: '8g / 10g / 12g / 15g / 25g per Pod' },
  { feature: 'Recommended Laundry Load', details: 'Approx. 2–12kg per Pod, Depending on Pod Weight, Formula Concentration and Washing Conditions' },
  { feature: 'Chamber Structure', details: 'Single Chamber / 3 Chambers / 4 Chambers / 5 Chambers' },
  { feature: 'Formula Type', details: 'Liquid / Powder / Fragrance Beads / Multi-Formula Combination' },
  { feature: 'Functions', details: 'Deep Cleaning / Stain Removal / Antibacterial Care / Anti-Mite Care / Fabric Softening / Color Protection / Long-Lasting Fragrance / Odor Control' },
  { feature: 'Fragrance Options', details: 'Lavender / Lemon / Rose / Jasmine / Ocean Breeze / Fresh Cotton / Green Tea / Floral / Fruity / Woody / Fragrance-Free' },
  { feature: 'Specialized Solutions', details: 'Baby & Sensitive Care / Pet Odor and Stain Care / Sportswear Odor Control / Hospitality and Commercial Linen' }
];

// Category-wise products with auto scroll component
function AutoScrollCategorySection({
  title,
  subtitle,
  products,
  onProductClick,
  onOrderClick,
  onViewAll
}: {
  title: string;
  subtitle?: string;
  products: any[];
  onProductClick: (p: any) => void;
  onOrderClick: (p: any) => void;
  onViewAll: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Ensure every category section has enough items to auto-scroll continuously
  const displayProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    if (products.length < 8) {
      const repeated = [...products];
      while (repeated.length < 12) {
        repeated.push(...products);
      }
      return repeated;
    }
    return products;
  }, [products]);

  const scrollByDirection = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const step = Math.max(220, Math.round(el.clientWidth * 0.45));
    el.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' });
  };

  // Continuous Auto-scroll every 3 seconds for ALL category sections
  useEffect(() => {
    if (isPaused || displayProducts.length === 0) return;
    const interval = setInterval(() => {
      if (!scrollRef.current) return;
      const el = scrollRef.current;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 5) return;

      const step = Math.max(220, Math.round(el.clientWidth * 0.45));
      if (el.scrollLeft >= maxScroll - 15) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: step, behavior: 'smooth' });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused, displayProducts.length]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;
    const ratio = el.scrollLeft / maxScroll;
    setActiveDot(Math.min(2, Math.round(ratio * 2)));
  };

  const scrollToDot = (dotIdx: number) => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const maxScroll = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: (dotIdx / 2) * maxScroll, behavior: 'smooth' });
    setActiveDot(dotIdx);
  };

  return (
    <section 
      className="py-8 sm:py-10 bg-[#fdfcfb] border-b border-slate-200/80 select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4 sm:mb-7 border-b border-slate-200/90 pb-2.5">
          <div className="relative inline-block min-w-0 pr-2">
            <h2 className="text-base sm:text-2xl font-black text-slate-900 tracking-tight font-sans uppercase flex items-center gap-2">
              <span className="whitespace-nowrap">{title}</span>
              {subtitle && (
                <span className="hidden sm:inline-block text-xs sm:text-sm font-bold bg-[#ffc107] text-slate-950 px-2.5 py-0.5 rounded-md shadow-2xs whitespace-nowrap">
                  {subtitle}
                </span>
              )}
            </h2>
            <div className="absolute -bottom-[11px] left-0 w-16 sm:w-20 h-[3px] bg-[#16a34a] rounded-full" />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => scrollByDirection('left')}
              className="hidden sm:flex w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-300 hover:border-[#16a34a] hover:bg-[#16a34a] hover:text-white text-slate-700 items-center justify-center transition shadow-2xs cursor-pointer active:scale-95"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByDirection('right')}
              className="hidden sm:flex w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-300 hover:border-[#16a34a] hover:bg-[#16a34a] hover:text-white text-slate-700 items-center justify-center transition shadow-2xs cursor-pointer active:scale-95"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onViewAll}
              className="inline-flex items-center gap-1 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a] hover:text-white text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer group shrink-0"
            >
              <span>View All</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          className="flex items-stretch gap-3.5 sm:gap-4 lg:gap-5 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth snap-x snap-mandatory pb-3"
        >
          {displayProducts.map((product, idx) => (
            <div
              key={`${product.id}-${idx}`}
              onClick={() => onProductClick(product)}
              className="bg-white rounded-xl border border-slate-200/90 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between overflow-hidden group cursor-pointer flex-none w-[calc(50%-8px)] sm:w-[calc(33.33%-12px)] md:w-[calc(25%-14px)] lg:w-[calc(20%-16px)] snap-start"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-50">
                <img
                  loading="lazy"
                  src={optimizeImageUrl(product.coverImage || product.image || (product.images && product.images[0]), 400)}
                  alt={product.title}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_PRODUCT_FALLBACK_IMAGE;
                  }}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              <div className="p-3 sm:p-3.5 flex flex-col justify-between flex-1 bg-white">
                <div>
                  <h3
                    className="text-xs sm:text-[13px] font-medium text-slate-800 group-hover:text-[#16a34a] transition-colors line-clamp-2 leading-snug min-h-[36px]"
                    title={product.title}
                  >
                    {product.title}
                  </h3>
                  <div className="mt-2 mb-3">
                    <span className="text-sm sm:text-base font-black text-slate-900">
                      Tk. {Number(product.price).toLocaleString('en-US')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOrderClick(product);
                  }}
                  className="w-full py-2 sm:py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center tracking-wide"
                >
                  Order Now
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Indicator Dots */}
        {displayProducts.length > 5 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            {[0, 1, 2].map((dot) => (
              <button
                key={dot}
                type="button"
                onClick={() => scrollToDot(dot)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  activeDot === dot ? 'w-5 bg-slate-700' : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
                aria-label={`Go to slide ${dot + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Our Brands Carousel Component
function OurBrandsSection({
  brands,
  onBrandClick
}: {
  brands: any[];
  onBrandClick: (name: string) => void;
}) {
  const brandScrollRef = useRef<HTMLDivElement>(null);

  const scrollBrands = (dir: 'left' | 'right') => {
    if (!brandScrollRef.current) return;
    const amount = dir === 'left' ? -260 : 260;
    brandScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <section className="py-10 sm:py-14 bg-white border-b border-slate-200/80 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4 sm:mb-8 border-b border-slate-200/90 pb-2.5">
          <div className="relative inline-block min-w-0 pr-2">
            <h2 className="text-base sm:text-2xl font-black text-slate-900 tracking-wider uppercase font-sans flex items-center gap-2">
              <span className="whitespace-nowrap">OUR BRANDS</span>
              <span className="hidden sm:inline-block text-xs sm:text-sm font-bold bg-[#16a34a]/10 text-[#16a34a] px-2.5 py-0.5 rounded-md whitespace-nowrap">
                Official Brands
              </span>
            </h2>
            <div className="absolute -bottom-[11px] left-0 w-16 sm:w-20 h-[3px] bg-[#16a34a] rounded-full" />
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedBrand('All');
              navigateTo('shop');
            }}
            className="inline-flex items-center gap-1 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a] hover:text-white text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer group shrink-0"
          >
            <span>View All</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>

        <div className="relative group/brands">
          <button
            type="button"
            onClick={() => scrollBrands('left')}
            className="absolute -left-2 sm:-left-3.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[#16a34a] hover:bg-[#15803d] text-white flex items-center justify-center shadow-md transition-all cursor-pointer active:scale-95"
            aria-label="Previous brands"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          <button
            type="button"
            onClick={() => scrollBrands('right')}
            className="absolute -right-2 sm:-right-3.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[#16a34a] hover:bg-[#15803d] text-white flex items-center justify-center shadow-md transition-all cursor-pointer active:scale-95"
            aria-label="Next brands"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>

          <div
            ref={brandScrollRef}
            className="flex items-center justify-between sm:justify-start gap-4 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth py-3 px-6 sm:px-8"
          >
            {brands.map((brand, idx) => (
              <div
                key={idx}
                onClick={() => onBrandClick(brand.name)}
                className="bg-white border border-slate-200/90 hover:border-[#16a34a] hover:shadow-md rounded-xl p-4 flex flex-col items-center justify-center h-28 sm:h-32 min-w-[170px] sm:min-w-[190px] shrink-0 cursor-pointer transition-all group select-none"
              >
                <div className="h-12 sm:h-14 flex items-center justify-center">
                  {brand.logo ? (
                    <img
                      src={brand.logo}
                      alt={brand.name}
                      className="max-h-12 max-w-[130px] object-contain group-hover:scale-105 transition-transform"
                    />
                  ) : brand.icon ? (
                    brand.icon
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-green-600 flex items-center justify-center text-white font-black text-lg shadow-xs">
                      {brand.name[0]}
                    </div>
                  )}
                </div>
                <span className="text-xs sm:text-[13px] font-bold text-[#16a34a] group-hover:text-[#15803d] text-center mt-2.5 truncate max-w-full">
                  {brand.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function StorefrontPage({ onGoToLogin, onGoToLanding }: StorefrontPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId, slug: routeSlug } = useParams<{ id?: string; slug?: string }>();

  // Navigation View: 'home' | 'shop' | 'about' | 'contact' | 'product_detail' | 'checkout' | 'blog' | 'blog_post'
  const [activeNav, setActiveNav] = useState<'home' | 'shop' | 'about' | 'contact' | 'product_detail' | 'checkout' | 'collections'>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p.startsWith('/collections') || p.startsWith('/collection')) return 'collections';
      if (p.startsWith('/product')) return 'product_detail';
      if (p.startsWith('/shop')) return 'shop';
      if (p.startsWith('/about')) return 'about';
      if (p.startsWith('/contact')) return 'contact';
      if (p.startsWith('/checkout')) return 'checkout';
    }
    return 'home';
  });
  const [selectedCategoryCheckbox, setSelectedCategoryCheckbox] = useState<string>('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('All');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [priceRange, setPriceRange] = useState<number>(50000); // Max range default
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  // Dynamic Ecom Settings for Hero Banners & Videos (Instant cached synchronous hydration)
  const [ecomSettings, setEcomSettings] = useState<EcomSettings | null>(() => {
    return readStorefrontCache<EcomSettings>('noor_ecom_settings', null);
  });
  const [instituteInfo, setInstituteInfo] = useState<InstituteInfo | null>(() => {
    return readStorefrontCache<InstituteInfo>('noor_institute_info', null);
  });
  const [realBrands, setRealBrands] = useState<Brand[]>(() => {
    return readStorefrontCache<Brand[]>('noor_brands', []) || [];
  });
  const [realCategories, setRealCategories] = useState<string[]>(() => {
    return readStorefrontCache<string[]>('noor_categories', []) || [];
  });
  const [realCategoryItems, setRealCategoryItems] = useState<CategoryItem[]>(() => {
    const cachedSettings = readStorefrontCache<EcomSettings>('noor_ecom_settings', null);
    if (cachedSettings?.categoryItems && Array.isArray(cachedSettings.categoryItems) && cachedSettings.categoryItems.length > 0) {
      return cachedSettings.categoryItems;
    }
    return readStorefrontCache<CategoryItem[]>('noor_category_items', []) || [];
  });
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [storeLogoFailed, setStoreLogoFailed] = useState<boolean>(false);

  // Dynamic Product State from Admin / DB (No Seed Data Overwriting)
  const [products, setProducts] = useState<StoreProductItem[]>(() => {
    try {
      const cached = localStorage.getItem('noor_ecom_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleanParsed = parsed.filter((p: any) => 
            p.id !== '3-in-1-laundry-detergent-pods' &&
            p.id !== 'leaf-curt-5-in-1-laundry-pods-tub' &&
            p.id !== 'leaf-curt-5-in-1-laundry-pods-box' &&
            !p.title?.toLowerCase().includes('pods') &&
            !p.category?.toLowerCase().includes('pods') &&
            !p.brand?.toLowerCase().includes('fantine') &&
            p.category !== 'Serums' &&
            p.category !== 'Toners' &&
            p.category !== 'Rapid Acne Treatment Series'
          );
          if (cleanParsed.length > 0) {
            return cleanParsed.map((p: any, idx: number) => normalizeStoreProduct(p, idx));
          }
        }
      }
    } catch {
      // fallback
    }
    return [];
  });

  // Best Sellers (Algorithm-based: Week / Month / All-time sales rankings)
  const [bestSellers, setBestSellers] = useState<{
    week: BestSellerStoreProduct[];
    month: BestSellerStoreProduct[];
    all: BestSellerStoreProduct[];
    totalSales: number;
  }>({
    week: [],
    month: [],
    all: [],
    totalSales: 0
  });
  const [bestSellerPeriod, setBestSellerPeriod] = useState<'week' | 'month' | 'all'>('week');

  // Helper to find matching product from URL path or router params
  const findProductFromPath = useCallback((path: string, idParam?: string, slugParam?: string, productList: StoreProductItem[] = products) => {
    if (!productList || productList.length === 0) return null;
    const targetId = (idParam || '').toLowerCase();
    const targetSlug = (slugParam || '').toLowerCase();

    // 1. Direct match by ID
    if (targetId) {
      const directMatch = productList.find(p => p.id.toLowerCase() === targetId);
      if (directMatch) return directMatch;
    }

    // 2. Direct match by slug
    if (targetSlug) {
      const slugMatch = productList.find(p => {
        const pSlug = getProductSlug(p).toLowerCase();
        return pSlug === targetSlug || p.id.toLowerCase() === targetSlug;
      });
      if (slugMatch) return slugMatch;
    }

    // 3. Maybe targetId is actually a slug
    if (targetId) {
      const slugAsIdMatch = productList.find(p => {
        const pSlug = getProductSlug(p).toLowerCase();
        return pSlug === targetId;
      });
      if (slugAsIdMatch) return slugAsIdMatch;
    }

    // 4. Check if pathname contains any product id
    const pathLower = path.toLowerCase();
    const pathMatch = productList.find(p => pathLower.includes(p.id.toLowerCase()));
    if (pathMatch) return pathMatch;

    // 5. Check if pathname contains any product slug
    const pathSlugMatch = productList.find(p => {
      const pSlug = getProductSlug(p).toLowerCase();
      return pSlug.length > 3 && pathLower.includes(pSlug);
    });
    if (pathSlugMatch) return pathSlugMatch;

    return null;
  }, [products]);

  // Active Selected Product for Detail Page (Deep link aware on initial load)
  const [activeProductDetail, setActiveProductDetail] = useState<StoreProductItem>(() => {
    const initialList = products.length > 0 ? products : STORE_PRODUCTS;
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/product')) {
      const p = window.location.pathname;
      const found = initialList.find(prod => {
        const slug = getProductSlug(prod).toLowerCase();
        return p.includes(prod.id) || (slug.length > 3 && p.toLowerCase().includes(slug));
      });
      if (found) return found;
    }
    return initialList[0] || BLANK_STORE_PRODUCT;
  });
  const [activeVariant, setActiveVariant] = useState<any>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState<boolean>(false);
  const [isHoverZooming, setIsHoverZooming] = useState<boolean>(false);
  const [zoomPos, setZoomPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [detailQuantity, setDetailQuantity] = useState<number>(1);
  const [isCodeCopied, setIsCodeCopied] = useState<boolean>(false);

  const handleProductImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };
  const isCollectionMatched = (col: FeaturedCollection, targetId: string) => {
    if (!targetId || targetId === 'all') return true;
    const t = targetId.toLowerCase().trim();
    const cId = (col.id || '').toLowerCase().trim();
    const cTitle = (col.title || '').toLowerCase().trim();
    const cSlug = cTitle.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return cId === t || cTitle === t || cSlug === t || (t.length >= 3 && (cId.includes(t) || cTitle.includes(t) || cSlug.includes(t)));
  };

  const [activeCollectionId, setActiveCollectionId] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(() => getCustomerSession());

  useEffect(() => {
    const handleAuthChange = () => {
      setCustomerSession(getCustomerSession());
    };
    window.addEventListener('customer-auth-changed', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener('customer-auth-changed', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);


  // Sync Live Settings, Categories, Brands & Sliders from backend server API
  const loadLiveSettings = async () => {
    try {
      const [settings, info, brandsList, catItems, slidersList] = await Promise.all([
        publicStoreService.getEcomSettings().catch(() => null),
        publicStoreService.getInstituteInfo().catch(() => null),
        publicStoreService.getBrands().catch(() => []),
        publicStoreService.getCategoryItems().catch(() => []),
        publicStoreService.getSliders().catch(() => [])
      ]);
      if (Array.isArray(slidersList) && slidersList.length > 0) {
        setEcomSettings(prev => ({
          ...(prev || ({} as any)),
          heroBanners: slidersList
        }));
      }
      if (settings) {
        const mergedHeroBanners = (Array.isArray(slidersList) && slidersList.length > 0) 
          ? slidersList 
          : (settings.heroBanners && settings.heroBanners.length > 0 ? settings.heroBanners : undefined);
        if (mergedHeroBanners) {
          settings.heroBanners = mergedHeroBanners;
        }
        setEcomSettings(prev => ({ 
          ...(prev || {}), 
          ...settings, 
          ...(mergedHeroBanners ? { heroBanners: mergedHeroBanners } : {}) 
        }));
        if (Array.isArray(settings.categoryItems) && settings.categoryItems.length > 0) {
          setRealCategoryItems(settings.categoryItems);
        }
      }
      if (Array.isArray(catItems) && catItems.length > 0) {
        setRealCategoryItems(catItems);
        setRealCategories(catItems.map(c => c.name));
      }
      if (info) setInstituteInfo(info);
      if (Array.isArray(brandsList) && brandsList.length > 0) {
        setRealBrands(brandsList);
      }
    } catch (err) {
      console.warn('Failed loading storefront settings:', err);
    }
  };

  // Sync Live Products from backend Express API & dbService
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadLiveProducts = async () => {
    try {
      const pubProds = await publicStoreService.getProducts();
      if (Array.isArray(pubProds) && pubProds.length > 0) {
        const normalized = pubProds.map((p, idx) => normalizeStoreProduct(p, idx));
        setProducts(normalized);
        setActiveProductDetail(prev => {
          if (typeof window !== 'undefined' && window.location.pathname.startsWith('/product')) {
            const urlMatch = findProductFromPath(window.location.pathname, routeId, routeSlug, normalized);
            if (urlMatch) return urlMatch;
          }
          const match = normalized.find(p => p.id === prev?.id);
          return match || normalized[0] || BLANK_STORE_PRODUCT;
        });
        return;
      }
    } catch (err) {
      console.warn('Failed loading from publicStoreService:', err);
    }

    try {
      const dbProds = await dbService.getProducts();
      if (Array.isArray(dbProds)) {
        const normalized = dbProds.map((p, idx) => normalizeStoreProduct(p, idx));
        setProducts(normalized);
        setActiveProductDetail(prev => {
          if (typeof window !== 'undefined' && window.location.pathname.startsWith('/product')) {
            const urlMatch = findProductFromPath(window.location.pathname, routeId, routeSlug, normalized);
            if (urlMatch) return urlMatch;
          }
          const match = normalized.find(p => p.id === prev?.id);
          return match || normalized[0] || BLANK_STORE_PRODUCT;
        });
        return;
      }
    } catch (err) {
      console.warn('Failed loading from dbService:', err);
    }
  };

  const loadBestSellers = async () => {
    try {
      const res = await publicStoreService.getBestSellers();
      if (res && res.data) {
        const normalizeBestSeller = (p: any, idx: number): BestSellerStoreProduct => ({
          ...normalizeStoreProduct(p, idx),
          salesCount: Number(p.salesCount || 0)
        });

        const weekList = (res.data.week || []).map((p, i) => normalizeBestSeller(p, i));
        const monthList = (res.data.month || []).map((p, i) => normalizeBestSeller(p, i));
        const allList = (res.data.all || []).map((p, i) => normalizeBestSeller(p, i));
        const totalSales = Number(res.totalSales || 0);

        setBestSellers({
          week: weekList,
          month: monthList,
          all: allList,
          totalSales
        });

        if (weekList.length > 0) {
          setBestSellerPeriod('week');
        } else if (monthList.length > 0) {
          setBestSellerPeriod('month');
        } else if (allList.length > 0) {
          setBestSellerPeriod('all');
        }
      }
    } catch (err) {
      console.warn('Failed loading best sellers:', err);
    }
  };

  useEffect(() => {
    loadLiveProducts();
    loadLiveSettings();
    loadBestSellers();

    const handleProductUpdate = () => {
      loadLiveProducts();
      loadBestSellers();
    };
    const handleSettingsUpdate = () => {
      loadLiveSettings();
    };
    const handleOrdersUpdate = () => {
      loadBestSellers();
    };

    window.addEventListener('ecom-products-updated', handleProductUpdate);
    window.addEventListener('ecom-settings-updated', handleSettingsUpdate);
    window.addEventListener('institute-info-updated', handleSettingsUpdate);
    window.addEventListener('book-orders-updated', handleOrdersUpdate);
    window.addEventListener('storage', handleProductUpdate);
    return () => {
      window.removeEventListener('ecom-products-updated', handleProductUpdate);
      window.removeEventListener('ecom-settings-updated', handleSettingsUpdate);
      window.removeEventListener('institute-info-updated', handleSettingsUpdate);
      window.removeEventListener('book-orders-updated', handleOrdersUpdate);
      window.removeEventListener('storage', handleProductUpdate);
    };
  }, []);

  // General States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currency] = useState<'BDT'>('BDT');
  
  // Modals, Feedback Dialog & Drawers
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileCategorySheetOpen, setIsMobileCategorySheetOpen] = useState(false);
  const [cartReviewIndex, setCartReviewIndex] = useState(() => Math.floor(Math.random() * BANGLADESHI_FEMALE_CART_REVIEWS.length));

  // Pick a fresh random authentic Bangladeshi female review each time the cart drawer opens
  useEffect(() => {
    if (isCartOpen) {
      setCartReviewIndex(Math.floor(Math.random() * BANGLADESHI_FEMALE_CART_REVIEWS.length));
    }
  }, [isCartOpen]);
  const [showNotificationToast, setShowNotificationToast] = useState<{
    show: boolean;
    msg: string;
    type?: 'success' | 'error' | 'info';
  }>({ show: false, msg: '', type: 'success' });

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setShowNotificationToast({ show: true, msg, type });
    setTimeout(() => {
      setShowNotificationToast(prev => prev.msg === msg ? { show: false, msg: '', type: 'success' } : prev);
    }, 4500);
  }, []);

  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'info';
    title?: string;
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  // 10-Minute Cart Reservation Hold State
  const [reservationSeconds, setReservationSeconds] = useState<number>(600); // 10 mins

  // Top Header & Category States (Shopping Zone BD Design)
  const [isTrackOrderModalOpen, setIsTrackOrderModalOpen] = useState(false);
  const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [defaultSlideIndex, setDefaultSlideIndex] = useState(0);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Auto-rotate default slides
  useEffect(() => {
    const timer = setInterval(() => {
      setDefaultSlideIndex(prev => (prev === 0 ? 1 : 0));
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      categoryScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const collectionScrollRef = useRef<HTMLDivElement>(null);
  const scrollCollectionCards = (direction: 'left' | 'right') => {
    if (collectionScrollRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      collectionScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const clickedInsideDesktopSearch = searchContainerRef.current && searchContainerRef.current.contains(event.target as Node);
      const clickedInsideMobileSearch = mobileSearchContainerRef.current && mobileSearchContainerRef.current.contains(event.target as Node);
      if (!clickedInsideDesktopSearch && !clickedInsideMobileSearch) {
        setIsSearchDropdownOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dynamic Real Backend Categories for Horizontal Category Strip
  const shoppingCategories = useMemo(() => {
    if (Array.isArray(realCategoryItems) && realCategoryItems.length > 0) {
      return realCategoryItems.map(cat => {
        const catProds = (products || []).filter(p => (p.category || '').toLowerCase().trim() === cat.name.toLowerCase().trim());
        const catImg = cat.image || catProds[0]?.images?.[0] || catProds[0]?.image || '';
        return {
          id: cat.id || cat.name.toLowerCase().replace(/\s+/g, '-'),
          name: cat.name,
          rawName: cat.name,
          badge: `${catProds.length} ${catProds.length === 1 ? 'Product' : 'Products'}`,
          image: catImg,
          count: catProds.length
        };
      });
    }

    const categoryMap = new Map<string, { image?: string; count: number }>();
    (products || []).forEach(p => {
      const c = p.category?.trim();
      if (c) {
        if (!categoryMap.has(c)) {
          categoryMap.set(c, {
            image: p.images?.[0] || p.image,
            count: 1
          });
        } else {
          categoryMap.get(c)!.count += 1;
        }
      }
    });

    return Array.from(categoryMap.entries()).map(([catKey, data]) => ({
      id: catKey.toLowerCase().replace(/\s+/g, '-'),
      name: catKey,
      rawName: catKey,
      badge: `${data.count} ${data.count === 1 ? 'Product' : 'Products'}`,
      image: data.image,
      count: data.count
    }));
  }, [realCategoryItems, products]);

  // In-Memory Fast Search Index Instance
  const searchEngine = useMemo(() => new ProductSearchEngine(products), [products]);
  const searchOutput = useMemo(() => searchEngine.search(searchTerm), [searchEngine, searchTerm]);

  // Cart State (Zustand Global Store)
  const cart = useAppStore(state => state.cart);
  const addToCartAction = useAppStore(state => state.addToCart);
  const removeFromCartAction = useAppStore(state => state.removeFromCart);
  const updateQuantityAction = useAppStore(state => state.updateQuantity);
  const clearCartAction = useAppStore(state => state.clearCart);


  // Reservation Timer Countdown
  useEffect(() => {
    if (cart.length === 0) {
      setReservationSeconds(600);
      return;
    }

    const interval = setInterval(() => {
      setReservationSeconds(prev => {
        if (prev <= 1) {
          return 600; // auto-refresh hold
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cart.length]);

  // Contact Form State
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactCountryCode, setContactCountryCode] = useState('+880');
  const [contactSenderName, setContactSenderName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  // Dynamic Header Settings from Admin Panel (Matching User Design)
  const liveHeaderSettings = useMemo<HeaderSettings>(() => {
    return ecomSettings?.headerSettings || DEFAULT_HEADER_SETTINGS;
  }, [ecomSettings?.headerSettings]);

  // Dynamic Store & Footer Brand Details (From Admin Profile / Store Setup)
  const displayStoreName = ecomSettings?.storeName?.trim() || liveHeaderSettings?.brandName?.trim() || instituteInfo?.name?.trim() || 'Store';
  const displayStoreLogo = ecomSettings?.storeLogo?.trim() || liveHeaderSettings?.logoUrl?.trim() || instituteInfo?.logo?.trim() || '';
  const displayCompanyName = ecomSettings?.companyName || instituteInfo?.name || `${displayStoreName} Ltd.`;
  const displayTagline = ecomSettings?.storeTagline || ecomSettings?.footerDescription || instituteInfo?.description || '';
  const displayEmail = ecomSettings?.contactEmail || instituteInfo?.email || '';
  const displayPhone = ecomSettings?.contactPhone || instituteInfo?.phone || '';
  const displayAddress = ecomSettings?.storeAddress || instituteInfo?.address || '';
  const displayAnnouncement = ecomSettings?.topAnnouncementText || (displayStoreName ? `WELCOME TO ${displayStoreName.toUpperCase()}` : '');
  const socialLinks = ecomSettings?.socialLinks;
  const aboutSettings: AboutPageSettings = ecomSettings?.aboutSettings || DEFAULT_ABOUT_SETTINGS;

  const menuItemsToRender = useMemo(() => {
    // 1. Dynamic categories for Category dropdown
    const catList: string[] = [];
    const addCat = (c: any) => {
      const name = typeof c === "string" ? c.trim() : (typeof c?.name === "string" ? c.name.trim() : "");
      if (name && name !== "All" && !catList.includes(name)) {
        catList.push(name);
      }
    };

    if (Array.isArray(realCategories)) realCategories.forEach(addCat);
    if (Array.isArray(ecomSettings?.categories)) ecomSettings.categories.forEach(addCat);
    if (Array.isArray(products)) products.forEach(p => addCat(p.category));

    const categoryDropdown: any[] = [];
    if (realCategoryItems.length > 0) {
      realCategoryItems.forEach(catItem => {
        categoryDropdown.push({
          label: catItem.name,
          link: `/shop?category=${encodeURIComponent(catItem.name)}`,
          categoryName: catItem.name,
          isParent: true
        });
        (catItem.subcategories || []).forEach(sub => {
          categoryDropdown.push({
            label: sub.name,
            subLabel: sub.name,
            parentName: catItem.name,
            link: `/shop?category=${encodeURIComponent(catItem.name)}&subcategory=${encodeURIComponent(sub.name)}`,
            categoryName: catItem.name,
            subcategoryName: sub.name,
            isSubcategory: true
          });
        });
      });
    } else {
      catList.forEach(cat => {
        categoryDropdown.push({
          label: cat,
          link: "/shop?category=" + encodeURIComponent(cat),
          categoryName: cat
        });
      });
    }

    // 2. Dynamic collections for Collection dropdown
    const rawCols = ecomSettings?.featuredCollections;
    const activeCols = (Array.isArray(rawCols) && rawCols.length > 0)
      ? rawCols.filter(c => c.enabled !== false)
      : [];

    const collectionDropdown = activeCols.length > 0
      ? activeCols.map(c => ({
          label: c.title,
          link: `/collections/${encodeURIComponent(c.id)}`,
          collectionId: c.id
        }))
      : [
          { label: "Winter Collection", link: "/collections", collectionId: "winter" },
          { label: "Mega Offer", link: "/collections", collectionId: "mega" },
          { label: "Summer Collection", link: "/collections", collectionId: "summer" }
        ];

    return [
      { id: "menu-home", label: "Home", link: "/", hasDropdown: false },
      { 
        id: "menu-category", 
        label: "Category", 
        link: "/shop", 
        hasDropdown: categoryDropdown.length > 0,
        dropdownItems: categoryDropdown
      },
      { 
        id: "menu-collection", 
        label: "Collection", 
        link: "/collections", 
        hasDropdown: collectionDropdown.length > 0,
        dropdownItems: collectionDropdown
      },
      { id: "menu-about", label: "About", link: "/about", hasDropdown: false },
      { id: "menu-contact", label: "Contact", link: "/contact", hasDropdown: false }
    ];
  }, [ecomSettings?.categories, ecomSettings?.featuredCollections, realCategories, realCategoryItems, products]);

  // Dynamically derived social links directly from Admin Panel (Profile Settings & Header Settings)
  const activeSocialLinks = useMemo(() => {
    const src = {
      ...(ecomSettings?.socialLinks || {}),
      ...(liveHeaderSettings?.socialLinks || {})
    };
    return {
      facebook: (src.facebook || '').trim(),
      instagram: (src.instagram || '').trim(),
      youtube: (src.youtube || '').trim(),
      twitter: (src.twitter || '').trim(),
      tiktok: (src.tiktok || '').trim(),
      linkedin: (src.linkedin || '').trim(),
      whatsapp: (src.whatsapp || '').trim()
    };
  }, [ecomSettings?.socialLinks, liveHeaderSettings?.socialLinks]);

  const hasValidLink = useCallback((url?: string) => {
    return Boolean(url && url.trim() && url.trim() !== '#' && url.trim() !== '/');
  }, []);

  const headerEmail = (liveHeaderSettings.email || displayEmail || '').trim();
  const headerPhone = (liveHeaderSettings.phone || displayPhone || '').trim();

  // Dynamic Hero Banners for Slider (Driven by Admin Panel & /api/sliders)
  const activeHeroBanners = useMemo<HeroBannerItem[]>(() => {
    if (ecomSettings?.heroBanners && ecomSettings.heroBanners.length > 0) {
      return ecomSettings.heroBanners;
    }
    const cached = readStorefrontCache<HeroBannerItem[]>('noor_sliders', []);
    if (cached && cached.length > 0) {
      return cached;
    }
    return [];
  }, [ecomSettings?.heroBanners]);

  const [isSliderPaused, setIsSliderPaused] = useState<boolean>(false);

  // Slider Autoplay Effect with dynamic interval per slide (supports video + image slides)
  useEffect(() => {
    if (isSliderPaused || activeHeroBanners.length <= 1) return;

    const currentBanner = activeHeroBanners[activeSlideIndex];
    const isVideo = currentBanner?.mediaType === 'video';
    const customSec = currentBanner?.durationSeconds;
    const defaultVideoSec = ecomSettings?.heroVideoInterval || 10;
    const defaultImageSec = ecomSettings?.heroSliderInterval || 5;
    const durationMs = (customSec || (isVideo ? defaultVideoSec : defaultImageSec)) * 1000;

    const interval = setInterval(() => {
      setActiveSlideIndex(prev => (prev + 1) % activeHeroBanners.length);
    }, durationMs);

    return () => clearInterval(interval);
  }, [isSliderPaused, activeHeroBanners.length, activeSlideIndex, activeHeroBanners, ecomSettings?.heroSliderInterval, ecomSettings?.heroVideoInterval]);

  const handleVideoEnded = useCallback(() => {
    if (activeHeroBanners.length > 1) {
      setActiveSlideIndex(prev => (prev + 1) % activeHeroBanners.length);
    }
  }, [activeHeroBanners.length]);

  // Dynamic Curated Collections directly from Admin Panel (Featured Collections)
  const curatedCollections = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      subtitle: string;
      badge: string;
      image: string;
      itemCount: number;
      actionUrl?: string;
      productIds?: string[];
      category?: string;
    }> = [];

    // Strictly load real collections configured in Admin Panel (No fake static fallback)
    const adminCols = (ecomSettings?.featuredCollections || []).filter(c => c.enabled !== false);
    adminCols.forEach(col => {
      const colProds = (products || []).filter(p => (col.productIds || []).includes(p.id));
      list.push({
        id: col.id,
        title: col.title,
        subtitle: col.subtitle || `${colProds.length} ${colProds.length === 1 ? 'Item' : 'Items'}`,
        badge: col.badge || 'SEASON SPECIAL',
        image: col.image || colProds[0]?.images?.[0] || colProds[0]?.image || '',
        itemCount: colProds.length,
        productIds: col.productIds
      });
    });

    return list;
  }, [ecomSettings?.featuredCollections, products]);

  // Display Brands for "OUR BRANDS" Section
  const DISPLAY_BRANDS = useMemo(() => {
    const baseBrands = [
      {
        name: 'Purple',
        icon: (
          <div className="w-12 h-12 rounded-full border-2 border-purple-700 flex items-center justify-center">
            <span className="font-serif italic font-bold text-xl text-purple-700">P</span>
          </div>
        )
      },
      {
        name: 'Shopping Zone BD LTD',
        icon: (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-green-300">
            <ShoppingBag className="w-4 h-4 text-green-600 shrink-0" />
            <span className="font-black text-[10px] text-green-700 tracking-tighter uppercase leading-none">
              SHOPPING ZONE BD
            </span>
          </div>
        )
      },
      {
        name: 'Style Different',
        icon: (
          <div className="flex items-center gap-1 text-center">
            <div className="text-green-600 font-black text-xl leading-none">SD</div>
            <div className="text-[7px] text-teal-600 font-bold uppercase leading-tight">STYLE<br/>DIFFERENT</div>
          </div>
        )
      },
      {
        name: 'Shoppingzone BD Co.',
        icon: (
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-green-400 p-0.5 flex items-center justify-center text-center">
            <span className="text-[7px] font-black text-green-700 uppercase leading-none">SZ BD<br/>CO.</span>
          </div>
        )
      },
      {
        name: 'Asmi Supershop',
        icon: (
          <div className="flex items-center gap-0.5">
            <span className="text-teal-600 font-black text-xl tracking-tighter">A<span className="text-green-600">.</span>SMI</span>
          </div>
        )
      }
    ];
    if (realBrands && realBrands.length > 0) {
      return [...realBrands.map(b => ({ name: b.name, logo: b.logo })), ...baseBrands];
    }
    return baseBrands;
  }, [realBrands]);

  // Real Backend Categories with their actual live products (Dynamic, No Fake Static Data)
  const backendCategorySections = useMemo(() => {
    const map = new Map<string, Product[]>();
    (products || []).forEach(p => {
      const cat = p.category?.trim();
      if (cat) {
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat)!.push(p);
      }
    });

    const meta: Record<string, { title: string; subtitle: string }> = {
      'Womens': { title: "WOMEN'S CLOTHING", subtitle: "Women's Fashion & Sarees" },
      'Kids Fashion': { title: "KIDS FASHION", subtitle: "Children's Outfits & Frocks" },
      'Hijab': { title: "HIJAB & MODEST WEAR", subtitle: "Modest Collection & Abayas" },
      'Bag': { title: "LADIES BAGS", subtitle: "Luxury Handbags & Clutches" },
      'Boys': { title: "BOYS COLLECTION", subtitle: "Boys Outfits & T-Shirts" }
    };

    const result: Array<{
      categoryName: string;
      title: string;
      subtitle: string;
      products: Product[];
    }> = [];

    map.forEach((prodList, catName) => {
      if (prodList.length > 0) {
        const info = meta[catName] || {
          title: catName.toUpperCase(),
          subtitle: `${prodList.length} ${prodList.length === 1 ? 'Product' : 'Products'}`
        };
        result.push({
          categoryName: catName,
          title: info.title,
          subtitle: info.subtitle,
          products: prodList
        });
      }
    });

    return result;
  }, [products]);

  // Featured Products list for horizontal auto-scroll
  const featuredProductsList = useMemo(() => {
    const feat = (products || []).filter(p => p.isFeatured);
    return feat.length > 0 ? feat : (products || []).slice(0, 10);
  }, [products]);

  // Hero Video Sound State & Control
  const [isHeroMuted, setIsHeroMuted] = useState(true);
  const heroVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const toggleHeroSound = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHeroMuted(prev => {
      const nextMuted = !prev;
      const currentBanner = activeHeroBanners[activeSlideIndex];
      const videoKey = currentBanner?.id || String(activeSlideIndex);
      const vidEl = heroVideoRefs.current[videoKey];
      if (vidEl) {
        vidEl.muted = nextMuted;
        if (!nextMuted) {
          vidEl.play().catch(() => {});
        }
      }
      return nextMuted;
    });
  }, [activeHeroBanners, activeSlideIndex]);

  const handlePrevSlide = () => {
    setActiveSlideIndex(prev => (prev - 1 + activeHeroBanners.length) % activeHeroBanners.length);
  };

  const handleNextSlide = () => {
    setActiveSlideIndex(prev => (prev + 1) % activeHeroBanners.length);
  };

  // Factory Direct Quote Modal State
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    fullName: '',
    company: '',
    email: '',
    phone: '',
    quantity: '100,000 Pcs',
    message: ''
  });

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteForm.fullName.trim() || !quoteForm.email.trim() || !quoteForm.phone.trim()) {
      showToast('Please fill in your name, email, and phone/WhatsApp.', 'error');
      return;
    }
    setIsSubmittingQuote(true);
    try {
      await dbService.saveContactMessage({
        id: `quote-${Date.now()}`,
        name: quoteForm.fullName,
        email: quoteForm.email,
        phone: quoteForm.phone,
        subject: `[Customer Inquiry] ${quoteForm.company || quoteForm.fullName} (${quoteForm.quantity || 'General'})`,
        message: `Customer: ${quoteForm.fullName}\nCompany/Notes: ${quoteForm.company}\nDetails/Quantity: ${quoteForm.quantity}\nRequirements:\n${quoteForm.message}`,
        createdAt: new Date().toISOString(),
        status: 'unread'
      });
      setQuoteSubmitted(true);
      showToast('Quote request submitted successfully!', 'success');
    } catch {
      showToast('Failed to submit quote request. Please try WhatsApp.', 'error');
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  // Dynamic Flash Sale Countdown Hook
  const flashSaleConfig = ecomSettings?.flashSale;
  const [flashSaleTimeLeft, setFlashSaleTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTime = () => {
      const endDateStr = flashSaleConfig?.endDate;
      if (!endDateStr) {
        setFlashSaleTimeLeft({ days: 6, hours: 23, minutes: 59, seconds: 59 });
        return;
      }
      const diff = +new Date(endDateStr) - +new Date();
      if (diff > 0) {
        setFlashSaleTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
          seconds: Math.floor((diff / 1000) % 60)
        });
      } else {
        setFlashSaleTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [flashSaleConfig?.endDate]);

  // Dynamic Favicon and Document Title Sync
  useEffect(() => {
    // If admin set custom store logo in Profile, keep favicon in sync; otherwise fallback to /favicon/favicon.ico
    const currentFavicon = displayStoreLogo || '/favicon/favicon.ico';
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = currentFavicon;

    if (displayStoreName) {
      updateMetaTags(
        `${displayStoreName} | Official Store`, 
        aboutSettings?.description || 'Welcome to our official store', 
        displayStoreLogo || '/favicon/android-chrome-512x512.png', 
        window.location.href
      );
    }
  }, [displayStoreLogo, displayStoreName, aboutSettings?.description]);

  // Dynamic SEO based on active view
  useEffect(() => {
    if (activeNav === 'product_detail' && activeProductDetail) {
      updateMetaTags(
        `${activeProductDetail.title} | ${displayStoreName}`,
        activeProductDetail.subtitle || activeProductDetail.description || 'View product details and clinical formulation.',
        activeProductDetail.coverImage || activeProductDetail.image,
        window.location.href
      );
      updateProductSchema(activeProductDetail, window.location.href, displayStoreName);

      // Track ViewContent for Meta Pixel & GTM
      const eventId = createEventId('view');
      trackEvent('ViewContent', {
        content_name: activeProductDetail.title,
        content_ids: [activeProductDetail.id],
        content_type: 'product',
        value: activeProductDetail.price,
        currency: 'BDT'
      }, eventId);
    } else if (activeNav === 'shop') {
      updateMetaTags(
        `Shop All Products | ${displayStoreName}`,
        aboutSettings?.description || `Browse our complete product catalog at ${displayStoreName}.`,
        displayStoreLogo,
        window.location.href
      );
      updateProductSchema(null, window.location.href, displayStoreName);
    } else if (activeNav === 'about') {
      updateMetaTags(
        aboutSettings?.pageTitle || `About Us | ${displayStoreName}`,
        aboutSettings?.subtitle || aboutSettings?.description || `Learn about ${displayStoreName}, our facility, mission, and manufacturing standards.`,
        displayStoreLogo,
        window.location.href
      );
      updateProductSchema(null, window.location.href, displayStoreName);
    } else if (activeNav === 'contact') {
      updateMetaTags(
        `Contact Us & Customer Support | ${displayStoreName}`,
        'Get in touch with our customer care team via WhatsApp, phone, or email.',
        displayStoreLogo,
        window.location.href
      );
      updateProductSchema(null, window.location.href, displayStoreName);
    } else if (activeNav === 'checkout') {
      updateMetaTags(
        `Secure Checkout | ${displayStoreName}`,
        'Complete your order with Fast Delivery & Cash on Delivery across Bangladesh.',
        displayStoreLogo,
        window.location.href
      );
      updateProductSchema(null, window.location.href, displayStoreName);
    } else if (activeNav === 'collections') {
      updateMetaTags(
        `Curated Collections | ${displayStoreName}`,
        'Discover our exclusive seasonal edits and designer fashion collections.',
        displayStoreLogo,
        window.location.href
      );
      updateProductSchema(null, window.location.href, displayStoreName);
    } else if (activeNav === 'home') {
      updateMetaTags(
        `${displayStoreName} | Official Store`,
        aboutSettings?.description || 'Welcome to our official store',
        displayStoreLogo,
        window.location.href
      );
      updateProductSchema(null, window.location.href, displayStoreName);
    }
  }, [activeNav, activeProductDetail, displayStoreName, displayStoreLogo, aboutSettings?.description, aboutSettings?.subtitle]);

  // Track Search event on search query input (debounced)
  useEffect(() => {
    const q = searchTerm.trim();
    if (!q || q.length < 2) return;
    const timer = setTimeout(() => {
      trackEvent('Search', { search_string: q });
    }, 1200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Transparent Header on initial top view, solid white on scroll
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isTransparentHeader = false;

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Central Router Navigation Helper (Syncs Browser URL with SPA Views)
  const navigateTo = useCallback((section: 'home' | 'shop' | 'about' | 'contact' | 'checkout' | 'collections') => {
    setIsMobileMenuOpen(false);
    const targetPath = section === 'home' ? '/' : `/${section}`;
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
    setActiveNav(section);
    scrollToTop();
  }, [location.pathname, navigate, scrollToTop]);

  // Sync React Router pathname with active store view & product
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/product')) {
      const found = findProductFromPath(path, routeId, routeSlug, products);
      if (found) {
        setActiveProductDetail(found);
        setActiveNav('product_detail');
      } else if (products.length > 0) {
        setActiveProductDetail(products[0]);
        setActiveNav('product_detail');
      }
    } else if (path.startsWith('/collections') || path.startsWith('/collection')) {
      const match = path.match(/^\/collections?\/([^/]+)/);
      if (match && match[1]) {
        setActiveCollectionId(decodeURIComponent(match[1]));
      } else {
        setActiveCollectionId('');
      }
      setActiveNav('collections');
    } else if (path.startsWith('/shop')) {
      const searchParams = new URLSearchParams(location.search);
      const catParam = searchParams.get('category');
      const subParam = searchParams.get('subcategory');
      if (catParam) setSelectedCategoryCheckbox(catParam);
      if (subParam) setSelectedSubcategory(subParam);
      setActiveNav('shop');
    } else if (path.startsWith('/about')) {
      setActiveNav('about');
    } else if (path.startsWith('/contact')) {
      setActiveNav('contact');
    } else if (path.startsWith('/checkout')) {
      setActiveNav('checkout');
    } else if (path.startsWith('/blog') || path.startsWith('/blogs') || path.startsWith('/news') || path.startsWith('/membership') || path.startsWith('/vip')) {
      navigate('/');
      setActiveNav('home');
    } else if (path === '/' || path === '') {
      setActiveNav('home');
    }
  }, [location.pathname, routeId, routeSlug, products, findProductFromPath, navigate]);

  // Bangladeshi Taka BDT Currency Formatter (Exclusive)
  const formatPrice = (priceVal: number) => {
    if (!priceVal && priceVal !== 0) return 'Tk.0';
    const bdtAmount = Math.round(priceVal);
    return `Tk.${bdtAmount.toLocaleString('en-US')}`;
  };

  // Add to Cart Helper
  const handleAddToCart = useCallback((product: Product, quantity = 1, variant?: any) => {
    const eventId = createEventId('cart');
    const finalPrice = variant?.price || product.price || 0;
    trackEvent('AddToCart', {
      content_name: product.title,
      content_ids: [product.id],
      content_type: 'product',
      value: finalPrice * quantity,
      currency: 'BDT',
      num_items: quantity,
      contents: [{
        id: product.id,
        name: product.title,
        quantity: quantity,
        item_price: finalPrice
      }]
    }, eventId);
    addToCartAction({
      product,
      quantity,
      variant,
      selectedVariant: variant?.name
    });
    showToast(`Added ${product.title}${variant ? ` (${variant.name})` : ''} to your bag.`, 'success');
  }, [addToCartAction, showToast]);

  const handleRemoveFromCart = useCallback((productId: string) => {
    removeFromCartAction(productId);
  }, [removeFromCartAction]);

  const handleUpdateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCartAction(productId);
      return;
    }
    updateQuantityAction(productId, quantity);
  }, [removeFromCartAction, updateQuantityAction]);

  // Open Full Product Detail Page with dynamic SEO deep-link URL
  const openProductDetail = useCallback((product: StoreProductItem) => {
    setActiveProductDetail(product);
    setActiveVariant(product.variants && product.variants.length > 0 ? product.variants[0] : null);
    setActiveImageIndex(0);
    setDetailQuantity(1);
    setIsCodeCopied(false);
    setActiveNav('product_detail');
    const slug = getProductSlug(product);
    navigate(`/product/${encodeURIComponent(slug)}/${encodeURIComponent(product.id)}`);
    scrollToTop();
  }, [navigate, scrollToTop]);

  // Cart Subtotal
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  }, [cart]);

  const totalCartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Real "You May Also Like" Products in Cart Drawer (Excludes items already in cart)
  const cartUpsellProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    const inCartIds = new Set(cart.map(item => item.product.id));
    const unadded = products.filter(p => !inCartIds.has(p.id));
    if (unadded.length > 0) return unadded;
    return products.slice(0, 4);
  }, [products, cart]);

  // Filtered & Sorted Catalog for Shop Page
  const filteredCatalog = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !searchTerm.trim() || 
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategoryCheckbox === 'All' || 
        p.category?.toLowerCase() === selectedCategoryCheckbox.toLowerCase() || 
        p.series?.toLowerCase() === selectedCategoryCheckbox.toLowerCase();
        
      const matchesSubcategory = selectedSubcategory === 'All' || (() => {
        const targetSub = selectedSubcategory.toLowerCase().trim();
        const prodSub = (p.subCategory || (p as any).subcategory || '').toLowerCase().trim();
        const prodTitle = (p.title || '').toLowerCase();
        return prodSub === targetSub || prodTitle.includes(targetSub);
      })();

      const matchesBrand = selectedBrand === 'All' || 
        p.brand === selectedBrand;
        
      const matchesPrice = p.price <= priceRange;

      return matchesSearch && matchesCategory && matchesSubcategory && matchesBrand && matchesPrice;
    }).sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      return 0;
    });
  }, [products, searchTerm, selectedCategoryCheckbox, selectedSubcategory, selectedBrand, priceRange, sortBy]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCatalog.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCatalog, currentPage]);

  // Real Categories from API / settings / products
  const shopCategories = useMemo(() => {
    const list: string[] = [];
    const add = (name?: string) => {
      const trimmed = (name || '').trim();
      if (trimmed && trimmed !== 'All' && !list.includes(trimmed)) {
        list.push(trimmed);
      }
    };
    if (Array.isArray(realCategoryItems) && realCategoryItems.length > 0) {
      realCategoryItems.forEach(c => add(c.name));
    }
    if (Array.isArray(realCategories)) realCategories.forEach((c: any) => add(typeof c === 'string' ? c : c?.name));
    if (Array.isArray(ecomSettings?.categories)) ecomSettings.categories.forEach((c: any) => add(typeof c === 'string' ? c : c?.name));
    if (Array.isArray(products)) products.forEach(p => add(p.category));
    return list;
  }, [realCategoryItems, realCategories, ecomSettings?.categories, products]);

  // Active Category Item object with its subcategories
  const activeCategoryItem = useMemo(() => {
    if (selectedCategoryCheckbox === 'All') return null;
    return realCategoryItems.find(
      c => c.name?.toLowerCase().trim() === selectedCategoryCheckbox.toLowerCase().trim()
    );
  }, [realCategoryItems, selectedCategoryCheckbox]);

  // Subcategories for current category (or all available subcategories)
  const availableSubcategories = useMemo(() => {
    if (activeCategoryItem) {
      return (activeCategoryItem.subcategories || []).map(s => ({
        name: s.name,
        categoryName: activeCategoryItem.name
      }));
    }
    // If "All" categories is selected, extract all subcategories across categories
    const allSubs: { name: string; categoryName: string }[] = [];
    realCategoryItems.forEach(c => {
      (c.subcategories || []).forEach(s => {
        if (s.name && !allSubs.some(existing => existing.name.toLowerCase() === s.name.toLowerCase())) {
          allSubs.push({ name: s.name, categoryName: c.name });
        }
      });
    });
    return allSubs;
  }, [activeCategoryItem, realCategoryItems]);

  // Real Brands from API (if no real brands exist in /api/brands, empty array)
  const shopBrands = useMemo(() => {
    const list: string[] = [];
    if (realBrands && realBrands.length > 0) {
      realBrands.forEach(b => {
        const name = (b.name || '').trim();
        if (name && !list.includes(name)) {
          list.push(name);
        }
      });
    }
    return list;
  }, [realBrands]);

  const totalPages = Math.ceil(filteredCatalog.length / itemsPerPage) || 1;

  const cartTotalWeight = useMemo(() => {
    return calculateCartTotalWeight(cart);
  }, [cart]);

  // Active Delivery Methods from Admin Settings
  const activeDeliveryMethods = useMemo<DeliveryMethodItem[]>(() => {
    const list = Array.isArray(ecomSettings?.deliveryMethods) ? ecomSettings.deliveryMethods : [];
    return list.filter(m => m.status === 'Active');
  }, [ecomSettings?.deliveryMethods]);

  const [selectedDeliveryMethodId, setSelectedDeliveryMethodId] = useState<string>('');

  useEffect(() => {
    if (activeDeliveryMethods.length > 0) {
      if (!selectedDeliveryMethodId || !activeDeliveryMethods.some(m => m.id === selectedDeliveryMethodId)) {
        setSelectedDeliveryMethodId(activeDeliveryMethods[0].id);
      }
    } else {
      setSelectedDeliveryMethodId('');
    }
  }, [activeDeliveryMethods, selectedDeliveryMethodId]);

  const selectedDeliveryMethod = useMemo(() => {
    if (activeDeliveryMethods.length === 0) return null;
    return activeDeliveryMethods.find(m => m.id === selectedDeliveryMethodId) || activeDeliveryMethods[0] || null;
  }, [activeDeliveryMethods, selectedDeliveryMethodId]);

  const deliveryCalc = useMemo(() => {
    if (!selectedDeliveryMethod) {
      return { finalCharge: 0 };
    }
    return calculateDeliveryCharge(selectedDeliveryMethod, cartSubtotal, cartTotalWeight);
  }, [selectedDeliveryMethod, cartSubtotal, cartTotalWeight]);

  const deliveryCharge = selectedDeliveryMethod ? deliveryCalc.finalCharge : 0;

  // Active Payment Gateways from Admin Settings
  const activePaymentGateways = useMemo<PaymentGatewayItem[]>(() => {
    let gateways = ecomSettings?.paymentGateways;
    if (!gateways || gateways.length === 0) {
      gateways = DEFAULT_PAYMENT_GATEWAYS;
    }
    const filtered = gateways.filter(g => 
      !g.title?.toLowerCase().includes('credit') &&
      !g.title?.toLowerCase().includes('debit') &&
      !g.title?.toLowerCase().includes('stripe') &&
      !g.type?.toLowerCase().includes('card')
    );
    const validGateways = filtered.length > 0 ? filtered : DEFAULT_PAYMENT_GATEWAYS;
    const active = validGateways.filter(g => g.status === 'Active');
    return active.length > 0 ? active : validGateways;
  }, [ecomSettings?.paymentGateways]);

  const [selectedPaymentGatewayId, setSelectedPaymentGatewayId] = useState<string>('');
  const [trxId, setTrxId] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [copiedAccNo, setCopiedAccNo] = useState(false);

  useEffect(() => {
    if (activePaymentGateways.length > 0) {
      if (!selectedPaymentGatewayId || !activePaymentGateways.some(g => g.id === selectedPaymentGatewayId)) {
        setSelectedPaymentGatewayId(activePaymentGateways[0].id);
      }
    }
  }, [activePaymentGateways, selectedPaymentGatewayId]);

  const selectedPaymentGateway = useMemo(() => {
    return activePaymentGateways.find(g => g.id === selectedPaymentGatewayId) || activePaymentGateways[0];
  }, [activePaymentGateways, selectedPaymentGatewayId]);

  const isOnlinePayment = selectedPaymentGateway && 
    selectedPaymentGateway.type !== 'Cash on Delivery' && 
    selectedPaymentGateway.type !== 'COD' &&
    !selectedPaymentGateway.title.toLowerCase().includes('cash on delivery') &&
    !selectedPaymentGateway.title.toLowerCase().includes('Cash on');

  // Coupon State & Calculation
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim()) return;
    setIsApplyingCoupon(true);
    setCouponError('');
    setCouponSuccess('');
    try {
      const coupons = await dbService.getCoupons();
      const match = coupons.find(c => c.code.toLowerCase() === couponCodeInput.trim().toLowerCase() && c.status === 'Active');
      if (!match) {
        setCouponError('Invalid or expired coupon code');
        return;
      }
      if (match.minSpent && cartSubtotal < match.minSpent) {
        setCouponError(`Minimum to use this coupon ${formatPrice(match.minSpent)} Must order money`);
        return;
      }
      setAppliedCoupon(match);
      setCouponSuccess(`coupon "${match.code}" successfulhas been applied!`);
      setCouponCodeInput('');
    } catch {
      setCouponError('There was a problem validating the coupon');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponSuccess('');
    setCouponError('');
  };

  const couponDiscountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percent') {
      const disc = Math.round((cartSubtotal * appliedCoupon.discount) / 100);
      return appliedCoupon.maxDiscount ? Math.min(disc, appliedCoupon.maxDiscount) : disc;
    }
    return Math.min(appliedCoupon.discount, cartSubtotal);
  }, [appliedCoupon, cartSubtotal]);

  const gatewayDiscount = selectedPaymentGateway?.discountAmount ? Number(selectedPaymentGateway.discountAmount) : 0;
  const gatewayFee = selectedPaymentGateway?.transactionFee ? Number(selectedPaymentGateway.transactionFee) : 0;
  const cartGrandTotal = Math.max(0, cartSubtotal + deliveryCharge + gatewayFee - gatewayDiscount - couponDiscountAmount);

  // Checkout Form
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<BookOrder | null>(null);

  const handleCopyAccountNumber = (acc: string) => {
    navigator.clipboard.writeText(acc);
    setCopiedAccNo(true);
    setTimeout(() => setCopiedAccNo(false), 2000);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    // Strict validation against fake/dummy names, non-BD phones, and incomplete addresses
    const validation = validateOrderCustomerDetails({
      customerName: checkoutName,
      phone: checkoutPhone,
      address: checkoutAddress
    });

    if (!validation.isValid) {
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Please provide valid details',
        message: validation.errors[0]
      });
      showToast(validation.errors[0], 'error');
      return;
    }

    const cleanCustomerName = validation.sanitized.name;
    const cleanPhone = validation.sanitized.phone;
    const cleanAddress = validation.sanitized.address;

    if (cart.length === 0) {
      setFeedback({
        isOpen: true,
        type: 'info',
        title: 'Shopping Bag Is Empty',
        message: 'Your shopping bag is empty. Please add items before checking out.'
      });
      showToast('Your shopping bag is empty.', 'info');
      return;
    }

    if (isOnlinePayment && (!senderPhone.trim() || !trxId.trim())) {
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Payment Details Required',
        message: `Please provide your ${selectedPaymentGateway?.title || 'bKash/Nagad'} sender mobile number and Transaction ID (TrxID).`
      });
      showToast('Please provide your sender number and TrxID.', 'error');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const orderId = `ORD-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const orderPayload: BookOrder = {
        id: orderId,
        customerName: cleanCustomerName,
        name: cleanCustomerName,
        phone: cleanPhone,
        address: cleanAddress,
        deliveryArea: selectedDeliveryMethod?.title || 'Standard Delivery',
        deliveryZone: selectedDeliveryMethod?.title || 'Standard Delivery',
        district: selectedDeliveryMethod?.title || 'Dhaka',
        deliveryCharge: deliveryCharge,
        price: cartSubtotal,
        unitPrice: cart.length === 1 ? cart[0].product.price : cartSubtotal,
        totalAmount: cartGrandTotal,
        totalPrice: cartGrandTotal,
        productName: cart.map(i => `${i.product.title} (x${i.quantity})`).join(', '),
        productTitle: cart.map(i => `${i.product.title} (x${i.quantity})`).join(', '),
        status: 'Pending',
        orderType: 'storefront',
        paymentMethod: selectedPaymentGateway?.title || 'COD',
        paymentGateway: selectedPaymentGateway?.title || 'COD',
        senderPhone: isOnlinePayment ? senderPhone.trim() : undefined,
        trxId: isOnlinePayment ? trxId.trim() : undefined,
        couponCode: appliedCoupon?.code,
        couponDiscount: couponDiscountAmount > 0 ? couponDiscountAmount : undefined,
        quantity: cart.reduce((acc, i) => acc + i.quantity, 0),
        createdAt: new Date().toISOString(),
        orderDate: new Date().toISOString(),
        items: cart.map(i => ({
          product: {
            id: i.product.id,
            title: i.product.title,
            price: i.product.price,
            regularPrice: i.product.regularPrice,
            image: i.product.coverImage,
            category: i.product.category,
            stock: i.product.stock || 100,
            isAvailable: true
          },
          quantity: i.quantity
        }))
      };

      // 1. Try Authoritative Server-Side Atomic Checkout first
      let confirmedOrder: BookOrder = orderPayload;
      let orderCreatedViaServer = false;

      try {
        const response = await fetch('/api/orders/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: checkoutName.trim(),
            phone: checkoutPhone.trim(),
            address: checkoutAddress.trim(),
            testEventCode: (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('meta_test_code') : undefined) || undefined,
            deliveryZone: selectedDeliveryMethod?.title || 'Standard Delivery',
            deliveryMethodId: selectedDeliveryMethod?.id,
            deliveryCharge: deliveryCharge,
            deliveryFee: deliveryCharge,
            paymentMethod: selectedPaymentGateway?.title || 'Cash on Delivery',
            senderPhone: isOnlinePayment ? senderPhone.trim() : undefined,
            trxId: isOnlinePayment ? trxId.trim() : undefined,
            couponCode: appliedCoupon?.code,
            items: cart.map(i => ({
              productId: i.product.id,
              quantity: i.quantity,
              price: i.product.price,
              regularPrice: i.product.regularPrice,
              title: i.product.title
            }))
          })
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData?.order) {
            confirmedOrder = resData.order;
            orderCreatedViaServer = true;
          }
        }
      } catch {
        // Fallback to direct client DB service if offline/standalone
      }

      // 2. Fallback / Sync to Local & Firestore DB
      if (!orderCreatedViaServer) {
        await dbService.addBookOrder(orderPayload);
      } else {
        await dbService.saveBookOrderLocally(confirmedOrder);
      }

      // Track Purchase event before clearing cart
      const purchaseEventId = createEventId('purchase');
      const totalItemsPurchased = cart.reduce((acc, item) => acc + item.quantity, 0);
      trackEvent('Purchase', {
        content_name: cart.map(i => i.product.title).join(', '),
        content_ids: cart.map(i => i.product.id),
        content_type: 'product',
        value: cartGrandTotal || cartSubtotal,
        currency: 'BDT',
        num_items: totalItemsPurchased,
        contents: cart.map(item => ({
          id: item.product.id,
          name: item.product.title,
          quantity: item.quantity,
          item_price: item.product.price
        }))
      }, purchaseEventId);

      setOrderSuccess(confirmedOrder);
      clearCartAction();
      setIsCartOpen(false);
      setCheckoutName('');
      setCheckoutPhone('');
      setCheckoutAddress('');
      setTrxId('');
      setSenderPhone('');
      setAppliedCoupon(null);
    } catch (err) {
      console.error('Order error:', err);
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Order Processing Failed',
        message: 'There was a problem processing your order. Please try again or contact us directly on WhatsApp.'
      });
      showToast('Order processing failed. Please try again.', 'error');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = `${contactFirstName} ${contactLastName}`.trim() || contactSenderName.trim() || 'Valued Customer';
    const fullPhone = contactPhone.trim() ? `${contactCountryCode} ${contactPhone.trim()}` : '';

    if (!contactEmail.trim()) {
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Email Address Required',
        message: 'Please enter your email address so our customer care team can respond to your inquiry.'
      });
      showToast('Please enter your email address.', 'error');
      return;
    }

    try {
      setIsSubmittingContact(true);
      await dbService.saveContactMessage({
        name: fullName,
        email: contactEmail.trim(),
        phone: fullPhone,
        subject: contactSubject.trim() || 'General Customer Inquiry',
        message: contactMessage.trim(),
        createdAt: new Date().toISOString(),
        status: 'unread'
      });

      setContactSubmitted(true);
      trackEvent('Contact', { content_name: 'Customer Contact Form' });
      setContactFirstName('');
      setContactLastName('');
      setContactSenderName('');
      setContactEmail('');
      setContactPhone('');
      setContactSubject('');
      setContactMessage('');
      const successMsg = `Thank you! Your message has been received and forwarded to ${displayCompanyName}. Our customer service team will get back to you shortly.`;
      setFeedback({
        isOpen: true,
        type: 'success',
        title: 'Message Sent Successfully',
        message: successMsg
      });
      showToast(`Thank you! Your message has been received.`, 'success');
    } catch (err) {
      console.error('Error submitting contact form to dbService:', err);
      try {
        await publicStoreService.submitContactMessage({
          name: fullName,
          email: contactEmail.trim(),
          phone: fullPhone,
          subject: contactSubject.trim() || 'General Customer Inquiry',
          message: contactMessage.trim()
        });
      } catch {}
      setContactSubmitted(true);
      setContactFirstName('');
      setContactLastName('');
      setContactSenderName('');
      setContactEmail('');
      setContactPhone('');
      setContactSubject('');
      setContactMessage('');
      const fallbackMsg = `Thank you! Your message has been received. Our customer service team will review your message shortly.`;
      setFeedback({
        isOpen: true,
        type: 'success',
        title: 'Message Received',
        message: fallbackMsg
      });
      showToast(`Thank you! Your message has been received.`, 'success');
    } finally {
      setIsSubmittingContact(false);
      setTimeout(() => setContactSubmitted(false), 6000);
    }
  };

  const currentProductImages = useMemo(() => {
    if (!activeProductDetail) return [DEFAULT_PRODUCT_FALLBACK_IMAGE];
    return activeProductDetail.additionalImages && activeProductDetail.additionalImages.length > 0
      ? activeProductDetail.additionalImages
      : [activeProductDetail.coverImage || DEFAULT_PRODUCT_FALLBACK_IMAGE];
  }, [activeProductDetail]);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-slate-900 font-sans relative selection:bg-rose-100 selection:text-rose-900 pb-16 md:pb-0 w-full max-w-full overflow-x-hidden">
      
      {/* Toast Notification */}
      {showNotificationToast.show && (
        <div className={`fixed top-20 right-4 sm:right-6 z-[100] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border transition-all duration-300 transform translate-y-0 backdrop-blur-md max-w-sm sm:max-w-md ${
          showNotificationToast.type === 'error'
            ? 'bg-rose-950/95 border-rose-500/40 text-rose-100 shadow-rose-950/30'
            : showNotificationToast.type === 'info'
            ? 'bg-teal-950/95 border-teal-500/40 text-teal-100 shadow-teal-950/30'
            : 'bg-slate-900/95 border-emerald-500/40 text-white shadow-slate-950/40'
        }`}>
          {showNotificationToast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : showNotificationToast.type === 'info' ? (
            <Info className="w-5 h-5 text-teal-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-semibold flex-1 leading-snug">{showNotificationToast.msg}</span>
          <button 
            type="button" 
            onClick={() => setShowNotificationToast({ show: false, msg: '', type: 'success' })}
            className="ml-1 text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded-full hover:bg-white/10"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ============================================================
          MARK 1 & MARK 2: SHOPPING ZONE BD HEADER (White Top Bar + Dark Nav Bar)
          ============================================================ */}
      <header className="sticky top-0 z-40 bg-white shadow-xs border-b border-slate-200 transition-all select-none w-full max-w-full">
        
        {/* MARK 1: MAIN WHITE HEADER */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-6">
          
          {/* Logo & Store Name (Left - Clean without circle/pill shape) */}
          <div 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0 transition-all select-none group min-w-0" 
            onClick={() => navigateTo('home')}
          >
            {/* Store Logo Image */}
            {storeLogoFailed ? (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#16a34a] text-white flex items-center justify-center shadow-xs shrink-0">
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
            ) : (
              <img 
                src={displayStoreLogo || liveHeaderSettings.logoUrl || '/uploads/file-1793773029433-548634670.webp'} 
                alt={displayStoreName} 
                className="h-8 sm:h-11 md:h-12 max-h-12 w-auto object-contain shrink-0 transition-transform group-hover:scale-105"
                onError={() => setStoreLogoFailed(true)}
              />
            )}
            <span className="font-brand-logo font-black text-sm sm:text-xl md:text-2xl tracking-tight text-[#16a34a] group-hover:text-[#15803d] transition-colors whitespace-nowrap leading-none select-none">
              {displayStoreName ? displayStoreName.toUpperCase() : 'MEGH BRISTI FASHION'}
            </span>
          </div>

          {/* Desktop Search Bar (Center - hidden on mobile) */}
          <div ref={searchContainerRef} className="hidden sm:block relative flex-1 max-w-2xl mx-2 sm:mx-6 min-w-[160px]">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                setIsSearchDropdownOpen(false);
                navigateTo('shop');
              }}
              className="relative flex items-center w-full border border-[#16a34a] rounded-md overflow-hidden bg-white shadow-2xs"
            >
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                onFocus={() => setIsSearchDropdownOpen(true)}
                placeholder="Search in..."
                className="w-full px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-white text-slate-800 placeholder-slate-400 focus:placeholder-emerald-500/60 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                aria-label="Search"
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>
            </form>

            {/* Quick Live Search Results Dropdown */}
            {isSearchDropdownOpen && searchTerm.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {searchOutput && searchOutput.length > 0 ? (
                  <>
                    {searchOutput.slice(0, 6).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setIsSearchDropdownOpen(false);
                          openProductDetailModal(p);
                        }}
                        className="p-2.5 flex items-center gap-3 hover:bg-green-50/60 cursor-pointer transition-colors"
                      >
                        <img
                          src={p.coverImage || DEFAULT_STORE_FALLBACK_IMAGE}
                          alt={p.title}
                          className="w-10 h-10 object-cover rounded-md border border-slate-100 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{p.title}</p>
                          <p className="text-[11px] text-[#16a34a] font-bold">Tk. {Number(p.price).toLocaleString('en-US')}</p>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchDropdownOpen(false);
                        navigateTo('shop');
                      }}
                      className="w-full py-2 text-center text-xs font-bold text-[#16a34a] hover:bg-green-50 transition-colors cursor-pointer"
                    >
                      View all {searchOutput.length} products →
                    </button>
                  </>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No products found for &quot;{searchTerm}&quot;
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Right Action Icons (Compact, clean icon buttons) */}
          <div className="sm:hidden flex items-center gap-1 shrink-0">
            {/* 1. Track Order */}
            <button
              type="button"
              onClick={() => setIsTrackOrderModalOpen(true)}
              className="p-1.5 text-slate-700 hover:text-[#16a34a] rounded-lg transition-colors cursor-pointer"
              title="Track Order"
              aria-label="Track Order"
            >
              <MapPin className="w-5 h-5" strokeWidth={1.75} />
            </button>

            {/* 2. Cart with notification badge */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative p-1.5 text-slate-700 hover:text-[#16a34a] rounded-lg transition-colors cursor-pointer"
              title="Shopping Cart"
              aria-label="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5" strokeWidth={1.75} />
              {totalCartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#16a34a] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {totalCartCount}
                </span>
              )}
            </button>

            {/* 3. Account / User */}
            <button
              type="button"
              onClick={() => onGoToLogin ? onGoToLogin() : navigate('/login')}
              className="p-1.5 text-slate-700 hover:text-[#16a34a] rounded-lg transition-colors cursor-pointer"
              title="Account"
              aria-label="Account"
            >
              <User className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>

          {/* Desktop Right Action Icons: Track Order, Sign In, Cart, More */}
          <div className="hidden sm:flex items-center gap-3 sm:gap-6 md:gap-7 shrink-0">
            {/* 1. Track Order */}
            <button
              type="button"
              onClick={() => setIsTrackOrderModalOpen(true)}
              className="flex flex-col items-center justify-center text-slate-800 hover:text-[#16a34a] transition-colors cursor-pointer group"
            >
              <MapPin className="w-5 h-5 text-slate-800 group-hover:text-[#16a34a] transition-colors" strokeWidth={1.75} />
              <span className="text-[10px] sm:text-xs font-normal text-slate-800 group-hover:text-[#16a34a] mt-0.5 whitespace-nowrap">
                Track Order
              </span>
            </button>

            {/* 2. Sign In */}
            <button
              type="button"
              onClick={() => onGoToLogin ? onGoToLogin() : navigate('/login')}
              className="flex flex-col items-center justify-center text-slate-800 hover:text-[#16a34a] transition-colors cursor-pointer group"
            >
              <User className="w-5 h-5 text-slate-800 group-hover:text-[#16a34a] transition-colors" strokeWidth={1.75} />
              <span className="text-[10px] sm:text-xs font-normal text-slate-800 group-hover:text-[#16a34a] mt-0.5 whitespace-nowrap max-w-[65px] truncate">
                {customerSession ? (customerSession.name?.split(' ')[0] || 'Account') : 'Sign In'}
              </span>
            </button>

            {/* 3. Cart with round soft brand green notification badge */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative flex flex-col items-center justify-center text-slate-800 hover:text-[#16a34a] transition-colors cursor-pointer group"
            >
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-slate-800 group-hover:text-[#16a34a] transition-colors" strokeWidth={1.75} />
                <span className="absolute -top-1.5 -right-2.5 bg-[#16a34a] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {totalCartCount}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs font-normal text-slate-800 group-hover:text-[#16a34a] mt-0.5 whitespace-nowrap">
                Cart
              </span>
            </button>

            {/* 4. More (with Menu hamburger icon) */}
            <div ref={moreMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMoreDropdownOpen(prev => !prev)}
                className="flex flex-col items-center justify-center text-slate-800 hover:text-[#16a34a] transition-colors cursor-pointer group"
              >
                <Menu className="w-5 h-5 text-slate-800 group-hover:text-[#16a34a] transition-colors" strokeWidth={1.75} />
                <span className="text-[10px] sm:text-xs font-normal text-slate-800 group-hover:text-[#16a34a] mt-0.5 whitespace-nowrap">
                  More
                </span>
              </button>

              {isMoreDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => {
                      setIsMoreDropdownOpen(false);
                      setIsTrackOrderModalOpen(true);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-green-50 hover:text-[#16a34a] flex items-center gap-2 font-medium"
                  >
                    <MapPin className="w-4 h-4 text-[#16a34a]" />
                    <span>Track Order</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMoreDropdownOpen(false);
                      navigateTo('about');
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-green-50 hover:text-[#16a34a] flex items-center gap-2 font-medium"
                  >
                    <Building2 className="w-4 h-4 text-[#16a34a]" />
                    <span>About Us</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMoreDropdownOpen(false);
                      navigateTo('contact');
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-green-50 hover:text-[#16a34a] flex items-center gap-2 font-medium"
                  >
                    <Phone className="w-4 h-4 text-[#16a34a]" />
                    <span>Contact & Helpline</span>
                  </button>
                  <a
                    href="https://wa.me/8801406667669"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMoreDropdownOpen(false)}
                    className="w-full px-4 py-2 text-left text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 font-semibold"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span>WhatsApp: 01406667669</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Full-Width Dedicated Search Bar (Clean & Professional) */}
        <div ref={mobileSearchContainerRef} className="sm:hidden px-3 pb-2 pt-0.5 bg-white relative">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              setIsSearchDropdownOpen(false);
              navigateTo('shop');
            }}
            className="relative flex items-center w-full border border-[#16a34a] rounded-lg overflow-hidden bg-white shadow-2xs"
          >
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsSearchDropdownOpen(true);
              }}
              onFocus={() => setIsSearchDropdownOpen(true)}
              placeholder="Search products, fabrics, styles..."
              className="w-full px-3.5 py-1.5 text-xs bg-white text-slate-800 placeholder-slate-400 focus:placeholder-emerald-500/60 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Search"
            >
              <Search className="w-4 h-4 text-white" />
            </button>
          </form>

          {/* Quick Live Search Results Dropdown for Mobile */}
          {isSearchDropdownOpen && searchTerm.trim().length > 0 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {searchOutput && searchOutput.length > 0 ? (
                <>
                  {searchOutput.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setIsSearchDropdownOpen(false);
                        openProductDetailModal(p);
                      }}
                      className="p-2.5 flex items-center gap-3 hover:bg-green-50/60 cursor-pointer transition-colors"
                    >
                      <img
                        src={p.coverImage || DEFAULT_STORE_FALLBACK_IMAGE}
                        alt={p.title}
                        className="w-10 h-10 object-cover rounded-md border border-slate-100 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{p.title}</p>
                        <p className="text-[11px] text-[#16a34a] font-bold">Tk. {Number(p.price).toLocaleString('en-US')}</p>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchDropdownOpen(false);
                      navigateTo('shop');
                    }}
                    className="w-full py-2 text-center text-xs font-bold text-[#16a34a] hover:bg-green-50 transition-colors cursor-pointer"
                  >
                    View all {searchOutput.length} products →
                  </button>
                </>
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  No products found for &quot;{searchTerm}&quot;
                </div>
              )}
            </div>
          )}
        </div>

        {/* MARK 2: SUB-HEADER NAVIGATION BAR (Soft Brand Forest Green) */}
        <nav className="w-full bg-[#1b4332] text-white select-none border-t border-emerald-900/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3 overflow-x-auto scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-2 text-xs sm:text-sm font-semibold whitespace-nowrap">
              
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryCheckbox('Winter');
                  navigateTo('shop');
                }}
                className="px-2.5 sm:px-3 py-1.5 text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
              >
                Winter
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryCheckbox('All');
                  setSelectedSubcategory('All');
                  navigateTo('shop');
                }}
                className="px-2.5 sm:px-3 py-1.5 text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
              >
                Shop
              </button>

              <button
                type="button"
                onClick={() => {
                  setSortBy('newest');
                  navigateTo('shop');
                }}
                className="px-2.5 sm:px-3 py-1.5 text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
              >
                New Arrivals
              </button>

              {/* Dynamic Categories & Subcategories directly from Admin API / Real Products */}
              {(realCategoryItems && realCategoryItems.length > 0 ? realCategoryItems : (
                Array.from(new Set((products || []).map(p => p.category?.trim()).filter(Boolean) as string[])).map((c, idx) => ({
                  id: `cat-${c.toLowerCase().replace(/\s+/g, '-')}`,
                  name: c,
                  order: idx,
                  subcategories: []
                }))
              )).map((cat) => {
                const subs = cat.subcategories || [];
                const hasSubs = subs.length > 0;

                return (
                  <div key={cat.id || cat.name} className="relative group shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategoryCheckbox(cat.name);
                        setSelectedSubcategory('All');
                        navigateTo('shop');
                      }}
                      className="px-2.5 sm:px-3 py-1.5 flex items-center gap-1 text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                    >
                      <span>{cat.name}</span>
                      {hasSubs && (
                        <ChevronDown className="w-3.5 h-3.5 text-white/70 group-hover:rotate-180 transition-transform" />
                      )}
                    </button>

                    {hasSubs && (
                      <div className="absolute top-full left-0 pt-1.5 opacity-0 translate-y-1 invisible group-hover:opacity-100 group-hover:translate-y-0 group-hover:visible transition-all duration-150 z-50">
                        <div className="w-52 bg-white text-slate-800 rounded-lg shadow-2xl border border-slate-200 py-1.5 divide-y divide-slate-100 font-normal">
                          {subs.map((sub: any) => (
                            <button
                              key={sub.id || sub.name}
                              type="button"
                              onClick={() => {
                                setSelectedCategoryCheckbox(cat.name);
                                setSelectedSubcategory(sub.name);
                                navigateTo('shop');
                              }}
                              className="w-full text-left px-4 py-2 text-xs hover:bg-green-50 hover:text-[#16a34a] transition-colors flex items-center justify-between cursor-pointer"
                            >
                              <span>{sub.name}</span>
                              <span className="text-[10px] text-slate-300">→</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          </div>
        </nav>
      </header>

      {/* TRACK ORDER MODAL */}
      {isTrackOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 relative animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-gradient-to-r from-[#16a34a] to-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">Track Your Order</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTrackOrderModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <SimpleAuth
                isModal={true}
                onSuccess={() => {
                  setIsTrackOrderModalOpen(false);
                }}
                onCancel={() => setIsTrackOrderModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MAIN BODY CONTENT (ROUTED VIEWS)
          ============================================================ */}

      {/* VIEW 1: DEDICATED PRODUCT DETAIL VIEW (Screenshot 2: product_385231.html) */}
      {activeNav === 'product_detail' && (
        !activeProductDetail?.id ? (
          <div className="py-20 text-center max-w-md mx-auto px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No Product Selected</h2>
            <p className="text-sm text-slate-500 mb-6">Please select a product from our store catalog.</p>
            <button
              onClick={() => {
                navigateTo('shop');
                navigate('/shop');
              }}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
            >
              Browse Shop
            </button>
          </div>
        ) : (
        <div className="py-4 sm:py-8 lg:py-10 max-w-7xl mx-auto px-4 sm:px-6">
          
          {/* Breadcrumb: Home > Category > Product Title */}
          <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
            <button onClick={() => navigateTo('home')} className="hover:text-slate-900 transition-colors cursor-pointer">
              Home
            </button>
            <span className="text-slate-300 font-normal">&gt;</span>
            <button 
              onClick={() => {
                if (activeProductDetail.category) {
                  setSelectedCategoryCheckbox(activeProductDetail.category);
                }
                navigateTo('shop');
              }} 
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              {activeProductDetail.category || 'Shop'}
            </button>
            <span className="text-slate-300 font-normal">&gt;</span>
            <span className="text-slate-900 font-bold truncate max-w-[240px] sm:max-w-md">
              {activeProductDetail.title}
            </span>
          </div>

          {/* Main 2-Column Product Detail Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            
            {/* LEFT COLUMN: Gallery with Red Discount Badge and Bottom Thumbnail Carousel */}
            <div className="lg:col-span-5 space-y-3.5">
              
              {/* Main Product Frame */}
              <div 
                onMouseEnter={() => setIsHoverZooming(true)}
                onMouseLeave={() => setIsHoverZooming(false)}
                onMouseMove={handleProductImageMouseMove}
                className="relative aspect-square w-full bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex items-center justify-center p-3 select-none cursor-crosshair group"
                title="Hover cursor to zoom in details"
              >
                {/* Red Discount Badge at Top-Left (e.g. 400৳ OFF) */}
                {(() => {
                  const currentPrice = Number(activeVariant?.price || activeProductDetail.price || 0);
                  const regularPrice = Number(activeProductDetail.regularPrice || 0);
                  const diff = regularPrice > currentPrice ? regularPrice - currentPrice : 0;
                  if (diff > 0) {
                    return (
                      <div className="absolute top-0 left-0 bg-[#ef4444] text-white font-black text-xs sm:text-sm px-3.5 py-1.5 rounded-br-2xl shadow-sm z-20 tracking-tight">
                        Tk. {diff.toLocaleString('en-US')} OFF
                      </div>
                    );
                  }
                  return null;
                })()}

                <img 
                  fetchPriority="high" 
                  width={500} 
                  height={500} 
                  src={currentProductImages[activeImageIndex] || activeProductDetail.coverImage} 
                  alt={activeProductDetail.title} 
                  style={{
                    transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                    transform: isHoverZooming ? 'scale(2.2)' : 'scale(1)',
                    transition: isHoverZooming ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_PRODUCT_FALLBACK_IMAGE;
                  }}
                  className="w-full h-full object-contain select-none pointer-events-none will-change-transform"
                />

                {/* Fullscreen Zoom trigger button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsZoomModalOpen(true);
                  }}
                  className="absolute bottom-3 right-3 px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer z-20 backdrop-blur-xs opacity-0 group-hover:opacity-100"
                  title="Click to Zoom Fullscreen"
                  aria-label="Zoom Fullscreen"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Zoom</span>
                </button>
              </div>

              {/* Bottom Thumbnail Strip Carousel */}
              {currentProductImages.length > 1 && (
                <div className="flex items-center gap-2 pt-1">
                  <button 
                    type="button"
                    onClick={() => setActiveImageIndex(prev => (prev === 0 ? currentProductImages.length - 1 : prev - 1))}
                    className="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 shadow-xs cursor-pointer transition-colors"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 flex-1 justify-start">
                    {currentProductImages.map((imgUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer p-0.5 bg-white ${
                          activeImageIndex === idx 
                            ? 'border-[#16a34a] shadow-sm' 
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <img 
                          width={72} 
                          height={72} 
                          src={optimizeImageUrl(imgUrl, 160)} 
                          alt={`Thumbnail ${idx + 1}`} 
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = DEFAULT_PRODUCT_FALLBACK_IMAGE;
                          }}
                          className="w-full h-full object-cover rounded-lg" 
                        />
                      </button>
                    ))}
                  </div>

                  <button 
                    type="button"
                    onClick={() => setActiveImageIndex(prev => (prev === currentProductImages.length - 1 ? 0 : prev + 1))}
                    className="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 shadow-xs cursor-pointer transition-colors"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Title, Code Pill, Pricing, Variants, Quantity, 4 Action Buttons, Description */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-5">
              
              {/* 1. Title */}
              <h1 className="font-sans text-xl sm:text-2xl lg:text-[26px] text-slate-900 font-black tracking-tight leading-snug">
                {activeProductDetail.title}
              </h1>

              {/* 2. Product Code Pill */}
              {(() => {
                const productCode = activeProductDetail.sku || activeProductDetail.barcode || activeProductDetail.id?.replace(/^prod-/, '').toUpperCase() || 'NH650T';
                return (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100/90 border border-slate-200 rounded-md text-xs select-none">
                    <span className="font-mono text-slate-400 font-bold tracking-widest text-[11px]">||||</span>
                    <span className="text-slate-600 font-medium">Code:</span>
                    <span className="font-mono font-bold text-[#16a34a]">{productCode}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(productCode);
                        setIsCodeCopied(true);
                        setTimeout(() => setIsCodeCopied(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-700 hover:text-slate-900 ml-1.5 px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 transition cursor-pointer shadow-2xs font-semibold"
                    >
                      {isCodeCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}

              {/* 3. Price Row */}
              {(() => {
                const currentPrice = Number(activeVariant?.price || activeProductDetail.price || 0);
                const regularPrice = Number(activeProductDetail.regularPrice || 0);
                const diff = regularPrice > currentPrice ? regularPrice - currentPrice : 0;

                return (
                  <div className="flex flex-wrap items-center gap-3 pt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900 font-sans">
                      Tk. {currentPrice.toLocaleString('en-US')}
                    </span>
                    {regularPrice > currentPrice && (
                      <span className="text-base sm:text-lg text-slate-400 line-through font-semibold">
                        Tk. {regularPrice.toLocaleString('en-US')}
                      </span>
                    )}
                    {diff > 0 && (
                      <span className="bg-[#dcfce7] text-[#15803d] font-bold text-xs px-2.5 py-0.5 rounded-full">
                        Save Tk. {diff.toLocaleString('en-US')}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* 4. Variant / Color Selector */}
              {activeProductDetail.hasVariants && Array.isArray(activeProductDetail.variants) && activeProductDetail.variants.length > 0 && (
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Select Color:
                  </label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {activeProductDetail.variants.map((v) => {
                      const isCurrent = (activeVariant?.id === v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setActiveVariant(v)}
                          className={`w-9 h-9 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center p-0.5 ${
                            isCurrent
                              ? 'border-slate-800 ring-2 ring-slate-400/40 shadow-xs'
                              : 'border-slate-200 hover:border-slate-400'
                          }`}
                          title={v.name}
                        >
                          {v.image ? (
                            <img src={v.image} alt={v.name} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <span
                              className="w-full h-full rounded-full border border-black/10"
                              style={{ backgroundColor: v.color || '#16a34a' }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. Quantity Stepper */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs sm:text-sm font-bold text-slate-800">Quantity:</span>
                <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setDetailQuantity(prev => Math.max(1, prev - 1))}
                    className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-200 text-base font-bold transition-colors cursor-pointer select-none"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-bold text-xs sm:text-sm text-slate-900 bg-white py-1.5 select-none">
                    {detailQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDetailQuantity(prev => prev + 1)}
                    className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-200 text-base font-bold transition-colors cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 6. Action Buttons Grid (2x2) Matching Screenshot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-2">
                {/* Button 1 (Top Left): ⚡ Order Now */}
                <button 
                  type="button"
                  onClick={() => {
                    handleAddToCart(activeProductDetail, detailQuantity, activeVariant);
                    setIsCartOpen(false);
                    navigateTo('checkout');
                  }}
                  className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-bold py-3 px-4 rounded-lg text-sm sm:text-base shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-4 h-4 fill-current shrink-0" />
                  <span>Order Now</span>
                </button>

                {/* Button 2 (Top Right): 🛍️ Add to Cart */}
                <button 
                  type="button"
                  onClick={() => handleAddToCart(activeProductDetail, detailQuantity, activeVariant)}
                  className="w-full border-2 border-slate-900 hover:bg-slate-900 hover:text-white text-slate-900 font-bold py-3 px-4 rounded-lg text-sm sm:text-base transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span>Add to Cart</span>
                </button>

                {/* Button 3 (Bottom Left): 💬 WhatsApp / Helpline */}
                <a 
                  href={`https://wa.me/8801805035050?text=${encodeURIComponent(`Hello, I want to order: ${activeProductDetail.title}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#e6fbf2] hover:bg-[#d1fae5] border border-[#a7f3d0] text-emerald-800 font-bold py-2.5 px-4 rounded-lg text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-mono">01805-035050</span>
                </a>

                {/* Button 4 (Bottom Right): 📞 Call For Order */}
                <a 
                  href={`tel:${headerPhone || '01406667669'}`}
                  className="w-full bg-[#eff6ff] hover:bg-[#dbeafe] border border-[#bfdbfe] text-blue-700 font-bold py-2.5 px-4 rounded-lg text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Call For Order</span>
                </a>
              </div>

              {/* 7. Description Section (Directly underneath action buttons as in screenshot) */}
              <div className="pt-6 border-t border-slate-200/90 space-y-2.5">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Description
                </h2>
                
                {activeProductDetail.description ? (
                  /<[a-z][\s\S]*>/i.test(activeProductDetail.description) ? (
                    <div 
                      className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed text-slate-600"
                      dangerouslySetInnerHTML={{ __html: activeProductDetail.description }}
                    />
                  ) : (
                    <div className="space-y-2 text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                      {activeProductDetail.description}
                    </div>
                  )
                ) : (
                  <p className="text-xs sm:text-sm text-slate-500 italic">
                    Premium quality product from Megh Bristi Fashion. Fast delivery all over Bangladesh with cash on delivery.
                  </p>
                )}
              </div>

            </div>

          </div>

          {/* ============================================================
              FULL-WIDTH DETAILS SECTION: DESCRIPTION, SPECIFICATIONS & FEATURES
              ============================================================ */}
          <div className="mt-12 sm:mt-16 pt-10 border-t border-slate-200 space-y-12 sm:space-y-16">
            
            {/* 1. PRODUCT DESCRIPTION (Clean, Formatted & Separated) */}
            {activeProductDetail.description && (
              <div className="max-w-4xl mx-auto">
                <div className="text-center sm:text-left mb-6">
                  <span className="text-xs uppercase tracking-wider font-bold text-[#70b444] bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                    Product Description
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 flex items-center justify-center sm:justify-start gap-2">
                    <Sparkles className="w-5 h-5 text-sky-600" />
                    Product Description & Features
                  </h2>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
                  {/<[a-z][\s\S]*>/i.test(activeProductDetail.description) ? (
                    <div 
                      className="prose prose-slate max-w-none text-sm sm:text-base leading-relaxed space-y-4"
                      dangerouslySetInnerHTML={{ __html: activeProductDetail.description }}
                    />
                  ) : (
                    <div className="space-y-4 text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line">
                      {activeProductDetail.description.split('\n\n').filter(Boolean).map((para, pIdx) => {
                        const trimmed = para.trim();
                        if (trimmed.startsWith('http') && (trimmed.endsWith('.jpg') || trimmed.endsWith('.png') || trimmed.endsWith('.webp') || trimmed.includes('/uploads/'))) {
                          return (
                            <div key={pIdx} className="my-4 rounded-xl overflow-hidden border border-slate-200 shadow-xs flex justify-center">
                              <img src={trimmed} alt="Product Detail" className="max-w-full h-auto object-contain" />
                            </div>
                          );
                        }
                        return (
                          <p key={pIdx} className="text-slate-700">
                            {para}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. PRODUCT SPECIFICATIONS TABLE (Only shown if custom specs are configured) */}
            {((activeProductDetail as any).specTable?.length > 0) && (
              <div className="max-w-4xl mx-auto">
                <div className="text-center sm:text-left mb-6">
                  <span className="text-xs uppercase tracking-wider font-bold text-sky-600 bg-sky-50 px-3 py-1 rounded-full">
                    Detailed Specifications
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 flex items-center justify-center sm:justify-start gap-2">
                    <Sparkles className="w-5 h-5 text-sky-600" />
                    Product Specifications
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Meghbristi Fashion premium collection specifications & fabric care guide
                  </p>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-xs bg-white">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-800 font-bold uppercase text-[11px] sm:text-xs tracking-wider">
                        <th className="py-3 px-3 sm:px-5 w-2/5 sm:w-1/3 border-r border-slate-200">Feature</th>
                        <th className="py-3 px-3 sm:px-5">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {((activeProductDetail as any).specTable as any[]).map((row: any, idx: number) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/60' : 'bg-slate-50/40 hover:bg-slate-50/70'}>
                          <td className="py-3 px-3 sm:px-5 font-semibold text-slate-900 border-r border-slate-200/80 align-top">
                            {row.feature || row.label}
                          </td>
                          <td className="py-3 px-3 sm:px-5 text-slate-700 leading-relaxed align-top">
                            {row.details || row.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

          {/* Related / Other Products Section */}
          {products.filter(p => p.id !== activeProductDetail.id).length > 0 && (
            <div className="mt-14 pt-10 border-t border-[#e8e4dc]">
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <div>
                  <span className="text-xs uppercase tracking-wider font-bold text-[#70b444] bg-green-50 px-3 py-1 rounded-full border border-green-200">
                    Explore More
                  </span>
                  <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-[#1f1c19] mt-2">
                    Related Products
                  </h2>
                </div>
                <button 
                  onClick={() => {
                    navigateTo('shop');
                    navigate('/shop');
                  }}
                  className="text-xs sm:text-sm font-semibold text-[#70b444] hover:text-[#5ea134] flex items-center gap-1 group transition cursor-pointer"
                >
                  View All <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                {products.filter(p => p.id !== activeProductDetail.id).slice(0, 4).map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => openProductDetail(item)}
                    className="group relative flex flex-col bg-white border border-[#e8e4dc] hover:border-[#70b444]/40 hover:shadow-xl transition-all duration-300 rounded-sm overflow-hidden select-none justify-between cursor-pointer"
                  >
                    <div className="relative aspect-[3/4] w-full bg-[#f8f7f5] overflow-hidden">
                      <img 
                        loading="lazy" 
                        decoding="async"
                        src={optimizeImageUrl(item.image || item.coverImage, 400)} 
                        alt={item.title}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = DEFAULT_PRODUCT_FALLBACK_IMAGE;
                        }}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      />
                      {item.discountPercentage ? (
                        <div className="absolute top-2.5 right-2.5 z-10 bg-[#70b444] text-white text-[9px] sm:text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs shadow-sm tracking-wider">
                          -{item.discountPercentage}%
                        </div>
                      ) : null}
                    </div>

                    <div className="p-3 text-center space-y-1.5 flex-1 flex flex-col justify-between bg-white">
                      <div className="space-y-1">
                        <h4 className="font-editorial text-sm sm:text-base font-medium text-[#1f1c19] group-hover:text-[#70b444] transition-colors truncate">
                          {item.title}
                        </h4>
                        
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[#1f1c19] font-bold text-sm sm:text-base">
                            {formatPrice(item.price)}
                          </span>
                          {item.regularPrice && item.regularPrice > item.price && (
                            <span className="text-[#8c827a] line-through text-xs sm:text-sm">
                              {formatPrice(item.regularPrice)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Horizontal Action Buttons: Add to Cart & Buy Now */}
                      <div className="mt-2 grid grid-cols-2 gap-1.5 w-full">
                        <button 
                          type="button"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleAddToCart(item); 
                          }}
                          className="w-full bg-[#f4ede3] hover:bg-[#e8e0d5] text-[#1f1c19] py-2 px-1 rounded-xs text-[10px] sm:text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                          title="Add to Cart"
                        >
                          <ShoppingBag className="w-3 h-3 shrink-0" />
                          <span className="truncate">Add</span>
                        </button>
                        
                        <button 
                          type="button"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleAddToCart(item);
                            setIsCartOpen(false);
                            navigateTo('checkout');
                          }}
                          className="w-full bg-[#70b444] hover:bg-[#5ea134] text-white py-2 px-1 rounded-xs text-[10px] sm:text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                          title="Buy Now"
                        >
                          <Zap className="w-3 h-3 fill-current shrink-0" />
                          <span className="truncate">Buy</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )
      )}

      {/* VIEW 2: CONTACT US PAGE (Megh Bristi Brand Green & Luxury Layout) */}
      {activeNav === 'contact' && (
        <div className="py-10 sm:py-16 bg-[#faf8f5] min-h-screen">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Page Header & Breadcrumbs */}
            <div className="text-center mb-8 sm:mb-12">
              <h1 className="font-editorial text-3xl sm:text-5xl font-normal text-[#1f3f16] tracking-tight">
                Contact <span className="italic text-[#70b444]">Us</span>
              </h1>
              <nav className="flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-slate-500 mt-2.5">
                <button 
                  onClick={() => navigateTo('home')}
                  className="hover:text-[#70b444] transition cursor-pointer"
                >
                  Home
                </button>
                <span className="text-slate-400">›</span>
                <span className="text-[#1f3f16] font-semibold">Contact Us</span>
              </nav>
            </div>

            {/* Main Two-Column Card Container */}
            <div className="bg-white rounded-3xl border border-[#e8e4dc] shadow-sm overflow-hidden flex flex-col lg:flex-row">
              
              {/* Left Column: Let's Talk (Megh Bristi Luxury Forest Green) */}
              <div className="lg:w-[40%] bg-[#1f3f16] text-white p-8 sm:p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-[#70b444]/15 pointer-events-none blur-3xl" />
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-[#70b444]/10 pointer-events-none blur-2xl" />
                
                <div className="relative z-10 space-y-7">
                  {/* Brand Logo & Title */}
                  <div>
                    <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-md mb-4 flex items-center justify-center border border-white/20">
                      <img 
                        src={displayStoreLogo || '/uploads/file-1793773029433-548634670.webp'} 
                        alt={displayStoreName} 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 text-[#a3e673] text-[10px] font-bold tracking-widest uppercase mb-2 border border-white/15">
                      <Sparkles className="w-3 h-3" />
                      <span>{displayStoreName} Support</span>
                    </span>
                    <h2 className="font-editorial text-2xl sm:text-3xl font-normal text-white tracking-tight mb-2">
                      Let's Talk
                    </h2>
                    <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-light">
                      Have questions about your order, sizing, or custom styling? Our dedicated support team is here to assist you.
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Email */}
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#a3e673] shrink-0">
                        <Mail className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#a3e673] uppercase tracking-wider block mb-0.5">
                          Email Support
                        </span>
                        <a 
                          href={`mailto:${displayEmail || 'meghbristifashion@gmail.com'}`}
                          className="text-xs sm:text-sm text-white font-medium hover:underline hover:text-[#a3e673] break-all transition-colors"
                        >
                          {displayEmail || 'meghbristifashion@gmail.com'}
                        </a>
                      </div>
                    </div>

                    {/* Customer Support Hours */}
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#a3e673] shrink-0">
                        <Clock className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#a3e673] uppercase tracking-wider block mb-0.5">
                          Customer Care Hours
                        </span>
                        <p className="text-xs sm:text-sm text-white font-medium leading-relaxed">
                          Saturday – Thursday<br />
                          10:00 AM – 9:00 PM
                        </p>
                      </div>
                    </div>

                    {/* Phone / WhatsApp */}
                    {displayPhone && (
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#a3e673] shrink-0">
                          <Phone className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-[#a3e673] uppercase tracking-wider block mb-0.5">
                            Customer Care Hotline
                          </span>
                          <a 
                            href={`tel:${displayPhone}`}
                            className="text-xs sm:text-sm text-white font-medium hover:underline hover:text-[#a3e673] transition-colors"
                          >
                            {displayPhone}
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Location */}
                    {displayAddress && (
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#a3e673] shrink-0">
                          <MapPin className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-[#a3e673] uppercase tracking-wider block mb-0.5">
                            Store / Studio Address
                          </span>
                          <p className="text-xs sm:text-sm text-white font-medium leading-relaxed">
                            {displayAddress}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative z-10 pt-6 mt-6 border-t border-white/15 text-[11px] text-emerald-200/80">
                  {displayCompanyName} • Trusted Boutique Fashion
                </div>
              </div>

              {/* Right Column: Send us a message form */}
              <div className="lg:flex-1 p-8 sm:p-10 lg:p-12 bg-white">
                <h2 className="font-editorial text-2xl sm:text-3xl font-normal text-[#1f1c19] tracking-tight mb-6">
                  Send us a <span className="italic text-[#70b444]">Message</span>
                </h2>

                <form onSubmit={handleContactSubmit} className="space-y-5">
                  
                  {/* First Name & Last Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        First Name
                      </label>
                      <input 
                        type="text" 
                        value={contactFirstName} 
                        onChange={e => setContactFirstName(e.target.value)} 
                        placeholder="First Name"
                        className="w-full px-4 py-3 bg-[#faf8f5] border border-[#e8e4dc] rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:border-[#70b444] focus:ring-1 focus:ring-[#70b444] transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        Last Name
                      </label>
                      <input 
                        type="text" 
                        value={contactLastName} 
                        onChange={e => setContactLastName(e.target.value)} 
                        placeholder="Last Name"
                        className="w-full px-4 py-3 bg-[#faf8f5] border border-[#e8e4dc] rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:border-[#70b444] focus:ring-1 focus:ring-[#70b444] transition"
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="email" 
                      required
                      value={contactEmail} 
                      onChange={e => setContactEmail(e.target.value)} 
                      placeholder="your.email@example.com"
                      className="w-full px-4 py-3 bg-[#faf8f5] border border-[#e8e4dc] rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:border-[#70b444] focus:ring-1 focus:ring-[#70b444] transition"
                    />
                  </div>

                  {/* Phone Number with country dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Phone Number
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={contactCountryCode}
                        onChange={e => setContactCountryCode(e.target.value)}
                        className="px-3 py-3 bg-slate-50 border border-[#e8e4dc] rounded-xl text-xs sm:text-sm font-semibold text-slate-700 outline-none focus:border-[#70b444] cursor-pointer"
                      >
                        <option value="+880">+880 (BD)</option>
                        <option value="+91">+91 (IN)</option>
                        <option value="+1">+1 (US)</option>
                        <option value="+44">+44 (UK)</option>
                        <option value="+971">+971 (UAE)</option>
                        <option value="+966">+966 (KSA)</option>
                        <option value="+60">+60 (MY)</option>
                      </select>
                      <input 
                        type="tel" 
                        value={contactPhone} 
                        onChange={e => setContactPhone(e.target.value)} 
                        placeholder="01XXXXXXXXX"
                        className="flex-1 px-4 py-3 bg-[#faf8f5] border border-[#e8e4dc] rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:border-[#70b444] focus:ring-1 focus:ring-[#70b444] transition"
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Subject
                    </label>
                    <input 
                      type="text" 
                      value={contactSubject} 
                      onChange={e => setContactSubject(e.target.value)} 
                      placeholder="How can we help you?"
                      className="w-full px-4 py-3 bg-[#faf8f5] border border-[#e8e4dc] rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:border-[#70b444] focus:ring-1 focus:ring-[#70b444] transition"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea 
                      rows={5} 
                      required
                      value={contactMessage} 
                      onChange={e => setContactMessage(e.target.value)} 
                      placeholder="Write your message or inquiry here..."
                      className="w-full px-4 py-3 bg-[#faf8f5] border border-[#e8e4dc] rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:border-[#70b444] focus:ring-1 focus:ring-[#70b444] transition resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button 
                      type="submit" 
                      disabled={isSubmittingContact}
                      className="w-full sm:w-auto px-9 py-3.5 bg-[#70b444] hover:bg-[#5ea134] text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSubmittingContact ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Sending Message...</span>
                        </>
                      ) : contactSubmitted ? (
                        <span>✓ Message Sent Successfully!</span>
                      ) : (
                        <span>Send Message →</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* VIEW: ALL COLLECTIONS PAGE (Route: /collections or /collections/:id) */}
      {activeNav === 'collections' && (
        <div className="py-10 sm:py-16 bg-[#faf8f5] min-h-screen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            
            {/* Header & Breadcrumb */}
            <div className="text-center space-y-2">
              <nav className="flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-slate-500 mb-2">
                <button 
                  onClick={() => navigateTo('home')} 
                  className="hover:text-[#70b444] transition-colors cursor-pointer"
                >
                  Home
                </button>
                <span className="text-slate-400">›</span>
                <button 
                  onClick={() => {
                    setActiveCollectionId('');
                    navigate('/collections');
                  }}
                  className={`hover:text-[#70b444] transition-colors cursor-pointer ${!activeCollectionId ? 'text-[#1f3f16] font-bold' : ''}`}
                >
                  Collections
                </button>
                {activeCollectionId && (() => {
                  const currentCol = (ecomSettings?.featuredCollections || []).find(c => isCollectionMatched(c, activeCollectionId));
                  return currentCol ? (
                    <>
                      <span className="text-slate-400">›</span>
                      <span className="text-[#1f3f16] font-bold">{currentCol.title}</span>
                    </>
                  ) : null;
                })()}
              </nav>

              <div className="relative inline-block mx-auto">
                <h1 className="font-sans text-3xl sm:text-5xl font-black text-slate-900 tracking-tight uppercase flex items-center justify-center gap-2">
                  <span>
                    {activeCollectionId 
                      ? ((ecomSettings?.featuredCollections || []).find(c => isCollectionMatched(c, activeCollectionId))?.title || 'Collection')
                      : 'Curated Collections'
                    }
                  </span>
                  <span className="text-xs sm:text-sm font-bold bg-[#ffc107] text-slate-950 px-2.5 py-0.5 rounded-md shadow-2xs">
                    Special Collection
                  </span>
                </h1>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-[3px] bg-[#16a34a] rounded-full" />
              </div>
              <p className="text-xs sm:text-sm text-[#6b645b] max-w-xl mx-auto font-light leading-relaxed">
                Explore our signature seasonal edits, hand-loomed luxury, and designer party wear crafted with timeless elegance.
              </p>
            </div>

            {/* Filter Tabs / Pills for Collections */}
            {(() => {
              const allCols = (ecomSettings?.featuredCollections || []).filter(c => c.enabled !== false);
              if (allCols.length === 0) return null;

              return (
                <div className="flex items-center justify-center gap-2 flex-wrap pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCollectionId('');
                      navigate('/collections');
                    }}
                    className={`px-4 sm:px-5 py-2 rounded-full text-xs font-medium uppercase tracking-wider transition-all cursor-pointer ${
                      !activeCollectionId || activeCollectionId === 'all'
                        ? 'bg-[#1f3f16] text-white shadow-md'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-[#e8e4dc]'
                    }`}
                  >
                    All Collections
                  </button>
                  {allCols.map(c => {
                    const cProdCount = products.filter(p => (c.productIds || []).includes(p.id)).length;
                    const isSelected = isCollectionMatched(c, activeCollectionId);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setActiveCollectionId(c.id);
                          navigate(`/collections/${encodeURIComponent(c.id)}`);
                        }}
                        className={`px-4 sm:px-5 py-2 rounded-full text-xs font-medium uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#1f3f16] text-white shadow-md'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-[#e8e4dc]'
                        }`}
                      >
                        <span>{c.title}</span>
                        {cProdCount > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            {cProdCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Collections Content */}
            {(() => {
              const allCols = (ecomSettings?.featuredCollections || []).filter(c => c.enabled !== false);
              const colsToDisplay = activeCollectionId && activeCollectionId !== 'all'
                ? allCols.filter(c => isCollectionMatched(c, activeCollectionId))
                : allCols;

              if (colsToDisplay.length === 0) {
                return (
                  <div className="bg-white rounded-2xl border border-[#e8e4dc] p-12 text-center space-y-4">
                    <p className="text-slate-600 text-sm font-medium">No collections found matching your selection.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCollectionId('');
                        navigate('/collections');
                      }}
                      className="px-6 py-2.5 bg-[#1f3f16] text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      View All Collections
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-16">
                  {colsToDisplay.map((col) => {
                    const colProducts = products.filter(p => (col.productIds || []).includes(p.id));
                    
                    return (
                      <div key={col.id} className="bg-white rounded-3xl border border-[#e8e4dc] p-6 sm:p-10 shadow-xs space-y-8">
                        
                        {/* Collection Header Info */}
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#f0ece4] pb-5">
                          <div>
                            {col.badge && (
                              <span className="text-[11px] font-mono tracking-[0.2em] text-[#70b444] uppercase font-bold block mb-1">
                                {col.badge}
                              </span>
                            )}
                            <h2 className="font-editorial text-2xl sm:text-3xl font-normal text-[#141210] uppercase tracking-wide">
                              {col.title}
                            </h2>
                            {col.subtitle && (
                              <p className="text-xs sm:text-sm text-[#6b645b] font-light mt-1">
                                {col.subtitle}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 font-mono">
                            {colProducts.length} product{colProducts.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        {/* Product Grid (Signature Slanted Parallelogram Cards) */}
                        {colProducts.length === 0 ? (
                          <div className="py-12 text-center text-xs text-slate-400 font-mono">
                            No products currently added to this collection.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-10">
                            {colProducts.map((product) => {
                              const isDiscounted = product.regularPrice && product.regularPrice > product.price;
                              return (
                                <div 
                                  key={`all-col-${col.id}-${product.id}`}
                                  className="group flex flex-col justify-between cursor-pointer select-none"
                                >
                                  {/* Signature Parallelogram Slanted Frame */}
                                  <div 
                                    className="relative aspect-[3/4] w-full overflow-hidden -skew-x-[6.5deg] bg-[#f4efe6] transition-all duration-500 group-hover:-translate-y-1.5 group-hover:shadow-2xl" 
                                    onClick={() => openProductDetail(product)}
                                  >
                                    <img 
                                      loading="lazy" 
                                      decoding="async"
                                      width={320} 
                                      height={420} 
                                      src={optimizeImageUrl(product.coverImage, 500)} 
                                      sizes="(max-width: 640px) 50vw, 320px"
                                      alt={product.title}
                                      onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src = DEFAULT_PRODUCT_FALLBACK_IMAGE;
                                      }}
                                      className="w-full h-full object-cover object-top skew-x-[6.5deg] scale-115 transition-transform duration-700 ease-out group-hover:scale-120"
                                    />
                                    {product.discountPercentage ? (
                                      <span className="absolute top-2.5 right-4 z-10 bg-[#70b444] text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-xs tracking-wider uppercase skew-x-[6.5deg] shadow-xs">
                                        -{product.discountPercentage}%
                                      </span>
                                    ) : null}
                                  </div>

                                  {/* Left-Aligned Information exactly as Gulré style */}
                                  <div className="pt-3.5 space-y-1.5 flex-1 flex flex-col justify-between text-left">
                                    <div>
                                      <h3 
                                        onClick={() => openProductDetail(product)}
                                        className="font-sans text-xs sm:text-sm font-normal text-[#1f1c19] hover:text-[#70b444] transition-colors cursor-pointer line-clamp-2 leading-snug"
                                        title={product.title}
                                      >
                                        {product.title}
                                      </h3>
                                      
                                      <div className="flex items-baseline gap-2 pt-1 font-sans">
                                        <span className="text-xs sm:text-sm font-semibold text-[#1f1c19]">
                                          {isDiscounted ? 'From ' : ''}{formatPrice(product.price)} BDT
                                        </span>
                                        {isDiscounted && (
                                          <span className="text-[10px] sm:text-xs text-[#8c827a] line-through">
                                            {formatPrice(product.regularPrice!)}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Quick Actions: Add to Bag & Buy Now */}
                                    <div className="pt-2 grid grid-cols-2 gap-1.5 w-full">
                                      <button 
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAddToCart(product);
                                        }}
                                        className="w-full bg-[#f4ede3] hover:bg-[#e8e0d5] text-[#1f1c19] py-1.5 px-1 rounded-xs text-[10px] sm:text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                                        title="Add to Cart"
                                      >
                                        <ShoppingBag className="w-3 h-3 shrink-0" />
                                        <span className="truncate">Add</span>
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAddToCart(product);
                                          setIsCartOpen(false);
                                          navigateTo('checkout');
                                        }}
                                        className="w-full bg-[#70b444] hover:bg-[#5ea134] text-white py-1.5 px-1 rounded-xs text-[10px] sm:text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                                        title="Buy Now"
                                      >
                                        <Zap className="w-3 h-3 fill-current shrink-0" />
                                        <span className="truncate">Buy</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* VIEW 3: SHOP CATALOG PAGE (Screenshot 3 & 4) */}
      {activeNav === 'shop' && (
        <div className="py-8 sm:py-10 max-w-7xl mx-auto px-4 sm:px-8 space-y-6">
          {/* Horizontal Category & Subcategory Selection Bar */}
          {shopCategories.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-[#e8e4dc] shadow-xs space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#70b444] font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Select Category / Subcategory
                </span>
                {(selectedCategoryCheckbox !== "All" || selectedSubcategory !== "All") && (
                  <button
                    onClick={() => {
                      setSelectedCategoryCheckbox("All");
                      setSelectedSubcategory("All");
                      setCurrentPage(1);
                    }}
                    className="text-xs text-[#70b444] hover:underline font-semibold cursor-pointer"
                  >
                    Reset Filter (Show All)
                  </button>
                )}
              </div>
              
              {/* Row 1: Primary Categories */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-stone-200">
                {["All", ...shopCategories].map((cat) => {
                  const isSelected = selectedCategoryCheckbox === cat;
                  const count = cat === "All" 
                    ? products.length 
                    : products.filter(p => p.category?.toLowerCase() === cat.toLowerCase()).length;

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryCheckbox(cat);
                        setSelectedSubcategory("All");
                        setCurrentPage(1);
                      }}
                      className={"px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 cursor-pointer shrink-0 " + (
                        isSelected
                          ? "bg-[#1f3f16] text-white shadow-sm ring-2 ring-[#70b444]"
                          : "bg-[#faf8f5] hover:bg-white text-slate-700 border border-[#e8e4dc] hover:border-[#70b444] hover:text-[#70b444]"
                      )}
                    >
                      <span>{cat}</span>
                      {count > 0 && (
                        <span className={"text-[10px] px-1.5 py-0.2 rounded-full font-bold " + (
                          isSelected ? "bg-[#70b444] text-white" : "bg-stone-200/80 text-stone-700"
                        )}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Row 2: Subcategories (One piece, Three-Piece, Panjabi, etc.) */}
              {availableSubcategories.length > 0 && (
                <div className="pt-2.5 border-t border-[#f0ece4] flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold shrink-0 flex items-center gap-1.5 mr-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#70b444]" />
                    Subcategory:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubcategory("All");
                      setCurrentPage(1);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      selectedSubcategory === "All"
                        ? "bg-[#70b444] text-white shadow-xs"
                        : "bg-[#faf8f5] hover:bg-white text-slate-600 border border-[#e8e4dc]"
                    }`}
                  >
                    All {selectedCategoryCheckbox !== "All" ? selectedCategoryCheckbox : "Subcategories"}
                  </button>
                  {availableSubcategories.map(sub => {
                    const isSubSelected = selectedSubcategory.toLowerCase() === sub.name.toLowerCase();
                    const subCount = products.filter(p => {
                      const inCat = selectedCategoryCheckbox === 'All' || p.category?.toLowerCase() === sub.categoryName.toLowerCase();
                      const targetSub = sub.name.toLowerCase().trim();
                      const prodSub = (p.subCategory || (p as any).subcategory || '').toLowerCase().trim();
                      const prodTitle = (p.title || '').toLowerCase();
                      return inCat && (prodSub === targetSub || prodTitle.includes(targetSub));
                    }).length;

                    return (
                      <button
                        key={sub.name}
                        type="button"
                        onClick={() => {
                          if (selectedCategoryCheckbox === "All") {
                            setSelectedCategoryCheckbox(sub.categoryName);
                          }
                          setSelectedSubcategory(sub.name);
                          setCurrentPage(1);
                        }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          isSubSelected
                            ? "bg-[#1f3f16] text-white shadow-xs ring-2 ring-[#70b444]"
                            : "bg-[#faf8f5] hover:bg-white text-slate-700 border border-[#e8e4dc] hover:border-[#70b444] hover:text-[#70b444]"
                        }`}
                      >
                        <span>{sub.name}</span>
                        {subCount > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isSubSelected ? "bg-[#70b444] text-white" : "bg-stone-200/80 text-stone-700"
                          }`}>
                            {subCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            
            <div className="lg:col-span-3 space-y-6">
              {/* Shop Categories Filter Card — Selectable chips on left filter */}
              {shopCategories.length > 0 && (
                <div className="bg-white p-5 sm:p-6 border border-[#e8e4dc] rounded-sm shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#e8e4dc]">
                    <h2 className="font-editorial text-base sm:text-lg font-semibold text-[#1f1c19]">
                      Categories
                    </h2>
                    {(selectedCategoryCheckbox !== 'All' || selectedSubcategory !== 'All') && (
                      <button
                        onClick={() => {
                          setSelectedCategoryCheckbox('All');
                          setSelectedSubcategory('All');
                          setCurrentPage(1);
                        }}
                        className="text-[11px] text-[#70b444] hover:underline cursor-pointer font-medium"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  
                  {/* Selectable category chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['All', ...shopCategories].map((cat) => {
                      const isSelected = selectedCategoryCheckbox === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setSelectedCategoryCheckbox(cat);
                            setSelectedSubcategory('All');
                            setCurrentPage(1);
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#1f3f16] text-white font-bold shadow-xs'
                              : 'bg-[#faf8f5] hover:bg-[#f0ece4] text-[#4d4740] border border-[#e8e4dc]'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selectable subcategory chips */}
                  {availableSubcategories.length > 0 && (
                    <div className="pt-3 border-t border-[#f0ece4] space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                        Sub-Categories:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubcategory('All');
                            setCurrentPage(1);
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                            selectedSubcategory === 'All'
                              ? 'bg-[#70b444] text-white shadow-xs'
                              : 'bg-[#faf8f5] hover:bg-[#f0ece4] text-[#4d4740] border border-[#e8e4dc]'
                          }`}
                        >
                          All
                        </button>
                        {availableSubcategories.map(sub => {
                          const isSubSelected = selectedSubcategory.toLowerCase() === sub.name.toLowerCase();
                          return (
                            <button
                              key={sub.name}
                              type="button"
                              onClick={() => {
                                if (selectedCategoryCheckbox === 'All') {
                                  setSelectedCategoryCheckbox(sub.categoryName);
                                }
                                setSelectedSubcategory(sub.name);
                                setCurrentPage(1);
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                isSubSelected
                                  ? 'bg-[#1f3f16] text-white shadow-xs font-bold'
                                  : 'bg-[#faf8f5] hover:bg-[#f0ece4] text-[#4d4740] border border-[#e8e4dc]'
                              }`}
                            >
                              {sub.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Brands Filter Card — Only show if real brands exist */}
              {shopBrands.length > 0 && (
                <div className="bg-white p-5 sm:p-6 border border-[#e8e4dc] rounded-sm shadow-xs">
                  <h2 className="font-editorial text-base sm:text-lg font-semibold text-[#1f1c19] mb-3 sm:mb-4 pb-2 border-b border-[#e8e4dc]">
                    Brands
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5 sm:gap-3">
                    {['All', ...shopBrands].map((brand: any) => (
                      <label 
                        key={brand}
                        className="flex items-center gap-2.5 cursor-pointer text-xs text-[#4d4740] hover:text-[#1f1c19] select-none"
                      >
                        <input 
                          type="radio"
                          name="brand_filter"
                          checked={selectedBrand === brand}
                          onChange={() => {
                            setSelectedBrand(brand);
                            setCurrentPage(1);
                          }}
                          className="w-4 h-4 text-[#1f1c19] focus:ring-[#70b444] border-[#ded8cf] cursor-pointer"
                        />
                        <span className="truncate">{brand}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white p-5 sm:p-6 border border-[#e8e4dc] rounded-sm shadow-xs">
                <h2 className="font-editorial text-base sm:text-lg font-semibold text-[#1f1c19] mb-3 sm:mb-4 pb-2 border-b border-[#e8e4dc]">
                  Filter by Price
                </h2>
                <div className="space-y-4">
                  <div className="flex justify-between text-xs text-[#6b645b] font-mono">
                    <span>Tk. 0</span>
                    <span>Tk. {priceRange.toLocaleString('en-US')}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50000"
                    step="500"
                    value={priceRange}
                    onChange={(e) => {
                      setPriceRange(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="w-full accent-[#1f1c19] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-9 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="text-xs text-slate-500 font-medium">
                  Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredCatalog.length)} of {filteredCatalog.length} products (Page {currentPage})
                  {searchTerm && <span className="text-slate-800 font-semibold ml-1">for &quot;{searchTerm}&quot;</span>}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Sort:</span>
                  <select 
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="bg-white border border-slate-200 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-800 rounded-none focus:outline-none cursor-pointer"
                  >
                    <option value="featured">Featured</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                  </select>
                </div>
              </div>

              {/* Product Grid: Editorial Fashion Portrait Cards */}
              {paginatedProducts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
                  {paginatedProducts.map((product) => {
                    const isDiscounted = product.regularPrice && product.regularPrice > product.price;
                    const discountPct = isDiscounted 
                      ? Math.round(((product.regularPrice! - product.price) / product.regularPrice!) * 100) 
                      : 0;

                    return (
                      <div 
                        key={product.id}
                        onClick={() => openProductDetail(product)}
                        className="group relative flex flex-col bg-white border border-[#e8e4dc] hover:border-[#70b444]/40 hover:shadow-xl transition-all duration-300 rounded-sm overflow-hidden select-none justify-between cursor-pointer"
                      >
                        <div className="relative aspect-[3/4] w-full bg-[#f8f7f5] overflow-hidden">
                          <ResponsiveImage width={286} height={380} src={product.coverImage} alt={product.title} 
                            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500 ease-out"
                            sizes="(max-width: 640px) 50vw, 33vw"
                          />

                          {isDiscounted && discountPct > 0 && (
                            <div className="absolute top-2.5 left-2.5 z-10 bg-[#70b444] text-white text-[9px] sm:text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs shadow-sm tracking-wider">
                              -{discountPct}%
                            </div>
                          )}
                        </div>

                        <div className="p-3 text-center flex-1 flex flex-col justify-between bg-white">
                          <div className="space-y-1">
                            <h4 className="font-editorial text-sm sm:text-base font-medium text-[#1f1c19] group-hover:text-[#70b444] transition-colors truncate">
                              {product.title}
                            </h4>

                            {/* Attribute Badge (excluding weight) */}
                            {Array.isArray(product.selectedAttributes) && product.selectedAttributes.some(a => !/weight|ওজন/i.test(a.attributeName || '')) && (
                              <div className="flex flex-wrap items-center justify-center gap-1 my-0.5">
                                {product.selectedAttributes
                                  .filter(attr => !/weight|ওজন/i.test(attr.attributeName || ''))
                                  .map((attr, aIdx) => (
                                    <span 
                                      key={aIdx} 
                                      className="inline-flex items-center text-[10px] font-medium text-[#6b645b] bg-[#f5ede3] px-2 py-0.5 rounded-xs border border-[#e8e4dc]"
                                    >
                                      {Array.isArray(attr.values) ? attr.values.join(', ') : attr.values}
                                    </span>
                                  ))}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-xs">
                              <span className="text-[#1f1c19] font-bold text-sm">{formatPrice(product.price)}</span>
                              {isDiscounted && (
                                <span className="text-[#8c827a] line-through text-xs">{formatPrice(product.regularPrice!)}</span>
                              )}
                            </div>
                          </div>

                          {/* Horizontal Action Buttons: Add to Cart & Buy Now */}
                          <div className="pt-2.5 grid grid-cols-2 gap-1.5 w-full">
                            <button 
                              type="button"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleAddToCart(product); 
                              }}
                              className="w-full bg-[#f4ede3] hover:bg-[#e8e0d5] text-[#1f1c19] py-2 px-1 rounded-xs text-[10px] sm:text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                              title="Add to Cart"
                            >
                              <ShoppingBag className="w-3 h-3 shrink-0" />
                              <span className="truncate">Add</span>
                            </button>
                            
                            <button 
                              type="button"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleAddToCart(product);
                                setIsCartOpen(false);
                                navigateTo('checkout');
                              }}
                              className="w-full bg-[#70b444] hover:bg-[#5ea134] text-white py-2 px-1 rounded-xs text-[10px] sm:text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                              title="Buy Now"
                            >
                              <Zap className="w-3 h-3 fill-current shrink-0" />
                              <span className="truncate">Buy</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-4">
                  <Search className="w-12 h-12 text-slate-300 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="font-sans text-lg font-bold text-slate-800">
                      No products found
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {searchTerm 
                        ? `We couldn't find any products matching "${searchTerm}". Try adjusting your keywords or category filters.`
                        : "No products in our catalog yet. Products added from the Admin Panel will appear here automatically."}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategoryCheckbox('All');
                      setCurrentPage(1);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Clear Search & View All
                  </button>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-8 text-xs text-slate-600 font-medium">
                <button 
                  onClick={() => setCurrentPage(1)} 
                  disabled={currentPage === 1}
                  className="hover:text-slate-950 disabled:opacity-40"
                >
                  ← First
                </button>
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                  disabled={currentPage === 1}
                  className="hover:text-slate-950 disabled:opacity-40"
                >
                  &lt; Previous
                </button>

                {[...Array(totalPages)].map((_, i) => (
                  <button 
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-6 h-6 flex items-center justify-center ${currentPage === i + 1 ? 'font-bold text-slate-950 border-b border-slate-950' : 'hover:text-slate-950'}`}
                  >
                    {i + 1}
                  </button>
                ))}

                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                  disabled={currentPage === totalPages}
                  className="hover:text-slate-950 disabled:opacity-40"
                >
                  Next &gt;
                </button>
                <button 
                  onClick={() => setCurrentPage(totalPages)} 
                  disabled={currentPage === totalPages}
                  className="hover:text-slate-950 disabled:opacity-40"
                >
                  Last →
                </button>
              </div>



            </div>

          </div>
        </div>
      )}

      {/* ============================================================
          VIEW 4: DEDICATED ABOUT US PAGE (Exact NeuAura Style & Rich Laundry Pod Content)
          ============================================================ */}
      {activeNav === 'about' && (
        <React.Suspense fallback={
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-[#004d40] border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <AboutUsPage 
            onNavigateHome={() => navigateTo('home')}
            onNavigateShop={() => navigateTo('shop')}
            onNavigateContact={() => navigateTo('contact')}
            brandName={displayStoreName || 'Megh Bristi Fashion'}
            brandLogo={displayStoreLogo}
            products={products}
          />
        </React.Suspense>
      )}

      {/* ============================================================
          VIEW 5: DEDICATED CHECKOUT PAGE (Exact UX from User Design)
          ============================================================ */}
      {activeNav === 'checkout' && (
        <React.Suspense fallback={
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-[#004d40] border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <CheckoutPage
            cart={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveFromCart}
            onClearCart={() => clearCartAction()}
            ecomSettings={ecomSettings || (DEFAULT_ABOUT_SETTINGS as any)}
            onNavigateHome={() => navigateTo('home')}
            onNavigateShop={() => navigateTo('shop')}
            onOpenLoginModal={onGoToLogin}
          />
        </React.Suspense>
      )}

      {/* VIEW 6: HOME VIEW (Default Storefront) */}
      {activeNav === 'home' && (
        <>
          {/* ============================================================
              MARK 3: FULL-WIDTH HERO BANNER (Shopping Zone BD Layout)
              ============================================================ */}
          <section 
            className={`relative z-30 w-full overflow-hidden select-none flex items-center ${
              activeHeroBanners.length > 0
                ? 'h-[240px] sm:h-[360px] md:h-[450px] lg:h-[520px] bg-slate-950'
                : 'min-h-[400px] sm:min-h-[460px] lg:min-h-[500px] bg-gradient-to-r from-[#fedec8] via-[#fce4cf] to-[#fedbc2] border-b border-orange-100'
            }`}
            onMouseEnter={() => setIsSliderPaused(true)}
            onMouseLeave={() => setIsSliderPaused(false)}
          >
            {activeHeroBanners.length === 0 ? (
              <div className="relative w-full h-full py-8 sm:py-10">
                {/* Left/Right Slider Controls */}
                <button
                  type="button"
                  onClick={() => setDefaultSlideIndex(prev => (prev === 0 ? 1 : 0))}
                  className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/25 hover:bg-black/50 text-white flex items-center justify-center transition backdrop-blur-sm cursor-pointer"
                  aria-label="Previous Slide"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => setDefaultSlideIndex(prev => (prev === 0 ? 1 : 0))}
                  className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/25 hover:bg-black/50 text-white flex items-center justify-center transition backdrop-blur-sm cursor-pointer"
                  aria-label="Next Slide"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>

                {defaultSlideIndex === 0 ? (
                  /* Slide 1: NEW ARRIVALS JUST FOR YOU (Clothing) */
                  <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-center animate-in fade-in duration-300">
                    {/* Background accents */}
                    <div className="absolute -left-16 -top-16 w-80 h-80 rounded-full bg-[#fbd5b5]/50 pointer-events-none" />
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-[#faecd8]/80 pointer-events-none" />

                    {/* Left Column: NEW ARRIVALS JUST FOR YOU */}
                    <div className="md:col-span-4 text-center md:text-left space-y-3 sm:space-y-4">
                      <span className="font-sans font-bold text-slate-700 tracking-[0.25em] text-sm sm:text-base uppercase block">
                        NEW ARRIVALS
                      </span>
                      <div className="space-y-0.5">
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-none uppercase font-sans">
                          JUST<br />FOR
                        </h1>
                        <p className="text-3xl sm:text-4xl lg:text-5xl font-editorial italic text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] -mt-1 sm:-mt-2">
                          you
                        </p>
                      </div>
                      <div className="pt-2 flex justify-center md:justify-start">
                        <a
                          href="https://facebook.com/MeghBristiFashion"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#16a34a] hover:bg-[#15803d] text-white text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95"
                        >
                          <span className="w-4 h-4 rounded-full bg-white text-[#16a34a] font-black flex items-center justify-center text-[10px]">f</span>
                          <span>@MeghBristiFashion</span>
                        </a>
                      </div>
                    </div>

                    {/* Center Column: 3 Models */}
                    <div className="md:col-span-5 flex items-end justify-center relative min-h-[300px] sm:min-h-[380px]">
                      <div className="flex items-end justify-center -space-x-8 sm:-space-x-12 select-none">
                        <div className="relative z-20 w-36 sm:w-48 lg:w-52 transition-transform hover:scale-105 duration-300">
                          <img
                            src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80"
                            alt="Salwar Kameez Yellow"
                            className="w-full h-64 sm:h-84 lg:h-96 object-cover object-top rounded-2xl shadow-xl border-2 border-white/80"
                          />
                        </div>
                        <div className="relative z-10 w-40 sm:w-52 lg:w-56 transition-transform hover:scale-105 duration-300">
                          <img
                            src="https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80"
                            alt="Festive Pakistani Suit"
                            className="w-full h-72 sm:h-92 lg:h-[420px] object-cover object-top rounded-2xl shadow-2xl border-2 border-white/80"
                          />
                        </div>
                        <div className="relative z-0 w-36 sm:w-48 lg:w-52 transition-transform hover:scale-105 duration-300">
                          <img
                            src="https://images.unsplash.com/photo-1610030469668-932d0c2c31e9?w=600&auto=format&fit=crop&q=80"
                            alt="Designer Saree Peach"
                            className="w-full h-64 sm:h-84 lg:h-96 object-cover object-top rounded-2xl shadow-xl border-2 border-white/80"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Column: FOR ONLINE ORDER, Shop Now, Badge, Phone */}
                    <div className="md:col-span-3 flex flex-col items-center md:items-end text-center md:text-right space-y-4">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-dashed border-[#16a34a] p-1 flex items-center justify-center bg-white/70 shadow-sm">
                        <div className="text-center leading-tight">
                          <ShoppingBag className="w-5 h-5 mx-auto text-[#16a34a] mb-0.5" />
                          <span className="text-[9px] font-black text-slate-800 uppercase block tracking-tighter">SHOPPING ZONE</span>
                          <span className="text-[7px] text-[#16a34a] font-medium block">BEST QUALITY</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                          FOR ONLINE ORDER
                        </h3>
                        <button
                          type="button"
                          onClick={() => navigateTo('shop')}
                          className="px-7 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-sm sm:text-base rounded-md shadow-lg transition-transform active:scale-95 cursor-pointer"
                        >
                          Shop Now
                        </button>
                      </div>

                      <a
                        href="tel:01406667669"
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#16a34a] hover:bg-[#15803d] text-white text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95"
                      >
                        <Phone className="w-3.5 h-3.5 text-white" />
                        <span className="font-mono">01406667669</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  /* Slide 2: EXCLUSIVE BOUTIQUE LUXURY WEAR */
                  <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-center animate-in fade-in duration-300">
                    {/* Left Column: SPECIAL FASHION */}
                    <div className="md:col-span-4 text-center md:text-left space-y-2 sm:space-y-3">
                      <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] leading-none font-sans uppercase">
                        SPECIAL<br />EDITION
                      </h2>
                      <p className="text-2xl sm:text-3xl font-editorial italic text-white/95 drop-shadow">
                        Handcrafted Atelier
                      </p>
                    </div>

                    {/* Center Column */}
                    <div className="md:col-span-4 flex flex-col items-center text-center space-y-3">
                      <p className="text-sm sm:text-base font-bold text-white max-w-xs drop-shadow">
                        Trendy Salwar Kameez, Saree, & Designer Modest Wear.
                      </p>
                      <div className="flex items-center gap-2 pt-1 flex-wrap justify-center">
                        <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white rounded-md text-xs font-mono font-bold flex items-center gap-1.5 border border-white/20">
                          <Phone className="w-3 h-3 text-[#16a34a]" />
                          {headerPhone || '01910-646547'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategoryCheckbox('Womens');
                            navigateTo('shop');
                          }}
                          className="px-5 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-md text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-md"
                        >
                          SHOP NOW
                        </button>
                        <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white rounded-md text-xs font-bold flex items-center gap-1.5 border border-white/20">
                          <span className="w-3 h-3 rounded-full bg-white text-black font-black flex items-center justify-center text-[8px]">f</span>
                          @MeghBristiFashion
                        </span>
                      </div>
                    </div>

                    {/* Right Column: Festive Dress preview */}
                    <div className="md:col-span-4 flex items-center justify-center md:justify-end gap-3">
                      <img
                        src="https://images.unsplash.com/photo-1610030469668-932d0c2c31e9?w=400&auto=format&fit=crop&q=80"
                        alt="Festive Dress"
                        className="w-36 sm:w-44 h-44 sm:h-56 object-cover object-top rounded-2xl filter drop-shadow-xl border-2 border-white/40"
                      />
                    </div>
                  </div>
                )}

                {/* 7 Slide Indicators Bottom Center (Matching Screenshot) */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6].map((dotIdx) => (
                    <button
                      key={dotIdx}
                      type="button"
                      onClick={() => setDefaultSlideIndex(dotIdx % 2)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        dotIdx === defaultSlideIndex
                          ? 'w-6 bg-slate-900 shadow'
                          : 'w-2 bg-slate-400/60 hover:bg-slate-600'
                      }`}
                      aria-label={`Slide ${dotIdx + 1}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              activeHeroBanners.map((banner, index) => {
                const isActive = index === activeSlideIndex;
                const isVideo = banner.mediaType === 'video';
                const ytId = isVideo && (banner.videoType === 'youtube' || banner.youtubeUrl)
                  ? extractYouTubeVideoId(banner.youtubeUrl || banner.videoUrl)
                  : null;
                const directVideoUrl = isVideo && !ytId ? banner.videoUrl : null;

                return (
                  <div
                    key={banner.id || index}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                      isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    }`}
                  >
                    {/* Slide Background: Video (YouTube or MP4) or Image */}
                    {isVideo ? (
                      <div className="absolute inset-0 overflow-hidden bg-black flex items-center justify-center">
                        {ytId ? (
                          <iframe
                            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&controls=1&loop=1&playlist=${ytId}&playsinline=1&rel=0&modestbranding=1`}
                            title={banner.title || "Hero Video"}
                            loading="lazy"
                            className="w-full h-full border-0 aspect-video pointer-events-auto"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        ) : directVideoUrl ? (
                          <video
                            ref={(el) => {
                              const videoKey = banner.id || String(index);
                              heroVideoRefs.current[videoKey] = el;
                              if (el) {
                                if (isActive) {
                                  el.muted = isHeroMuted;
                                  el.play().catch(() => {});
                                } else {
                                  el.pause();
                                  el.currentTime = 0;
                                }
                              }
                            }}
                            autoPlay
                            loop={activeHeroBanners.length <= 1}
                            muted={isHeroMuted}
                            playsInline
                            preload="auto"
                            onEnded={handleVideoEnded}
                            poster={banner.imageUrl || undefined}
                            className="w-full h-full object-cover pointer-events-auto"
                          >
                            <source src={directVideoUrl} type="video/mp4" />
                          </video>
                        ) : null}
                      </div>
                    ) : (
                      <div className="absolute inset-0">
                        <picture>
                          {banner.mobileImageUrl && (
                            <source media="(max-width: 640px)" srcSet={banner.mobileImageUrl} />
                          )}
                          {banner.imageUrl ? (
                            <img
                              src={banner.imageUrl}
                              alt={banner.title || displayStoreName}
                              className="w-full h-full object-cover object-center"
                              loading={index === 0 ? 'eager' : 'lazy'}
                              fetchPriority={index === 0 ? 'high' : 'low'}
                              decoding="async"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-950 via-[#0f172a] to-slate-900" />
                          )}
                        </picture>
                        {!banner.imageOnly && (
                          <div className={`absolute inset-0 bg-gradient-to-r ${banner.bgGradient || 'from-slate-950/85 via-slate-900/50 to-transparent'}`} />
                        )}
                        {banner.imageOnly && (banner.productId || banner.link) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (banner.actionType === 'product' && banner.productId) {
                                const found = products.find(p => p.id === banner.productId);
                                if (found) {
                                  handleOpenProduct(found);
                                } else {
                                  navigate(`/product/${banner.productId}`);
                                }
                              } else if (banner.link) {
                                if (banner.link.startsWith('http')) {
                                  window.open(banner.link, '_blank');
                                } else {
                                  navigate(banner.link);
                                }
                              }
                            }}
                            className="absolute inset-0 z-10 w-full h-full cursor-pointer focus:outline-none"
                            aria-label={banner.title || `Slide ${index + 1}`}
                          />
                        )}
                      </div>
                    )}

                    {/* Slide Content Overlay (Only for image slides — for video slides, ONLY the video is shown with nothing else) */}
                    {!banner.imageOnly && !isVideo && (
                      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 h-full flex flex-col justify-center items-start py-16 sm:py-24">
                        {banner.badge && (
                          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-xs sm:text-sm font-bold tracking-wider uppercase mb-4 animate-fadeIn">
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>{banner.badge}</span>
                          </div>
                        )}

                        {banner.showDiscount && banner.discountText && (
                          <span className="inline-block px-3 py-1 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-xs sm:text-sm font-extrabold rounded-md uppercase tracking-wider mb-3 shadow-md">
                            {banner.discountText}
                          </span>
                        )}

                        <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight max-w-3xl leading-[1.15] mb-4 sm:mb-6 drop-shadow-md">
                          {banner.title}
                        </h1>

                        {banner.subtitle && (
                          <p className="text-sm sm:text-lg md:text-xl text-slate-200 max-w-2xl leading-relaxed mb-6 sm:mb-8 font-normal drop-shadow-sm">
                            {banner.subtitle}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                          <button
                            type="button"
                            onClick={() => {
                              if (banner.actionType === 'product' && banner.productId) {
                                const found = products.find(p => p.id === banner.productId);
                                if (found) {
                                  openProductDetail(found);
                                } else {
                                  navigateTo('shop');
                                }
                              } else if (banner.link === '#quote') {
                                setIsQuoteModalOpen(true);
                              } else if (banner.link?.startsWith('/product')) {
                                navigate(banner.link);
                                setActiveNav('product_detail');
                              } else if (banner.link?.startsWith('/')) {
                                navigate(banner.link);
                              } else {
                                navigateTo('shop');
                              }
                            }}
                            className="px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-slate-900 hover:bg-rose-700 text-white font-bold text-sm sm:text-base shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-2 group cursor-pointer active:scale-95"
                          >
                            <span>{banner.buttonText || 'BUY NOW'}</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>

                          {banner.secondaryButtonText?.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                if (banner.secondaryButtonLink === '#quote') {
                                  setIsQuoteModalOpen(true);
                                } else if (banner.secondaryButtonLink?.startsWith('/')) {
                                  navigate(banner.secondaryButtonLink);
                                } else if (banner.secondaryButtonLink) {
                                  window.location.href = banner.secondaryButtonLink;
                                } else {
                                  setIsQuoteModalOpen(true);
                                }
                              }}
                              className="px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/30 text-white font-semibold text-sm sm:text-base transition-all duration-300 flex items-center gap-2 cursor-pointer active:scale-95"
                            >
                              <span>{banner.secondaryButtonText}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Slider Navigation Arrows (Prev / Next) */}
            {activeHeroBanners.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevSlide}
                  className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/35 hover:bg-black/65 backdrop-blur-md text-white flex items-center justify-center border border-white/20 transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-lg"
                  aria-label="Previous Slide"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={handleNextSlide}
                  className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/35 hover:bg-black/65 backdrop-blur-md text-white flex items-center justify-center border border-white/20 transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-lg"
                  aria-label="Next Slide"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>

                {/* Dot Pagination Indicators (Always visible when multiple banners exist) */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg">
                  {activeHeroBanners.map((b, dotIdx) => (
                    <button
                      key={dotIdx}
                      type="button"
                      onClick={() => setActiveSlideIndex(dotIdx)}
                      className={`transition-all rounded-full cursor-pointer flex items-center justify-center ${
                        dotIdx === activeSlideIndex
                          ? 'w-8 h-2.5 bg-[#16a34a] shadow-md'
                          : 'w-2.5 h-2.5 bg-white/50 hover:bg-white/80'
                      }`}
                      aria-label={`Slide ${dotIdx + 1} (${b.mediaType === 'video' ? 'Video' : 'Image'})`}
                      title={`Slide ${dotIdx + 1}: ${b.mediaType === 'video' ? 'Video Slide' : 'Image Slide'}`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Sound / Volume Control for Hero Video Banner */}
            {activeHeroBanners[activeSlideIndex]?.mediaType === 'video' && (
              <button
                type="button"
                onClick={toggleHeroSound}
                className="absolute bottom-4 sm:bottom-6 right-3 sm:right-6 z-30 inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/55 hover:bg-black/85 backdrop-blur-md text-white border border-white/20 shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer group select-none"
                title={isHeroMuted ? "Sound On" : "Sound Off"}
                aria-label={isHeroMuted ? "Unmute video sound" : "Mute video sound"}
              >
                {isHeroMuted ? (
                  <VolumeX className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-rose-300 group-hover:text-white transition-colors" />
                ) : (
                  <Volume2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-400 group-hover:text-emerald-300 animate-pulse transition-colors" />
                )}
              </button>
            )}
          </section>

          {/* Ambient Rising Soap Bubbles Layer - disabled for fashion boutique */}
          {/* <AmbientSoapBubbles /> */}

          {/* ============================================================
              MARK 5: POPULAR CATEGORIES CAROUSEL (Above Curated Collections)
              ============================================================ */}
          <section className="py-6 sm:py-8 bg-white border-b border-slate-100 select-none">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">

              {/* CATEGORIES Header with underline highlight and View All button */}
              <div className="flex items-center justify-between mb-4 sm:mb-6 border-b border-slate-200/90 pb-2.5">
                <div className="relative inline-block min-w-0 pr-2">
                  <h2 className="text-base sm:text-2xl font-black text-slate-900 tracking-wider uppercase font-sans flex items-center gap-2">
                    <span className="whitespace-nowrap">CATEGORIES</span>
                    <span className="hidden sm:inline-block text-xs sm:text-sm font-bold bg-[#ffc107] text-slate-950 px-2.5 py-0.5 rounded-md shadow-2xs whitespace-nowrap">
                      Popular Categories
                    </span>
                  </h2>
                  <div className="absolute -bottom-[11px] left-0 w-16 sm:w-20 h-[3px] bg-[#16a34a] rounded-full" />
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => scrollCategories('left')}
                    className="hidden sm:flex w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-300 hover:border-[#16a34a] hover:bg-[#16a34a] hover:text-white text-slate-700 items-center justify-center transition shadow-2xs cursor-pointer active:scale-95"
                    aria-label="Previous categories"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCategories('right')}
                    className="hidden sm:flex w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-300 hover:border-[#16a34a] hover:bg-[#16a34a] hover:text-white text-slate-700 items-center justify-center transition shadow-2xs cursor-pointer active:scale-95"
                    aria-label="Next categories"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('shop')}
                    className="inline-flex items-center gap-1 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a] hover:text-white text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer group shrink-0"
                  >
                    <span>View All</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
              </div>

              {/* Carousel Container with Absolute Left and Right Navigation Arrows */}
              <div className="relative group/carousel">
                {/* Circular Category Cards Horizontal List */}
                <div
                  ref={categoryScrollRef}
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  className="flex items-start justify-between sm:justify-start gap-4 sm:gap-7 md:gap-9 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth py-2 px-1"
                >
                  {shoppingCategories.map((cat) => (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategoryCheckbox(cat.rawName || cat.name);
                        setSelectedSubcategory('All');
                        navigateTo('shop');
                      }}
                      className="group flex flex-col items-center shrink-0 cursor-pointer select-none"
                    >
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-slate-200/90 bg-stone-50 shadow-xs flex items-center justify-center overflow-hidden hover:border-[#16a34a] hover:shadow-md transition-all group-hover:scale-105 p-1">
                        {cat.image ? (
                          <img
                            src={cat.image}
                            alt={cat.name}
                            className="w-full h-full object-cover rounded-full"
                            loading="lazy"
                          />
                        ) : (
                          <Sparkles className="w-7 h-7 text-[#16a34a]" />
                        )}
                      </div>
                      <span className="text-xs sm:text-[13px] font-semibold text-slate-800 group-hover:text-[#16a34a] transition-colors text-center mt-2.5 max-w-[110px] truncate">
                        {cat.name}
                      </span>
                      <span className="text-[10px] text-stone-500 font-medium">
                        {cat.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================
              FEATURED PRODUCTS SECTION (Horizontal Auto-Scroll Carousel)
              ============================================================ */}
          <AutoScrollCategorySection
            title="FEATURED PRODUCTS"
            subtitle="Our Handpicked Best Sellers"
            products={featuredProductsList}
            onProductClick={(p) => openProductDetail(p as Product)}
            onOrderClick={(p) => {
              handleAddToCart(p as Product);
              setIsCartOpen(false);
              navigateTo('checkout');
            }}
            onViewAll={() => {
              navigateTo('shop');
            }}
          />

          {/* ============================================================
              NEWLY ADDED (Auto-Scroll Carousel)
              ============================================================ */}
          <AutoScrollCategorySection
            title="NEWLY ADDED"
            subtitle="Fresh Styles & Latest Arrivals"
            products={(products || []).slice(0, 10)}
            onProductClick={(p) => openProductDetail(p as Product)}
            onOrderClick={(p) => {
              handleAddToCart(p as Product);
              setIsCartOpen(false);
              navigateTo('checkout');
            }}
            onViewAll={() => {
              setSortBy('newest');
              navigateTo('shop');
            }}
          />

          {/* ============================================================
              REAL DYNAMIC BACKEND CATEGORIES (Auto-Scroll Carousels)
              ============================================================ */}
          {backendCategorySections.map((sec) => (
            <AutoScrollCategorySection
              key={sec.categoryName}
              title={sec.title}
              subtitle={sec.subtitle}
              products={sec.products}
              onProductClick={(p) => openProductDetail(p as Product)}
              onOrderClick={(p) => {
                handleAddToCart(p as Product);
                setIsCartOpen(false);
                navigateTo('checkout');
              }}
              onViewAll={() => {
                setSelectedCategoryCheckbox(sec.categoryName);
                setSelectedSubcategory('All');
                navigateTo('shop');
              }}
            />
          ))}



              {/* BEST SELLERS SECTION (ALGORITHM-BASED WITH THREE TABS: THIS WEEK / THIS MONTH / ALL TIME) */}
              {/* If no products have sales (total sales is 0), this whole section is completely hidden */}
              {bestSellers.totalSales > 0 && (bestSellers.week.length > 0 || bestSellers.month.length > 0 || bestSellers.all.length > 0) ? (
                <ScrollReveal>
                  <section className="pt-10 pb-12 sm:pt-14 sm:pb-16 bg-[#faf8f5] border-b border-[#e8e4dc]">
                    <div className="max-w-7xl mx-auto px-4 sm:px-8">
                      <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
                        <div className="relative inline-block mx-auto mb-2">
                          <h2 className="font-sans text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight uppercase flex items-center justify-center gap-2">
                            <span>BEST SELLERS</span>
                            <span className="text-xs sm:text-sm font-bold bg-[#ffc107] text-slate-950 px-2.5 py-0.5 rounded-md shadow-2xs">
                              Popular Styles
                            </span>
                          </h2>
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-[3px] bg-[#16a34a] rounded-full" />
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 font-medium mt-3">
                          {ecomSettings?.bestSellersSectionSubtitle || ecomSettings?.bundlesSectionSubtitle || 'Customer Favorites & Top-Ranked Styles'}
                        </p>
                      </div>

                    {/* 3 Tabs: This Week / This Month / All Time */}
                    <div className="flex items-center justify-center mb-8 sm:mb-10">
                      <div className="inline-flex p-1 bg-[#ede8e1] rounded-full border border-[#ded8cf]">
                        {(['week', 'month', 'all'] as const).map((period) => {
                          const label = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time';
                          const count = bestSellers[period]?.length || 0;
                          const isActive = bestSellerPeriod === period;
                          return (
                            <button
                              key={period}
                              type="button"
                              onClick={() => setBestSellerPeriod(period)}
                              className={`px-4 sm:px-5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                                isActive
                                  ? 'bg-[#1f1c19] text-white shadow-xs'
                                  : 'text-[#6b645b] hover:text-[#1f1c19] hover:bg-white/60'
                              }`}
                            >
                              <span>{label}</span>
                              {count > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                  isActive ? 'bg-[#70b444] text-white' : 'bg-[#ded8cf] text-[#4d4740]'
                                }`}>
                                  {count}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Products Grid for Active Tab */}
                    {bestSellers[bestSellerPeriod]?.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 max-w-6xl mx-auto">
                        {bestSellers[bestSellerPeriod].map((product, rankIdx) => (
                          <div 
                            key={`bestseller-${bestSellerPeriod}-${product.id}`}
                            className="group relative flex flex-col bg-white border border-[#e8e4dc] hover:border-[#70b444]/40 hover:shadow-xl transition-all duration-300 rounded-sm overflow-hidden"
                          >
                            {/* Best Seller Rank Badge */}
                            <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start">
                              <span className="inline-flex items-center gap-1 bg-[#1f1c19] text-[#faf8f5] text-[10px] font-semibold px-2 py-0.5 rounded-xs tracking-wider uppercase">
                                <Sparkles className="w-2.5 h-2.5 text-[#70b444]" />
                                #{rankIdx + 1}
                              </span>
                            </div>

                            <div 
                              className="relative aspect-[3/4] w-full bg-[#f6f5f2] overflow-hidden cursor-pointer" 
                              onClick={() => openProductDetail(product)}
                            >
                              <img 
                                loading="lazy" 
                                decoding="async"
                                width={286} 
                                height={380} 
                                src={optimizeImageUrl(product.coverImage, 400)} 
                                srcSet={`${optimizeImageUrl(product.coverImage, 360)} 360w, ${optimizeImageUrl(product.coverImage, 600)} 600w`}
                                sizes="(max-width: 640px) 50vw, 286px"
                                alt={product.title}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = DEFAULT_PRODUCT_FALLBACK_IMAGE;
                                }}
                                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                              />
                              {product.discountPercentage ? (
                                <span className="absolute top-2.5 right-2.5 bg-[#70b444] text-white text-[10px] font-bold px-2 py-0.5 rounded-xs tracking-wider">
                                  -{product.discountPercentage}%
                                </span>
                              ) : null}
                            </div>

                            <div className="p-3 text-center space-y-1.5 flex-1 flex flex-col justify-between">
                              <h3 
                                onClick={() => openProductDetail(product)}
                                className="font-editorial text-sm sm:text-base text-[#1f1c19] hover:text-[#70b444] transition-colors cursor-pointer line-clamp-1"
                                title={product.title}
                              >
                                {product.title}
                              </h3>
                              
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-[#1f1c19] font-bold text-sm sm:text-base">
                                  {formatPrice(product.price)}
                                </span>
                                {product.regularPrice && product.regularPrice > product.price && (
                                  <span className="text-[#8c827a] line-through text-xs sm:text-sm">
                                    {formatPrice(product.regularPrice)}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 grid grid-cols-2 gap-1.5 w-full">
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToCart(product);
                                  }}
                                  className="w-full bg-[#f4ede3] hover:bg-[#e8e0d5] text-[#1f1c19] py-2 px-1 rounded text-[10px] sm:text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                                  title="Add to Cart"
                                >
                                  <ShoppingBag className="w-3 h-3 shrink-0" />
                                  <span className="truncate">Add</span>
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToCart(product);
                                    setIsCartOpen(false);
                                    navigateTo('checkout');
                                  }}
                                  className="w-full bg-[#70b444] hover:bg-[#5ea134] text-white py-2 px-1 rounded text-[10px] sm:text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                                  title="Buy Now"
                                >
                                  <Zap className="w-3 h-3 fill-current shrink-0" />
                                  <span className="truncate">Buy</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-white/70 border border-dashed border-[#ded8cf] max-w-md mx-auto p-6 rounded-sm">
                        <Sparkles className="w-8 h-8 text-[#70b444] mx-auto mb-3" />
                        <h4 className="text-base font-editorial text-[#1f1c19] mb-1">
                          No sales recorded {bestSellerPeriod === 'week' ? 'this week' : 'this month'} yet
                        </h4>
                        <p className="text-xs text-[#6b645b] mb-4">
                          Explore our all-time top performing customer favorites!
                        </p>
                        <button
                          type="button"
                          onClick={() => setBestSellerPeriod('all')}
                          className="px-5 py-2.5 bg-[#1f1c19] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#70b444] transition-colors rounded-sm cursor-pointer"
                        >
                          View All-Time Best Sellers
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </ScrollReveal>
            ) : null}


          {/* ============================================================
              6. CLEAN LUXURY FLASH SALE SPOTLIGHT & CLINICAL VIDEO
              ============================================================ */}
          {(products.length > 0 && (!flashSaleConfig || flashSaleConfig.enabled !== false)) && (() => {
            const targetProd = flashSaleConfig?.productId 
              ? products.find(p => p.id === flashSaleConfig.productId) 
              : products[0];
            
            if (!targetProd) return null;

            const title = targetProd.title;
            const rawDesc = targetProd.description || targetProd.benefitsHighlights || '';
            const subtitle = rawDesc
              .split('\n')[0]
              .replace(/^Product Description\s*[:：]?\s*/i, '')
              .replace(/^পণ্যের বিবরণ\s*[:：]?\s*/i, '')
              .trim() || rawDesc.slice(0, 160);

            const badgeTag = targetProd.series 
              ? `${targetProd.series.toUpperCase()} • FLASH SALE` 
              : (targetProd.category ? `${targetProd.category.toUpperCase()} • FLASH SALE` : 'LIMITED FLASH SALE • SPECIAL OFFER');

            const image = targetProd.coverImage || (targetProd.images && targetProd.images[0]) || DEFAULT_PRODUCT_FALLBACK_IMAGE;
            const flashPrice = (flashSaleConfig?.flashPrice && flashSaleConfig.flashPrice > 0) 
              ? flashSaleConfig.flashPrice 
              : targetProd.price;
            const origPrice = (flashSaleConfig?.originalPrice && flashSaleConfig.originalPrice > 0)
              ? flashSaleConfig.originalPrice 
              : (targetProd.regularPrice || targetProd.price);
            const discount = origPrice > flashPrice && origPrice > 0 ? Math.round(((origPrice - flashPrice) / origPrice) * 100) : 0;
            const buttonText = 'SHOP FLASH DEAL';

            return (
              <ScrollReveal>
                <div className="relative">
                  {/* Clean Editorial Claude Pro Flash Sale Section */}
                  <section className="relative overflow-hidden bg-gradient-to-b from-[#faf8f5] via-[#f5ede3] to-[#faf8f5] py-16 sm:py-20 border-b border-[#e8e4dc]">
                    {/* Subtle Background Radial Aura */}
                    <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-[#70b444]/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
                        
                        {/* Left Column: Minimalist Typography & Animated Open Countdown */}
                        <div className="lg:col-span-6 space-y-5 text-center lg:text-left">
                          
                          {/* Animated Header Badge */}
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#70b444]/10 border border-[#70b444]/25 text-[#70b444] text-[11px] font-mono tracking-widest uppercase">
                            <Flame className="w-3.5 h-3.5 text-[#70b444] animate-pulse" />
                            <span>{badgeTag}</span>
                            {discount > 0 && (
                              <span className="bg-[#70b444] text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                                {discount}% OFF
                              </span>
                            )}
                          </div>

                          {/* Punchy Title */}
                          <h2 className="font-editorial text-3xl sm:text-5xl lg:text-[48px] text-[#1f1c19] leading-[1.15] tracking-tight">
                            {title}
                          </h2>
                          
                          {/* Clean Short Subtitle */}
                          <p className="text-[#6b645b] text-sm sm:text-base leading-relaxed max-w-lg mx-auto lg:mx-0 font-normal line-clamp-2">
                            {subtitle}
                          </p>

                          {/* Open Typography Countdown (No Box Container) */}
                          <div className="pt-2">
                            <div className="flex items-baseline justify-center lg:justify-start gap-3 sm:gap-5 text-[#1f1c19] select-none">
                              <div className="text-center lg:text-left">
                                <span className="font-mono text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight">{String(flashSaleTimeLeft.days).padStart(2, '0')}</span>
                                <span className="text-[10px] uppercase font-mono text-[#8c827a] block tracking-widest mt-0.5">DAYS</span>
                              </div>
                              <span className="font-mono text-2xl sm:text-3xl font-light text-[#ded8cf] -translate-y-2 sm:-translate-y-3">:</span>
                              <div className="text-center lg:text-left">
                                <span className="font-mono text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight">{String(flashSaleTimeLeft.hours).padStart(2, '0')}</span>
                                <span className="text-[10px] uppercase font-mono text-[#8c827a] block tracking-widest mt-0.5">HOURS</span>
                              </div>
                              <span className="font-mono text-2xl sm:text-3xl font-light text-[#ded8cf] -translate-y-2 sm:-translate-y-3">:</span>
                              <div className="text-center lg:text-left">
                                <span className="font-mono text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight">{String(flashSaleTimeLeft.minutes).padStart(2, '0')}</span>
                                <span className="text-[10px] uppercase font-mono text-[#8c827a] block tracking-widest mt-0.5">MINS</span>
                              </div>
                              <span className="font-mono text-2xl sm:text-3xl font-light text-[#ded8cf] -translate-y-2 sm:-translate-y-3">:</span>
                              <div className="text-center lg:text-left">
                                <span className="font-mono text-3xl sm:text-4xl lg:text-5xl font-medium text-[#70b444] tracking-tight animate-pulse">{String(flashSaleTimeLeft.seconds).padStart(2, '0')}</span>
                                <span className="text-[10px] uppercase font-mono text-[#70b444] block tracking-widest mt-0.5">SECS</span>
                              </div>
                            </div>
                          </div>

                          {/* Price & CTA Action */}
                          <div className="pt-3 flex flex-wrap items-center justify-center lg:justify-start gap-5 sm:gap-6">
                            <div className="flex items-baseline gap-2.5">
                              <span className="text-3xl sm:text-4xl font-bold text-[#1f1c19]">
                                {formatPrice(flashPrice)}
                              </span>
                              {origPrice > flashPrice && (
                                <span className="text-lg sm:text-xl text-[#8c827a] line-through">
                                  {formatPrice(origPrice)}
                                </span>
                              )}
                            </div>

                            <button 
                              onClick={() => {
                                if (targetProd) {
                                  openProductDetail(targetProd);
                                } else {
                                  navigateTo('shop');
                                }
                              }}
                              className="bg-[#70b444] hover:bg-[#5ea134] text-white font-medium text-xs tracking-widest uppercase px-8 py-3.5 rounded-sm shadow-md hover:shadow-lg transition-all duration-300 inline-flex items-center gap-2.5 cursor-pointer group"
                            >
                              <span>{buttonText || 'SHOP FLASH DEAL'}</span>
                              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>

                        </div>

                        {/* Right Column: Seamless Product Image */}
                        <div className="lg:col-span-6 relative flex items-center justify-center lg:justify-end">
                          <div 
                            onClick={() => {
                              if (targetProd) openProductDetail(targetProd);
                            }}
                            className="relative w-full max-w-[340px] sm:max-w-[380px] lg:max-w-[420px] cursor-pointer group flex items-center justify-center py-4"
                          >
                            {/* Ambient Backlight Glow */}
                            <div className="absolute inset-0 bg-[#70b444]/15 rounded-full blur-3xl opacity-60 group-hover:opacity-90 transition-opacity duration-700 pointer-events-none scale-105"></div>

                            {/* Fashion Portrait Image */}
                            <div className="relative z-10 w-full aspect-[3/4] rounded-sm overflow-hidden shadow-2xl border border-[#e8e4dc]">
                              <img 
                                loading="lazy" 
                                width={380} 
                                height={500} 
                                src={image} 
                                alt={title} 
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = DEFAULT_STORE_FALLBACK_IMAGE;
                                }}
                                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700 select-none"
                              />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  </section>
                </div>
              </ScrollReveal>
            );
          })()}



          {/* ============================================================
              8. FEATURED SEASONAL COLLECTIONS (STACKED EACH SECTION BELOW THE OTHER)
              ============================================================ */}
          {(() => {
            const rawCols = ecomSettings?.featuredCollections;
            const activeCols = (Array.isArray(rawCols) && rawCols.length > 0)
              ? rawCols.filter(c => c.enabled !== false)
              : [];

            if (products.length === 0 || activeCols.length === 0) return null;

            // Only show collections that have at least 1 active product
            const colsToRender = activeCols.filter(col => {
              const pIds = col.productIds || [];
              return products.some(p => pIds.includes(p.id));
            });

            if (colsToRender.length === 0) return null;

            return (
              <div id="featured-collections-section" className="space-y-0">
                {colsToRender.map((col, cIdx) => {
                  const colProductIds = col.productIds || [];
                  const colProducts = products.filter(p => colProductIds.includes(p.id));
                  if (colProducts.length === 0) return null;

                  return (
                    <ScrollReveal key={col.id} delayMs={cIdx * 50}>
                      <section 
                        id={`collection-${col.id}`}
                        className={`py-14 sm:py-20 border-b border-[#e8e4dc] scroll-mt-20 ${cIdx % 2 === 0 ? 'bg-white' : 'bg-[#faf8f5]'}`}
                      >
                        <div className="max-w-7xl mx-auto px-4 sm:px-8">
                          
                          {/* Section Header (Left-aligned Gulré Haute-Couture Editorial Title + Scroll Buttons) */}
                          <div className="mb-8 sm:mb-12 flex items-end justify-between gap-4">
                            <div 
                              onClick={() => {
                                setActiveCollectionId(col.id);
                                navigate(`/collections/${encodeURIComponent(col.id)}`);
                                setActiveNav('collections');
                                scrollToTop();
                              }}
                              className="text-left cursor-pointer group/coltitle inline-block"
                              role="button"
                              tabIndex={0}
                            >
                              {col.badge && (
                                <span className="text-[11px] font-mono tracking-[0.25em] text-[#70b444] uppercase font-semibold block mb-1.5">
                                  {col.badge}
                                </span>
                              )}
                              <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-normal text-[#141210] group-hover/coltitle:text-[#70b444] transition-colors tracking-wider uppercase flex items-center gap-3">
                                <span>{col.title}</span>
                                <span className="text-xl sm:text-2xl text-slate-400 group-hover/coltitle:text-[#70b444] group-hover/coltitle:translate-x-1.5 transition-all">→</span>
                              </h2>
                              {col.subtitle && (
                                <p className="text-xs sm:text-sm text-[#6b645b] leading-relaxed max-w-xl mt-2 font-light">
                                  {col.subtitle}
                                </p>
                              )}
                            </div>

                            {/* Left & Right Smooth Scroll Buttons */}
                            <div className="hidden sm:flex items-center gap-2 shrink-0 pb-1">
                              <button 
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById(`col-scroll-${col.id}`);
                                  if (el) el.scrollBy({ left: -320, behavior: 'smooth' });
                                }}
                                className="w-10 h-10 rounded-full border border-[#e8e4dc] bg-white text-slate-700 hover:text-[#70b444] hover:border-[#70b444] flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-90"
                                aria-label="Scroll left"
                              >
                                <ChevronLeft className="w-5 h-5" />
                              </button>
                              <button 
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById(`col-scroll-${col.id}`);
                                  if (el) el.scrollBy({ left: 320, behavior: 'smooth' });
                                }}
                                className="w-10 h-10 rounded-full border border-[#e8e4dc] bg-white text-slate-700 hover:text-[#70b444] hover:border-[#70b444] flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-90"
                                aria-label="Scroll right"
                              >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          {/* Products Horizontal Scroll for this Collection (Max 15 items, smooth scrolling) */}
                          <div className="relative group/scroll -mx-4 sm:-mx-8 px-4 sm:px-8">
                            <div 
                              id={`col-scroll-${col.id}`}
                              className="flex items-stretch overflow-x-auto gap-5 sm:gap-7 pb-6 pt-2 scroll-smooth no-scrollbar snap-x snap-mandatory"
                              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                              {colProducts.slice(0, 15).map((product) => {
                                const isDiscounted = product.regularPrice && product.regularPrice > product.price;
                                return (
                                  <div 
                                    key={`col-${col.id}-${product.id}`}
                                    className="group flex flex-col justify-between cursor-pointer select-none flex-none w-[230px] sm:w-[270px] md:w-[290px] snap-start"
                                  >
                                    {/* Signature Parallelogram Slanted Frame */}
                                    <div 
                                      className="relative aspect-[3/4] w-full overflow-hidden -skew-x-[6.5deg] bg-[#f4efe6] transition-all duration-500 group-hover:-translate-y-1.5 group-hover:shadow-2xl" 
                                      onClick={() => openProductDetail(product)}
                                    >
                                      <img 
                                        loading="lazy" 
                                        decoding="async"
                                        width={320} 
                                        height={420} 
                                        src={optimizeImageUrl(product.coverImage, 500)} 
                                        sizes="(max-width: 640px) 50vw, 320px"
                                        alt={product.title}
                                        onError={(e) => {
                                          e.currentTarget.onerror = null;
                                          e.currentTarget.src = DEFAULT_PRODUCT_FALLBACK_IMAGE;
                                        }}
                                        className="w-full h-full object-cover object-top skew-x-[6.5deg] scale-115 transition-transform duration-700 ease-out group-hover:scale-120"
                                      />
                                      {product.discountPercentage ? (
                                        <span className="absolute top-2.5 right-4 z-10 bg-[#70b444] text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-xs tracking-wider uppercase skew-x-[6.5deg] shadow-xs">
                                          -{product.discountPercentage}%
                                        </span>
                                      ) : null}
                                    </div>

                                    {/* Left-Aligned Information exactly as Gulré style */}
                                    <div className="pt-3.5 space-y-1.5 flex-1 flex flex-col justify-between text-left">
                                      <div>
                                        <h3 
                                          onClick={() => openProductDetail(product)}
                                          className="font-sans text-xs sm:text-sm font-normal text-[#1f1c19] hover:text-[#70b444] transition-colors cursor-pointer line-clamp-2 leading-snug"
                                          title={product.title}
                                        >
                                          {product.title}
                                        </h3>
                                        
                                        <div className="flex items-baseline gap-2 pt-1 font-sans">
                                          <span className="text-xs sm:text-sm font-semibold text-[#1f1c19]">
                                            {isDiscounted ? 'From ' : ''}{formatPrice(product.price)} BDT
                                          </span>
                                          {isDiscounted && (
                                            <span className="text-[10px] sm:text-xs text-[#8c827a] line-through">
                                              {formatPrice(product.regularPrice!)}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Quick Actions: Add to Bag & Buy Now */}
                                      <div className="pt-2 grid grid-cols-2 gap-1.5 w-full">
                                        <button 
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAddToCart(product);
                                          }}
                                          className="w-full bg-[#f4ede3] hover:bg-[#e8e0d5] text-[#1f1c19] py-1.5 px-1 rounded-xs text-[10px] sm:text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                                          title="Add to Cart"
                                        >
                                          <ShoppingBag className="w-3 h-3 shrink-0" />
                                          <span className="truncate">Add</span>
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAddToCart(product);
                                            setIsCartOpen(false);
                                            navigateTo('checkout');
                                          }}
                                          className="w-full bg-[#70b444] hover:bg-[#5ea134] text-white py-1.5 px-1 rounded-xs text-[10px] sm:text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                                          title="Buy Now"
                                        >
                                          <Zap className="w-3 h-3 fill-current shrink-0" />
                                          <span className="truncate">Buy</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Below: See all Button (Centered, routes to /collections) */}
                          <div className="flex flex-col items-center justify-center mt-10 sm:mt-14 space-y-2">
                            <button 
                              type="button"
                              onClick={() => {
                                setActiveCollectionId(col.id);
                                navigate(`/collections/${encodeURIComponent(col.id)}`);
                                setActiveNav('collections');
                                scrollToTop();
                              }}
                              className="px-10 py-3.5 bg-[#141210] hover:bg-[#70b444] text-white text-xs font-semibold uppercase tracking-[0.2em] transition-all duration-300 active:scale-95 cursor-pointer shadow-sm rounded-xs flex items-center gap-2 group"
                            >
                              <span>See all</span>
                              <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                            {colProducts.length > 15 && (
                              <span className="text-[11px] text-[#8c827a] font-light">
                                Showing 15 of {colProducts.length} items
                              </span>
                            )}
                          </div>

                        </div>
                      </section>
                    </ScrollReveal>
                  );
                })}
              </div>
            );
          })()}

          {/* Reviews & FAQ removed from home view as requested */}


        </>
      )}

      {/* ============================================================
          LUXURY FOOTER
          ============================================================ */}
      <React.Suspense fallback={<div className="h-40 bg-[#111827]"></div>}>
        <StoreFooter 
          displayStoreLogo={displayStoreLogo}
          displayStoreName={displayStoreName}
          displayTagline={displayTagline}
          displayEmail={displayEmail}
          displayPhone={displayPhone}
          shopCategories={shopCategories}
          socialLinks={activeSocialLinks}
          setActiveNav={(nav) => navigateTo(nav as any)}
          setSelectedCategoryCheckbox={setSelectedCategoryCheckbox}
          scrollToTop={scrollToTop}
        />
      </React.Suspense>

      {/* ============================================================
          SLIDE-OUT SHOPPING BAG & CHECKOUT DRAWER (MATCHING SCREENSHOT)
          ============================================================ */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsCartOpen(false)}
          />
          
          <div className="fixed inset-y-0 right-0 max-w-full flex">
            {/* 1. Desktop Attached "You May Also Like" Panel (Real Store Products) */}
            {cartUpsellProducts.length > 0 && (
              <div className="hidden md:flex w-64 lg:w-72 bg-white border-r border-slate-200/90 flex-col shrink-0 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-sans text-base font-extrabold text-[#081d34]">
                    You may also like
                  </h3>
                  <span className="text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                    {cartUpsellProducts.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {cartUpsellProducts.map((prod) => (
                    <div 
                      key={prod.id} 
                      className="bg-white rounded-2xl border border-slate-200/80 p-3.5 flex flex-col items-center text-center space-y-2.5 hover:shadow-md hover:border-purple-200 transition-all group"
                    >
                      <div 
                        onClick={() => {
                          setIsCartOpen(false);
                          openProductDetail(prod);
                        }}
                        className="w-24 h-24 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-1 cursor-pointer"
                      >
                        <img 
                          src={getSafeProductImage(prod.image || prod.coverImage)} 
                          alt={prod.title} 
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform" 
                          loading="lazy"
                        />
                      </div>
                      <div className="w-full">
                        <h4 
                          onClick={() => {
                            setIsCartOpen(false);
                            openProductDetail(prod);
                          }}
                          className="font-sans text-xs font-bold text-slate-900 line-clamp-2 min-h-[32px] leading-snug cursor-pointer hover:text-purple-600 transition-colors"
                          title={prod.title}
                        >
                          {prod.title}
                        </h4>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                          <span className="text-xs font-extrabold text-slate-900">
                            {formatPrice(prod.price)}
                          </span>
                          {prod.regularPrice && prod.regularPrice > prod.price && (
                            <span className="text-[10px] text-slate-400 line-through">
                              {formatPrice(prod.regularPrice)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddToCart(prod, 1)}
                        className="w-full py-2 px-3 border border-[#7c3aed] hover:bg-purple-600 hover:text-white text-[#7c3aed] active:scale-95 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Add to cart
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Main "Your Cart" Panel */}
            <div className="w-screen max-w-full sm:max-w-md bg-white shadow-2xl flex flex-col">
              
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-sans text-xl font-bold text-[#081d34]">
                    Your cart
                  </h3>
                  {totalCartCount > 0 && (
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-100 text-[#7c3aed]">
                      {totalCartCount} {totalCartCount === 1 ? 'item' : 'items'}
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)} 
                  className="w-8 h-8 rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
                  aria-label="Close cart"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Table Column Headers */}
              <div className="px-6 py-2.5 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                <span>PRODUCT</span>
                <span>TOTAL</span>
              </div>

              {/* Cart Body */}
              <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
                    <div className="font-sans text-lg font-bold text-slate-700">Your cart is empty</div>
                    <p className="text-xs text-slate-500">Discover our featured laundry products to get started.</p>
                    <button
                      type="button"
                      onClick={() => setIsCartOpen(false)}
                      className="mt-4 px-6 py-2.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-purple-600/20"
                    >
                      Continue Shopping
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Cart Items List */}
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex gap-3 sm:gap-4 py-4 border-b border-slate-100 items-start">
                        {/* Product Image */}
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-50 border border-slate-200/80 shrink-0 p-1 flex items-center justify-center">
                          <img 
                            src={item.product.coverImage || item.product.image || DEFAULT_STORE_FALLBACK_IMAGE} 
                            alt={item.product.title} 
                            className="w-full h-full object-contain" 
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = DEFAULT_STORE_FALLBACK_IMAGE;
                            }}
                          />
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0 pr-1 sm:pr-2">
                          <h4 className="font-sans text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                            {item.product.title}
                          </h4>
                          {item.variant?.name && (
                            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                              {item.variant.name}
                            </div>
                          )}
                          <div className="text-xs font-bold text-slate-900 mt-1">
                            {formatPrice(item.product.price)}
                          </div>

                          {/* Quantity Pill + Purple Trash */}
                          <div className="flex items-center gap-3 mt-2.5">
                            <div className="inline-flex items-center border border-slate-200 rounded-lg bg-white shadow-2xs">
                              <button 
                                type="button"
                                onClick={() => {
                                  if (item.quantity > 1) {
                                    handleUpdateQuantity(item.product.id, item.quantity - 1);
                                  } else {
                                    handleRemoveFromCart(item.product.id);
                                  }
                                }}
                                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-7 text-center text-xs font-bold text-slate-900">
                                {item.quantity}
                              </span>
                              <button 
                                type="button"
                                onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Purple Trash Icon */}
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(item.product.id)}
                              className="p-1.5 text-[#7c3aed] hover:text-purple-800 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                              title="Remove item"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Line Total */}
                        <div className="text-right shrink-0 font-sans text-xs sm:text-sm font-bold text-slate-900 pt-0.5">
                          {formatPrice(item.product.price * item.quantity)}
                        </div>
                      </div>
                    ))}

                    {/* Mobile "You May Also Like" Upsell Section (Real Store Products) */}
                    {cartUpsellProducts.length > 0 && (
                      <div className="md:hidden pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800">
                            You may also like
                          </h4>
                          <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            Recommendations
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {cartUpsellProducts.slice(0, 4).map((prod) => (
                            <div 
                              key={prod.id} 
                              className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 flex flex-col items-center text-center space-y-1.5 hover:border-purple-200 transition-all"
                            >
                              <div 
                                onClick={() => {
                                  setIsCartOpen(false);
                                  openProductDetail(prod);
                                }}
                                className="w-16 h-16 rounded-lg overflow-hidden bg-white p-1 flex items-center justify-center cursor-pointer"
                              >
                                <img 
                                  src={getSafeProductImage(prod.image || prod.coverImage)} 
                                  alt={prod.title} 
                                  className="w-full h-full object-contain" 
                                  loading="lazy"
                                />
                              </div>
                              <h5 
                                onClick={() => {
                                  setIsCartOpen(false);
                                  openProductDetail(prod);
                                }}
                                className="text-[11px] font-bold text-slate-900 line-clamp-1 cursor-pointer hover:text-purple-600 transition-colors" 
                                title={prod.title}
                              >
                                {prod.title}
                              </h5>
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-extrabold text-slate-900">
                                  {formatPrice(prod.price)}
                                </span>
                                {prod.regularPrice && prod.regularPrice > prod.price && (
                                  <span className="text-[9px] text-slate-400 line-through">
                                    {formatPrice(prod.regularPrice)}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddToCart(prod, 1)}
                                className="w-full py-1.5 border border-[#7c3aed] hover:bg-purple-600 hover:text-white text-[#7c3aed] text-[10px] font-bold rounded-lg transition active:scale-95"
                              >
                                Add to cart
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer & Checkout */}
              {cart.length > 0 && (
                <div className="p-5 sm:p-6 bg-white border-t border-slate-200 space-y-3.5 shadow-xl">
                  {/* Estimated total */}
                  <div className="flex items-center justify-between text-sm sm:text-base">
                    <div>
                      <span className="font-bold text-slate-900 block leading-tight">Estimated total</span>
                      <span className="text-[11px] text-slate-400">VAT & Taxes included</span>
                    </div>
                    <span className="font-extrabold text-[#7c3aed] font-sans text-lg sm:text-xl">
                      {formatPrice(cartSubtotal)}
                    </span>
                  </div>

                  {/* Check out CTA Button */}
                  <button 
                    type="button"
                    onClick={() => {
                      if (cart.length > 0) {
                        const eventId = createEventId('initiate_checkout');
                        trackEvent('InitiateCheckout', {
                          content_name: cart.map(i => i.product.title).join(', '),
                          content_ids: cart.map(i => i.product.id),
                          content_type: 'product',
                          value: cartGrandTotal || cartSubtotal,
                          currency: 'BDT',
                          num_items: cart.reduce((acc, item) => acc + item.quantity, 0),
                          contents: cart.map(item => ({
                            id: item.product.id,
                            name: item.product.title,
                            quantity: item.quantity,
                            item_price: item.product.price
                          }))
                        }, eventId);
                      }
                      setIsCartOpen(false);
                      navigateTo('checkout');
                    }}
                    className="group w-full py-3.5 px-5 bg-[#70b444] hover:bg-[#5ea134] active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-2xl transition-all shadow-lg shadow-green-700/25 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Check out</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          ORDER SUCCESS CONFIRMATION MODAL
          ============================================================ */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white max-w-md w-full shadow-2xl p-8 text-center space-y-4 border border-slate-100">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="font-sans text-2xl font-bold text-slate-900">Order Confirmed!</h3>
            <p className="text-xs text-slate-600">
              Thank you for ordering with {displayStoreName}. Your order ID is <strong>{orderSuccess.id}</strong>.
              Our delivery team will contact you shortly.
            </p>
            <button 
              onClick={() => setOrderSuccess(null)}
              className="w-full bg-slate-900 text-white py-3 text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
            >
              CONTINUE SHOPPING
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          FULLSCREEN PRODUCT IMAGE ZOOM LIGHTBOX MODAL
          ============================================================ */}
      {isZoomModalOpen && (
        <div 
          onClick={() => setIsZoomModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn cursor-zoom-out"
        >
          <button 
            onClick={() => setIsZoomModalOpen(false)}
            className="absolute top-5 right-5 w-10 h-10 bg-white/20 hover:bg-white/40 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer z-50"
            title="Close Zoom"
          >
            <X className="w-6 h-6" />
          </button>

          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center"
          >
            <img fetchPriority="high" width={500} height={500} src={currentProductImages[activeImageIndex] || activeProductDetail.coverImage} alt={activeProductDetail.title} 
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = DEFAULT_STORE_FALLBACK_IMAGE;
              }}
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl shadow-2xl bg-white/5 p-2 border border-white/10"
            />

            {/* Lightbox Carousel Navigation */}
            {currentProductImages.length > 1 && (
              <>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex(prev => (prev === 0 ? currentProductImages.length - 1 : prev - 1));
                  }}
                  className="absolute left-2 sm:-left-12 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/40 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex(prev => (prev === currentProductImages.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-2 sm:-right-12 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/40 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}



      {/* ============================================================
          DIRECT CUSTOMER INQUIRY MODAL
          ============================================================ */}
      {isQuoteModalOpen && (
        <div 
          onClick={() => setIsQuoteModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-8 border border-slate-100 my-8 animate-scaleUp text-slate-900"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsQuoteModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close quote modal"
            >
              <X className="w-5 h-5" />
            </button>

            {quoteSubmitted ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Inquiry Received!</h3>
                <p className="text-slate-600 text-sm max-w-md mx-auto leading-relaxed">
                  Thank you for reaching out to <strong>{displayStoreName}</strong>. Our customer support team will review your inquiry and contact you within 24 hours.
                </p>
                <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                  {(() => {
                    const rawWa = socialLinks?.whatsapp || liveHeaderSettings?.socialLinks?.whatsapp || displayPhone;
                    const cleanWa = rawWa ? rawWa.replace(/[^0-9]/g, '') : '';
                    if (!cleanWa) return null;
                    return (
                      <a
                        href={`https://wa.me/${cleanWa}?text=${encodeURIComponent(`Hello ${displayStoreName}! I just submitted an inquiry.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white px-5 py-2.5 rounded-full font-semibold text-sm transition shadow-md"
                      >
                        <MessageCircle className="w-4 h-4 fill-current" />
                        <span>Follow Up on WhatsApp</span>
                      </a>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() => {
                      setQuoteSubmitted(false);
                      setIsQuoteModalOpen(false);
                    }}
                    className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleQuoteSubmit} className="space-y-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0093d0] text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{displayStoreName} Support</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {liveHeaderSettings.ctaButtonText || 'Direct Customer Inquiry'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {displayTagline || 'Fill out the form below and our team will get back to you shortly.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={quoteForm.fullName}
                      onChange={(e) => setQuoteForm(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="e.g. John Doe"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0093d0]/30 focus:border-[#0093d0]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Company / Brand Name
                    </label>
                    <input
                      type="text"
                      value={quoteForm.company}
                      onChange={(e) => setQuoteForm(prev => ({ ...prev, company: e.target.value }))}
                      placeholder="e.g. Apex Global Brands"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0093d0]/30 focus:border-[#0093d0]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Business Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={quoteForm.email}
                      onChange={(e) => setQuoteForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="partner@company.com"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0093d0]/30 focus:border-[#0093d0]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone / WhatsApp <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={quoteForm.phone}
                      onChange={(e) => setQuoteForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+86 180... or +880 1..."
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0093d0]/30 focus:border-[#0093d0]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target MOQ / Order Volume
                  </label>
                  <select
                    value={quoteForm.quantity}
                    onChange={(e) => setQuoteForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0093d0]/30 focus:border-[#0093d0] bg-white cursor-pointer"
                  >
                    <option value="100,000 Pcs">100,000 Pcs (Standard MOQ)</option>
                    <option value="250,000 Pcs">250,000 Pcs</option>
                    <option value="500,000 Pcs">500,000 Pcs</option>
                    <option value="1,000,000+ Pcs">1,000,000+ Pcs (Enterprise Volume)</option>
                    <option value="Stock Samples Request">Stock Samples Request</option>
                    <option value="Custom Trial Batch">Custom Trial Batch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Requirements & Specifications
                  </label>
                  <textarea
                    rows={3}
                    value={quoteForm.message}
                    onChange={(e) => setQuoteForm(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Describe your desired formula, fragrance profile, color chambers, box packaging, or target market..."
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0093d0]/30 focus:border-[#0093d0] resize-none"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ISO 9001 & GMP Certified Facility</span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsQuoteModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingQuote}
                      className="flex-1 sm:flex-none px-6 py-2.5 rounded-full bg-[#70b444] hover:bg-[#5ea134] text-white font-bold text-xs sm:text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingQuote ? 'Submitting...' : 'Submit Quote Request →'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Global User Feedback Dialog */}
      <FeedbackDialog
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
      />

      {/* ============================================================
          MOBILE STICKY BOTTOM NAVIGATION BAR (Thumb Zone UX)
          Items: Home | Shop | Category | Collection | Cart
          ============================================================ */}
      {activeNav !== 'checkout' && (
        <>
          {/* Mobile Category Bottom Sheet Drawer */}
          {isMobileCategorySheetOpen && (
            <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
              {/* Backdrop */}
              <div 
                onClick={() => setIsMobileCategorySheetOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              />
              
              {/* Sheet Body */}
              <div className="relative bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl max-h-[82vh] flex flex-col z-10 overflow-hidden">
                {/* Grab bar */}
                <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mt-3 mb-1 shrink-0" />

                {/* Header */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-green-50 text-[#70b444]">
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Categories</h3>
                      <p className="text-[11px] text-slate-500">Select your preferred category</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileCategorySheetOpen(false)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Close categories"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Category Items List with Subcategories */}
                <div className="p-4 overflow-y-auto space-y-3 pb-8">
                  <div className="grid grid-cols-2 gap-3">
                    {(realCategoryItems && realCategoryItems.length > 0 ? realCategoryItems : allCategoryNames.map(name => ({ id: name, name, subcategories: [] }))).map((cat: any) => {
                      const catName = cat.name;
                      const lower = (catName || '').toLowerCase().trim();
                      const catImg = cat.image || 
                        (products.find(p => p.category?.toLowerCase() === lower)?.coverImage) || 
                        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80';
                      const isSelected = selectedCategoryCheckbox === catName;
                      const subcategories: any[] = cat.subcategories || [];

                      return (
                        <div
                          key={cat.id || catName}
                          className={`p-3 rounded-2xl border transition-all text-left flex flex-col justify-between ${
                            isSelected 
                              ? 'border-[#70b444] bg-green-50/40 shadow-xs ring-1 ring-[#70b444]/30' 
                              : 'border-slate-200/90 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div 
                            onClick={() => {
                              setSelectedCategoryCheckbox(catName);
                              setSelectedSubcategory('All');
                              setIsMobileCategorySheetOpen(false);
                              navigateTo('shop');
                            }}
                            className="cursor-pointer flex flex-col items-center text-center"
                          >
                            <div className="w-16 h-16 rounded-full overflow-hidden mb-2 border border-slate-100 shadow-2xs">
                              <img src={catImg} alt={catName} className="w-full h-full object-cover" />
                            </div>
                            <span className="font-bold text-xs text-slate-800 line-clamp-1">{catName}</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">
                              {subcategories.length > 0 ? `${subcategories.length} Sub-Categories` : 'View Products'}
                            </span>
                          </div>

                          {/* Quick subcategory pills */}
                          {subcategories.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                              {subcategories.slice(0, 3).map((sub: any) => (
                                <button
                                  key={sub.id || sub.name}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCategoryCheckbox(catName);
                                    setSelectedSubcategory(sub.name);
                                    setIsMobileCategorySheetOpen(false);
                                    navigateTo('shop');
                                  }}
                                  className="px-2 py-0.5 text-[9px] font-medium bg-slate-100 hover:bg-[#70b444] hover:text-white text-slate-700 rounded-md transition-colors truncate max-w-full cursor-pointer"
                                >
                                  {sub.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* View All in Shop */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryCheckbox('All');
                      setSelectedSubcategory('All');
                      setIsMobileCategorySheetOpen(false);
                      navigateTo('shop');
                    }}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm mt-2"
                  >
                    <span>Browse All Products</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <nav 
            aria-label="Mobile Navigation"
            className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 pb-[calc(env(safe-area-inset-bottom)+6px)] flex items-center justify-around select-none"
          >
            {/* 1. Home Tab */}
            <button
              type="button"
              onClick={() => {
                setIsMobileCategorySheetOpen(false);
                if (activeNav === 'home') {
                  scrollToTop();
                } else {
                  navigateTo('home');
                }
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors cursor-pointer ${
                activeNav === 'home' && !isMobileCategorySheetOpen ? 'text-[#70b444]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className={`p-1 rounded-full transition-transform active:scale-90 ${activeNav === 'home' && !isMobileCategorySheetOpen ? 'bg-green-50 text-[#70b444]' : ''}`}>
                <Home className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold mt-0.5 tracking-tight">Home</span>
            </button>

            {/* 2. Shop Tab */}
            <button
              type="button"
              onClick={() => {
                setIsMobileCategorySheetOpen(false);
                setSelectedCategoryCheckbox('All');
                setSelectedSubcategory('All');
                navigateTo('shop');
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors cursor-pointer ${
                activeNav === 'shop' && !isMobileCategorySheetOpen && selectedCategoryCheckbox === 'All' ? 'text-[#70b444]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className={`p-1 rounded-full transition-transform active:scale-90 ${activeNav === 'shop' && !isMobileCategorySheetOpen && selectedCategoryCheckbox === 'All' ? 'bg-green-50 text-[#70b444]' : ''}`}>
                <ShoppingBag className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold mt-0.5 tracking-tight">Shop</span>
            </button>

            {/* 3. Category Tab */}
            <button
              type="button"
              onClick={() => {
                setIsMobileCategorySheetOpen(prev => !prev);
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors cursor-pointer ${
                isMobileCategorySheetOpen || (activeNav === 'shop' && selectedCategoryCheckbox !== 'All') ? 'text-[#70b444]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className={`p-1 rounded-full transition-transform active:scale-90 ${isMobileCategorySheetOpen || (activeNav === 'shop' && selectedCategoryCheckbox !== 'All') ? 'bg-green-50 text-[#70b444]' : ''}`}>
                <LayoutGrid className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold mt-0.5 tracking-tight">Category</span>
            </button>

            {/* 4. Collection Tab */}
            <button
              type="button"
              onClick={() => {
                setIsMobileCategorySheetOpen(false);
                setActiveCollectionId('');
                navigateTo('collections');
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors cursor-pointer ${
                activeNav === 'collections' && !isMobileCategorySheetOpen ? 'text-[#70b444]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className={`p-1 rounded-full transition-transform active:scale-90 ${activeNav === 'collections' && !isMobileCategorySheetOpen ? 'bg-green-50 text-[#70b444]' : ''}`}>
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold mt-0.5 tracking-tight">Collection</span>
            </button>

            {/* 5. Cart Tab with Live Badge */}
            <button
              type="button"
              onClick={() => {
                setIsMobileCategorySheetOpen(false);
                setIsCartOpen(true);
              }}
              className="relative flex flex-col items-center justify-center flex-1 py-1 px-1 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <div className="relative p-1 rounded-full transition-transform active:scale-90">
                <ShoppingCart className="w-5 h-5 text-slate-800" />
                {totalCartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#70b444] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md animate-bounce">
                    {totalCartCount > 99 ? '99+' : totalCartCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold text-slate-900 mt-0.5 tracking-tight">
                Cart
              </span>
            </button>
          </nav>
        </>
      )}

    </div>
  );
}
