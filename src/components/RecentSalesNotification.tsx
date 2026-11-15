import React, { useState, useEffect } from 'react';
import { ShoppingBag, CheckCircle2, X } from 'lucide-react';
import { Product } from '../types';

interface RecentSalesNotificationProps {
  products: Product[];
}

const BUYER_NAMES = [
  'রাকিব হাসান', 'তানভীর আহমেদ', 'মেহেদী হাসান', 'সুমাইয়া আক্তার', 'মাহমুদুল হক',
  'ফারিয়া জামান', 'আসিফ ইকবাল', 'নুসরাত জাহান', 'শামীম ওসমান', 'সায়মা রহমান'
];

const CITIES = [
  'রাজশাহী', 'ঢাকা', 'চট্টগ্রাম', 'সিলেট', 'খুলনা', 
  'বগুড়া', 'কুমিল্লা', 'রংপুর', 'ময়মনসিংহ', 'গাজীপুর'
];

const TIME_MINUTES = [2, 5, 8, 12, 16, 22, 35];

// Gentle, premium audio chime using Web Audio API (No heavy external mp3 asset required)
const playNotificationChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    
    // First soft tone (pleasant C6 chime)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now); // C6
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.08, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);

    // Second bell harmony tone (E6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now + 0.12); // E6
    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.1, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.56);
  } catch {
    // Graceful fallback if browser blocks autoplay audio
  }
};

export const RecentSalesNotification: React.FC<RecentSalesNotificationProps> = ({ products }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentSale, setCurrentSale] = useState<{
    buyer: string;
    city: string;
    productTitle: string;
    productImage: string;
    minutesAgo: string | number;
  } | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;

    // Fetch REAL orders from backend API
    const checkRealOrders = async () => {
      try {
        const res = await fetch('/api/orders/public-recent');
        const data = await res.json();
        if (data.success && Array.isArray(data.orders) && data.orders.length > 0) {
          // Pick a real recent order
          const randomOrder = data.orders[Math.floor(Math.random() * data.orders.length)];
          if (randomOrder && randomOrder.productTitle) {
            // Find product image if missing
            const matchedProduct = products.find(p => p.title === randomOrder.productTitle || p.id === randomOrder.productId);
            const fallbackImg = matchedProduct?.coverImage || matchedProduct?.image || '/favicon/favicon-32x32.png';

            setCurrentSale({
              buyer: randomOrder.buyer || 'সম্মানিত গ্রাহক',
              city: randomOrder.city || 'বাংলাদেশ',
              productTitle: randomOrder.productTitle,
              productImage: randomOrder.productImage || fallbackImg,
              minutesAgo: randomOrder.minutesAgo || 'অল্প কিছুক্ষণ'
            });
            setIsVisible(true);

            // Play notification chime
            playNotificationChime();

            // Auto hide after 6 seconds
            setTimeout(() => {
              setIsVisible(false);
            }, 6000);
          }
        }
      } catch {
        // Silently skip if no real orders
      }
    };

    // First check after 10s, then repeat every 35s
    timeoutId = setTimeout(() => {
      checkRealOrders();
      intervalId = setInterval(checkRealOrders, 35000);
    }, 10000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [products]);

  if (!isVisible || !currentSale) return null;

  return (
    <div className="fixed bottom-20 left-4 sm:left-6 z-40 max-w-[320px] sm:max-w-sm bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-2xl border border-slate-200/90 text-slate-800 animate-in slide-in-from-bottom-5 duration-300 select-none">
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
          <img 
            src={currentSale.productImage} 
            alt={currentSale.productTitle} 
            className="w-full h-full object-cover" 
          />
          <div className="absolute top-0.5 right-0.5 p-0.5 bg-emerald-500 rounded-full text-white">
            <CheckCircle2 className="w-2.5 h-2.5" />
          </div>
        </div>

        <div className="flex-1 min-w-0 pr-2">
          <p className="text-[11px] font-medium text-slate-500 leading-tight">
            <span className="font-extrabold text-slate-900">{currentSale.buyer}</span> ({currentSale.city} থেকে)
          </p>
          <h4 className="text-xs font-bold text-slate-900 truncate mt-0.5" title={currentSale.productTitle}>
            {currentSale.productTitle}
          </h4>
          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" />
            <span>{currentSale.minutesAgo} মিনিট আগে অর্ডার করেছেন</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer self-start"
          aria-label="Close notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
