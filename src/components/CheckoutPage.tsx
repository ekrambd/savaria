import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  CheckCircle2, 
  MessageCircle, 
  Award, 
  Coins, 
  Check, 
  AlertCircle,
  Tag
} from 'lucide-react';
import { Product, BookOrder, EcomSettings, Coupon } from '../types';
import { dbService } from '../lib/dbService';
import { getCustomerSession, setCustomerSession } from '../lib/customerAuth';
import { trackEvent, createEventId } from '../lib/pixelGtmService';

interface CartItem {
  product: Product;
  quantity: number;
  variant?: any;
  selectedColor?: string;
  selectedSize?: string;
  selectedVariant?: string;
}

interface CheckoutPageProps {
  cart: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  ecomSettings: EcomSettings;
  onNavigateHome: () => void;
  onNavigateShop: () => void;
  onOpenLoginModal?: () => void;
}

export default function CheckoutPage({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  ecomSettings,
  onNavigateHome,
  onNavigateShop,
  onOpenLoginModal
}: CheckoutPageProps) {
  // Pre-fill user data if logged in
  const initialCustomer = useMemo(() => getCustomerSession(), []);
  const [name, setName] = useState(() => initialCustomer?.name || '');
  const [phone, setPhone] = useState(() => initialCustomer?.phone || '');
  const [address, setAddress] = useState('');

  // Delivery zone: 'inside' (ঢাকার ভিতরে) or 'outside' (ঢাকার বাহিরে)
  const [deliveryArea, setDeliveryArea] = useState<'inside' | 'outside'>('inside');

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  // Form submission & state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [orderSuccess, setOrderSuccess] = useState<BookOrder | null>(null);

  // Delivery rates from store settings or defaults matching screenshot
  const insideDhakaRate = Number(ecomSettings?.deliveryChargeInsideDhaka ?? 80);
  const outsideDhakaRate = Number(ecomSettings?.deliveryChargeOutsideDhaka ?? 150);
  const freeDeliveryThreshold = Number(ecomSettings?.freeDeliveryThreshold ?? 999);

  // Calculate cart subtotal
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (Number(item.product.price) || 0) * item.quantity, 0);
  }, [cart]);

  // Check if eligible for free delivery
  const isFreeDelivery = cartSubtotal >= freeDeliveryThreshold && freeDeliveryThreshold > 0;
  const remainingForFree = Math.max(0, freeDeliveryThreshold - cartSubtotal);

  // Actual delivery charge
  const deliveryCost = isFreeDelivery ? 0 : (deliveryArea === 'inside' ? insideDhakaRate : outsideDhakaRate);

  // Coupon discount calculation
  const couponDiscountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percent') {
      const disc = Math.round((cartSubtotal * appliedCoupon.discount) / 100);
      return appliedCoupon.maxDiscount ? Math.min(disc, appliedCoupon.maxDiscount) : disc;
    }
    return Math.min(appliedCoupon.discount, cartSubtotal);
  }, [appliedCoupon, cartSubtotal]);

  // Grand total
  const grandTotal = Math.max(0, cartSubtotal + deliveryCost - couponDiscountAmount);

  // Track InitiateCheckout on page view
  useEffect(() => {
    if (cart.length > 0) {
      const eventId = createEventId('initiate_checkout');
      trackEvent('InitiateCheckout', {
        content_name: cart.map(i => i.product.title).join(', '),
        content_ids: cart.map(i => i.product.id),
        content_type: 'product',
        value: grandTotal,
        currency: 'BDT',
        num_items: cart.reduce((sum, i) => sum + i.quantity, 0)
      }, eventId);
    }
  }, []);

  // Debounced real-time abandoned cart auto-capture when phone has >= 10 digits
  useEffect(() => {
    if (cart.length === 0 || orderSuccess) return;
    const cleanDigits = (phone || '').replace(/\D/g, '');
    const cleanPhone = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : '';
    if (!cleanPhone || cleanPhone.length < 10) return;

    const timer = setTimeout(async () => {
      try {
        await dbService.captureAbandonedCart({
          customerPhone: (phone || '').trim(),
          customerName: name.trim() || undefined,
          customerAddress: address.trim() || undefined,
          customerDistrict: deliveryArea === 'inside' ? 'Dhaka' : 'Outside Dhaka',
          items: cart.map(item => ({
            productId: item.product.id,
            productTitle: item.product.title,
            productImage: item.product.coverImage || (item.product.images && item.product.images[0]) || '',
            unitPrice: item.product.price,
            quantity: item.quantity,
            variant: item.selectedColor || item.selectedSize || item.selectedVariant
          })),
          subtotal: cartSubtotal,
          deliveryCharge: deliveryCost,
          totalAmount: grandTotal,
          source: 'storefront_checkout'
        });
      } catch (err) {
        console.warn('[CheckoutPage] Abandoned cart capture error:', err);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [phone, name, address, cart, cartSubtotal, deliveryCost, grandTotal, deliveryArea, orderSuccess]);

  // Handle coupon apply
  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCouponError('');
    setCouponSuccess('');

    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponError('অনুগ্রহ করে কুপন কোড লিখুন');
      return;
    }

    try {
      const coupons = await dbService.getCoupons();
      const match = coupons.find(c => c.code.toUpperCase() === code && c.status === 'Active');

      if (!match) {
        setCouponError('কুপন কোডটি সঠিক নয় বা মেয়াদ শেষ!');
        return;
      }

      if (match.minOrderAmount && cartSubtotal < match.minOrderAmount) {
        setCouponError(`এই কুপন ব্যবহারের জন্য ন্যূনতম ৳${match.minOrderAmount} টাকার অর্ডার করতে হবে`);
        return;
      }

      setAppliedCoupon(match);
      setCouponSuccess(`কুপন '${match.code}' সফলভাবে যুক্ত হয়েছে!`);
    } catch {
      setCouponError('কুপন যাচাই করতে সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponSuccess('');
    setCouponError('');
  };

  // Handle Order Submit
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (cart.length === 0) {
      setErrorMessage('আপনার কার্ট খালি রয়েছে! কিছু পণ্য যোগ করে অর্ডার করুন।');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('অনুগ্রহ করে আপনার সঠিক নাম লিখুন।');
      return;
    }

    const trimmedPhone = phone.trim().replace(/[\s-]/g, '');
    const bdPhoneRegex = /^(?:\+?88|88)?(01[3-9]\d{8})$/;
    if (!bdPhoneRegex.test(trimmedPhone)) {
      setErrorMessage('অনুগ্রহ করে একটি সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।');
      return;
    }

    const trimmedAddress = address.trim();
    if (!trimmedAddress || trimmedAddress.length < 5) {
      setErrorMessage('অনুগ্রহ করে আপনার পূর্ণাঙ্গ শিপিং ঠিকানা লিখুন (যেমন: বাড়ি/রোড/এলাকা/উপজেলা/জেলা)।');
      return;
    }

    setIsSubmitting(true);

    try {
      const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
      const deliveryZoneName = deliveryArea === 'inside' ? 'ঢাকার ভিতরে' : 'ঢাকার বাহিরে';

      const orderPayload: BookOrder = {
        id: `MB-${Date.now().toString().slice(-6)}`,
        customerName: trimmedName,
        customerPhone: trimmedPhone,
        phone: trimmedPhone,
        address: trimmedAddress,
        deliveryZone: deliveryZoneName,
        deliveryCharge: deliveryCost,
        totalAmount: grandTotal,
        totalPrice: grandTotal,
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'Pending',
        status: 'Pending',
        orderDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        quantity: totalItemCount,
        couponCode: appliedCoupon?.code,
        couponDiscount: couponDiscountAmount > 0 ? couponDiscountAmount : undefined,
        items: cart.map(item => ({
          product: {
            id: item.product.id,
            title: item.product.title,
            price: item.product.price,
            regularPrice: item.product.regularPrice,
            image: item.product.coverImage || (item.product.images && item.product.images[0]) || '',
            category: item.product.category,
            stock: item.product.stock || 100,
            isAvailable: true
          },
          quantity: item.quantity,
          variant: item.selectedColor || item.selectedSize || item.selectedVariant
        }))
      };

      let confirmedOrder: BookOrder = orderPayload;
      let orderCreatedViaServer = false;

      // 1. Try atomic server checkout endpoint
      try {
        const response = await fetch('/api/orders/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: trimmedName,
            phone: trimmedPhone,
            address: trimmedAddress,
            deliveryZone: deliveryZoneName,
            deliveryCharge: deliveryCost,
            deliveryFee: deliveryCost,
            paymentMethod: 'Cash on Delivery',
            couponCode: appliedCoupon?.code,
            items: cart.map(i => ({
              productId: i.product.id,
              quantity: i.quantity,
              variant: i.selectedColor || i.selectedSize || i.selectedVariant,
              price: i.product.price
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
        // Fallback to local db service
      }

      // 2. Fallback / Sync with client DB
      if (!orderCreatedViaServer) {
        await dbService.addBookOrder(orderPayload);
      } else {
        await dbService.saveBookOrderLocally(confirmedOrder);
      }

      // 3. Meta Pixel / GTM Purchase tracking
      const purchaseEventId = createEventId('purchase');
      trackEvent('Purchase', {
        content_name: cart.map(i => i.product.title).join(', '),
        content_ids: cart.map(i => i.product.id),
        content_type: 'product',
        value: grandTotal,
        currency: 'BDT',
        num_items: totalItemCount,
        contents: cart.map(item => ({
          id: item.product.id,
          name: item.product.title,
          quantity: item.quantity,
          item_price: item.product.price
        }))
      }, purchaseEventId);

      // Save customer session for quick return
      setCustomerSession({
        name: trimmedName,
        phone: trimmedPhone
      });

      // Dismiss any matching abandoned cart immediately
      try {
        await dbService.dismissAbandonedCartByPhone(trimmedPhone, confirmedOrder.id);
      } catch {}

      // Show success screen and clear cart
      setOrderSuccess(confirmedOrder);
      onClearCart();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorMessage(err?.message || 'অর্ডার সম্পন্ন করতে সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // ORDER SUCCESS SCREEN
  // =========================================================================
  if (orderSuccess) {
    const rawWa = ecomSettings?.socialLinks?.whatsapp || ecomSettings?.contactPhone || '01910646547';
    const cleanWa = rawWa.replace(/[^0-9]/g, '');
    const storeName = ecomSettings?.storeName || 'Meghbristi Fashion';

    return (
      <div className="min-h-[75vh] bg-[#f8fafc] py-12 px-4 flex items-center justify-center font-sans">
        <div className="max-w-lg w-full bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-100 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-slate-900">অর্ডার সফলভাবে সম্পন্ন হয়েছে!</h1>
            <p className="text-sm text-slate-600">
              ধন্যবাদ <span className="font-semibold text-slate-900">{orderSuccess.customerName}</span>! আপনার অর্ডারটি আমরা গ্রহণ করেছি।
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-left space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">অর্ডার আইডি:</span>
              <span className="font-mono font-bold text-slate-900">{orderSuccess.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">সর্বমোট মূল্য:</span>
              <span className="font-bold text-[#16a34a] text-base">৳{(orderSuccess.totalAmount || orderSuccess.totalPrice || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">পেমেন্ট মেথড:</span>
              <span className="font-medium text-slate-800">ক্যাশ অন ডেলিভারি (COD)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ডেলিভারি ঠিকানা:</span>
              <span className="font-medium text-slate-800 text-right truncate max-w-[200px]">{orderSuccess.address}</span>
            </div>
          </div>

          {/* 1-Click WhatsApp Order Confirmation */}
          {cleanWa && (
            <a
              href={`https://wa.me/${cleanWa}?text=${encodeURIComponent(
                `Hello ${storeName},\nI just placed order #${orderSuccess.id} (Amount: ${(orderSuccess.totalAmount || orderSuccess.totalPrice || 0).toLocaleString()} BDT).\nCustomer: ${orderSuccess.customerName}\nPhone: ${orderSuccess.customerPhone || orderSuccess.phone}\nPlease confirm my order!`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer no-underline"
            >
              <MessageCircle className="w-5 h-5 fill-current" />
              WhatsApp-এ অর্ডার কনফার্ম করুন
            </a>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onNavigateShop}
              className="flex-1 py-3 px-4 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer"
            >
              আরও কেনাকাটা করুন
            </button>
            <button
              onClick={onNavigateHome}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-all cursor-pointer"
            >
              হোমপেজে ফিরে যান
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // EMPTY CART SCREEN
  // =========================================================================
  if (cart.length === 0) {
    return (
      <div className="min-h-[60vh] bg-slate-50 py-16 px-4 flex items-center justify-center font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm space-y-5">
          <div className="w-16 h-16 bg-emerald-50 text-[#16a34a] rounded-full flex items-center justify-center mx-auto">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800">আপনার কার্ট বর্তমানে খালি</h2>
            <p className="text-sm text-slate-500">আপনার পছন্দের কালেকশন থেকে পণ্য নির্বাচন করে কার্টে যোগ করুন।</p>
          </div>
          <button
            onClick={onNavigateShop}
            className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-sm rounded-lg shadow transition-all cursor-pointer"
          >
            শপ ভিজিট করুন
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN CHECKOUT SCREEN (Matching user reference layout)
  // =========================================================================
  return (
    <div className="bg-[#f8fafc] min-h-screen py-6 sm:py-8 font-sans">
      <div className="max-w-6xl mx-auto px-4">
        
        {/* Error Alert if any */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ================================================================ */}
          {/* LEFT COLUMN: Cart Table + "আপনার ঠিকানা" Delivery Form            */}
          {/* ================================================================ */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* 1. CART ITEMS TABLE */}
            <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-xs">
              
              {/* Dark Table Header Bar */}
              <div className="bg-[#3f3f46] text-white px-3 py-2.5 text-xs sm:text-sm font-semibold grid grid-cols-12 gap-2 items-center">
                <div className="col-span-2 text-center">ছবি</div>
                <div className="col-span-4 text-left">পণ্যের নাম</div>
                <div className="col-span-2 text-center">মূল্য</div>
                <div className="col-span-2 text-center">পরিমাণ</div>
                <div className="col-span-1 text-center">মোট</div>
                <div className="col-span-1 text-center">অ্যাকশন</div>
              </div>

              {/* Table Body Rows */}
              <div className="divide-y divide-slate-100">
                {cart.map((item, idx) => {
                  const imageSrc = item.product.coverImage || (item.product.images && item.product.images[0]) || '/placeholder.png';
                  const itemPrice = Number(item.product.price) || 0;
                  const itemTotal = itemPrice * item.quantity;
                  const variantText = item.selectedColor 
                    ? `Color : ${item.selectedColor}` 
                    : item.selectedSize 
                      ? `Size : ${item.selectedSize}` 
                      : item.selectedVariant 
                        ? `Variant : ${item.selectedVariant}` 
                        : null;

                  return (
                    <div 
                      key={`${item.product.id}-${idx}`}
                      className="px-3 py-3 grid grid-cols-12 gap-2 items-center text-xs sm:text-sm hover:bg-slate-50/50 transition-colors"
                    >
                      {/* ছবি */}
                      <div className="col-span-2 flex justify-center">
                        <img 
                          src={imageSrc} 
                          alt={item.product.title} 
                          className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded border border-slate-100 bg-white"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=200&q=80';
                          }}
                        />
                      </div>

                      {/* পণ্যের নাম */}
                      <div className="col-span-4 pr-1">
                        <span 
                          onClick={onNavigateShop} 
                          className="text-sky-600 hover:text-sky-700 hover:underline font-normal text-xs sm:text-sm line-clamp-2 cursor-pointer leading-tight"
                          title={item.product.title}
                        >
                          {item.product.title}
                        </span>
                        {variantText && (
                          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                            {variantText}
                          </p>
                        )}
                      </div>

                      {/* মূল্য */}
                      <div className="col-span-2 text-center font-medium text-slate-700">
                        {itemPrice}
                      </div>

                      {/* পরিমাণ (Red Minus, Counter Box, Green Plus) */}
                      <div className="col-span-2 flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.quantity > 1) {
                              onUpdateQuantity(item.product.id, item.quantity - 1);
                            } else {
                              onRemoveItem(item.product.id);
                            }
                          }}
                          className="w-6 h-6 rounded bg-[#ef4444] hover:bg-red-600 text-white font-bold text-xs flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                          aria-label="Decrease quantity"
                        >
                          -
                        </button>
                        
                        <div className="w-8 sm:w-9 h-6 border border-slate-200 bg-white text-center text-xs sm:text-sm font-semibold flex items-center justify-center text-slate-800">
                          {item.quantity}
                        </div>

                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                          className="w-6 h-6 rounded bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-xs flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      {/* মোট */}
                      <div className="col-span-1 text-center font-semibold text-slate-800">
                        {itemTotal}
                      </div>

                      {/* অ্যাকশন (Delete Icon) */}
                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.product.id)}
                          className="text-red-500 hover:text-red-700 p-1 transition-colors cursor-pointer"
                          aria-label="Remove item"
                          title="পণ্যটি মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. "আপনার ঠিকানা" SECTION */}
            <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-xs">
              
              {/* Dark Header */}
              <div className="bg-[#3f3f46] text-white py-2.5 px-4 text-center font-bold text-sm sm:text-base">
                আপনার ঠিকানা
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmitOrder} className="p-4 sm:p-6 space-y-4">
                
                {/* Area Selector Box with Green Dashed Border */}
                <div className="space-y-2">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    আপনার এরিয়া সিলেক্ট করুন
                  </label>

                  <div className="border border-dashed border-[#22c55e] p-3 rounded-md bg-[#f0fdf4]/30 space-y-2.5">
                    
                    {/* Free Delivery Promo Yellow Ribbon */}
                    <div className="bg-[#fffbeb] border border-[#fde047] text-[#92400e] text-xs font-medium py-1.5 px-2.5 rounded flex items-center gap-1.5">
                      <span className="text-sm">🛒</span>
                      <span>
                        {isFreeDelivery 
                          ? '🎉 অভিনন্দন! আপনি ফ্রি ডেলিভারি পাচ্ছেন!'
                          : `আর মাত্র ৳${remainingForFree} কিনলে ডেলিভারি চার্জ ফ্রি পাবেন! (ডিসকাউন্ট ছাড়া পণ্যে)`}
                      </span>
                    </div>

                    {/* Radio Options: ঢাকার ভিতরে vs ঢাকার বাহিরে */}
                    <div className="grid grid-cols-2 gap-3">
                      
                      {/* ঢাকার ভিতরে */}
                      <label 
                        onClick={() => setDeliveryArea('inside')}
                        className={`flex items-center justify-between p-2.5 rounded border cursor-pointer transition-all ${
                          deliveryArea === 'inside'
                            ? 'border-slate-400 bg-white shadow-xs font-semibold'
                            : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input 
                            type="radio" 
                            name="deliveryArea" 
                            checked={deliveryArea === 'inside'} 
                            onChange={() => setDeliveryArea('inside')}
                            className="accent-[#16a34a] w-4 h-4"
                          />
                          <span className="text-xs sm:text-sm text-slate-800">ঢাকার ভিতরে</span>
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-slate-700">
                          {isFreeDelivery ? 'ফ্রি' : `৳${insideDhakaRate}`}
                        </span>
                      </label>

                      {/* ঢাকার বাহিরে */}
                      <label 
                        onClick={() => setDeliveryArea('outside')}
                        className={`flex items-center justify-between p-2.5 rounded border cursor-pointer transition-all ${
                          deliveryArea === 'outside'
                            ? 'border-slate-400 bg-white shadow-xs font-semibold'
                            : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input 
                            type="radio" 
                            name="deliveryArea" 
                            checked={deliveryArea === 'outside'} 
                            onChange={() => setDeliveryArea('outside')}
                            className="accent-[#16a34a] w-4 h-4"
                          />
                          <span className="text-xs sm:text-sm text-slate-800">ঢাকার বাহিরে</span>
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-slate-700">
                          {isFreeDelivery ? 'ফ্রি' : `৳${outsideDhakaRate}`}
                        </span>
                      </label>

                    </div>
                  </div>
                </div>

                {/* Name & Phone Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                      নাম <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text"
                      required
                      placeholder="আপনার নাম লিখুন"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-[#16a34a] focus:ring-1 focus:ring-[#16a34a] transition-all bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                      ফোন নম্বর <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="tel"
                      required
                      placeholder="ফোন নম্বর লিখুন"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-[#16a34a] focus:ring-1 focus:ring-[#16a34a] transition-all bg-white"
                    />
                  </div>
                </div>

                {/* Full Width Address Textarea */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                    আপনার ঠিকানা <span className="text-red-500">*</span>
                  </label>
                  <textarea 
                    required
                    rows={2}
                    placeholder="আপনার শিপিং ঠিকানা লিখুন"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-[#16a34a] focus:ring-1 focus:ring-[#16a34a] transition-all bg-white resize-y"
                  />
                </div>

                {/* Confirm Order Button (Brand Green #16a34a matching green style) */}
                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 bg-[#16a34a] hover:bg-[#15803d] active:bg-[#166534] text-white font-bold text-sm sm:text-base rounded shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>অর্ডার সম্পন্ন হচ্ছে...</span>
                      </>
                    ) : (
                      <span>অর্ডার কনফার্ম করুন</span>
                    )}
                  </button>
                </div>

              </form>
            </div>

          </div>

          {/* ================================================================ */}
          {/* RIGHT COLUMN: "Cart Total" Summary Card                          */}
          {/* ================================================================ */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-md border border-slate-200 p-4 sm:p-5 shadow-xs sticky top-24 space-y-4">
              
              <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-2">
                Cart Total
              </h3>

              {/* Coupon Box */}
              <div className="space-y-1.5">
                <form onSubmit={handleApplyCoupon} className="flex">
                  <input 
                    type="text"
                    placeholder="কুপন কোড (ঐচ্ছিক)"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    disabled={!!appliedCoupon}
                    className="border border-slate-300 rounded-l px-3 py-2 text-xs sm:text-sm flex-1 focus:outline-none focus:border-[#16a34a] bg-white disabled:bg-slate-50"
                  />
                  {appliedCoupon ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 text-xs sm:text-sm font-semibold rounded-r transition-colors cursor-pointer"
                    >
                      মুছুন
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="bg-[#16a34a] hover:bg-[#15803d] text-white px-4 py-2 text-xs sm:text-sm font-semibold rounded-r transition-colors cursor-pointer"
                    >
                      প্রয়োগ করুন
                    </button>
                  )}
                </form>

                {couponSuccess && (
                  <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {couponSuccess}
                  </p>
                )}
                {couponError && (
                  <p className="text-[11px] text-red-500 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {couponError}
                  </p>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2.5 pt-2 text-xs sm:text-sm text-slate-700">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-medium text-slate-900">৳{cartSubtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600">Shipping:</span>
                  <span className="font-medium text-slate-900">
                    {deliveryCost === 0 ? 'ফ্রি' : `৳${deliveryCost.toFixed(2)}`}
                  </span>
                </div>

                {couponDiscountAmount > 0 && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 text-emerald-600">
                    <span>Discount:</span>
                    <span className="font-semibold">-৳{couponDiscountAmount.toFixed(2)}</span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="flex justify-between items-center pt-2 text-sm sm:text-base font-bold text-slate-900">
                  <span>Total:</span>
                  <span className="text-base sm:text-lg text-slate-900">
                    ৳{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Secure Cash On Delivery Badge */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-[#16a34a]"></span>
                <span>ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে মূল্য পরিশোধ)</span>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
