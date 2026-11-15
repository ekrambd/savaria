import React, { useState } from 'react';
import { 
  X, Zap, ShoppingBag, ShieldCheck, CheckCircle2, Phone, MapPin, User, ArrowRight 
} from 'lucide-react';
import { Product } from '../types';

interface FastCheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onOrderSuccess: (orderData: { name: string; phone: string; address: string; quantity: number }) => void;
  primaryColor?: string;
}

export const FastCheckoutDrawer: React.FC<FastCheckoutDrawerProps> = ({
  isOpen,
  onClose,
  product,
  onOrderSuccess,
  primaryColor = '#2563eb'
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !product) return null;

  const unitPrice = product.price || 0;
  const totalPrice = unitPrice * quantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!customerName.trim()) {
      setErrorMsg('দয়া করে আপনার নাম লিখুন');
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 11) {
      setErrorMsg('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন');
      return;
    }

    if (!customerAddress.trim()) {
      setErrorMsg('দেলিভারি ঠিকানা ও জেলা লিখুন');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      onOrderSuccess({
        name: customerName.trim(),
        phone: customerPhone.trim(),
        address: customerAddress.trim(),
        quantity
      });
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none animate-in fade-in duration-200">
      <div 
        className="absolute inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity cursor-pointer" 
        onClick={onClose}
      />

      <div className="fixed inset-x-0 bottom-0 max-h-[92vh] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563eb] flex items-center justify-center font-bold">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                ১-ক্লিক ফাস্ট অর্ডার (Cash on Delivery)
              </h3>
              <p className="text-[11px] text-slate-500">পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Snapshot */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-white">
          <img 
            src={product.coverImage || product.image || '/images/meghbristi-brand-logo.svg'} 
            alt={product.title} 
            className="w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0" 
          />
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{product.title}</h4>
            <div className="flex items-center justify-between mt-1">
              <span className="font-black text-[#2563eb] text-sm sm:text-base">Tk. {unitPrice}</span>
              
              {/* Qty Controls */}
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2 py-0.5 bg-slate-50 text-xs font-bold">
                <button 
                  type="button" 
                  onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                  className="hover:text-[#2563eb] cursor-pointer"
                >
                  -
                </button>
                <span className="w-4 text-center">{quantity}</span>
                <button 
                  type="button" 
                  onClick={() => setQuantity(prev => prev + 1)}
                  className="hover:text-[#2563eb] cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3.5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              আপনার নাম *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="যেমন: মোঃ রাকিবুল হাসান"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              মোবাইল নম্বর *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                placeholder="01XXXXXXXXX"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              সম্পূর্ণ ঠিকানা ও জেলা *
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <textarea
                rows={2}
                placeholder="বাসা নং, রোড, থানা এবং জেলা"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>পণ্যের মোট মূল্য:</span>
              <span className="font-bold">Tk. {totalPrice}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>ডেলিভারি চার্জ:</span>
              <span className="font-semibold text-emerald-600">চেকআউট বা লোকেশনে প্রযোজ্য</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-98 text-white font-extrabold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{isSubmitting ? 'অর্ডার কনফার্ম হচ্ছে...' : 'অর্ডার কনফার্ম করুন (Confirm Order)'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
};
