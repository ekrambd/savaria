import React, { useState, useEffect } from 'react';
import { EcomSettings } from '../types';
import { dbService } from '../lib/dbService';
import { CircularProgress } from './LoadingSkeleton';
import { 
  Truck, Check, Save, RefreshCw, Send, AlertCircle, 
  Globe, Copy, CheckCircle2, Zap, ChevronDown, Key, Lock, Eye, EyeOff
} from 'lucide-react';
import { ApiClient } from '../services/apiClient';
import { FeedbackDialog } from './ui/FeedbackDialog';

export default function CourierSettingsManager() {
  const [settings, setSettings] = useState<EcomSettings>({
    gtmId: '',
    deliveryChargeInsideDhaka: 80,
    deliveryChargeOutsideDhaka: 130,
    bkashNumber: '',
    nagadNumber: '',
    defaultCourierProvider: 'pathao',
    pathaoClientId: '',
    pathaoClientSecret: '',
    pathaoClientEmail: '',
    pathaoClientPassword: '',
    pathaoStoreId: '',
    pathaoEnvironment: 'production',
    steadfastApiKey: '',
    steadfastSecretKey: '',
    steadfastBaseUrl: 'https://portal.packzy.com/api/v1'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
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

  // Password / Secret visibility toggles
  const [showPathaoSecret, setShowPathaoSecret] = useState(false);
  const [showPathaoPassword, setShowPathaoPassword] = useState(false);
  const [showSteadfastSecret, setShowSteadfastSecret] = useState(false);

  // Pathao Test State
  const [pathaoTestStatus, setPathaoTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [pathaoTestMessage, setPathaoTestMessage] = useState('');
  const [pathaoStoresCount, setPathaoStoresCount] = useState<number | null>(null);

  // Steadfast Test State
  const [steadfastTestStatus, setSteadfastTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [steadfastTestMessage, setSteadfastTestMessage] = useState('');
  const [steadfastBalance, setSteadfastBalance] = useState<number | null>(null);

  // Webhook copy
  const [webhookCopied, setWebhookCopied] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await dbService.getEcomSettings();
        if (data) {
          setSettings(prev => ({
            ...prev,
            ...data,
            defaultCourierProvider: data.defaultCourierProvider || 'pathao',
            steadfastBaseUrl: data.steadfastBaseUrl || 'https://portal.packzy.com/api/v1'
          }));
        }
      } catch (err) {
        console.error('Failed to load courier settings:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await dbService.saveEcomSettings(settings);
      setSaveSuccess(true);
      setFeedback({
        isOpen: true,
        type: 'success',
        title: 'কুরিয়ার সেটিংস সংরক্ষিত হয়েছে!',
        message: 'Pathao এবং Steadfast ক্রেডেনশিয়াল এবং সেটিংস সফলভাবে আপডেট হয়েছে।'
      });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving courier settings:', err);
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'সংরক্ষণ ব্যর্থ হয়েছে',
        message: 'কুরিয়ার সেটিংস সংরক্ষণ করার সময় সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPathao = async () => {
    setPathaoTestStatus('testing');
    setPathaoTestMessage('');
    try {
      const result = await ApiClient.testPathao({
        clientId: settings.pathaoClientId,
        clientSecret: settings.pathaoClientSecret,
        clientEmail: settings.pathaoClientEmail,
        clientPassword: settings.pathaoClientPassword,
        storeId: settings.pathaoStoreId,
        environment: settings.pathaoEnvironment
      });
      setPathaoTestStatus('success');
      setPathaoTestMessage(result.message || 'Pathao কানেকশন সফলভাবে ভেরিফাই হয়েছে!');
      if (typeof result.storesCount === 'number') {
        setPathaoStoresCount(result.storesCount);
      }
    } catch (error: any) {
      setPathaoTestStatus('error');
      setPathaoTestMessage(error?.message || 'Pathao কানেকশন ব্যর্থ হয়েছে');
    }
  };

  const handleTestSteadfast = async () => {
    setSteadfastTestStatus('testing');
    setSteadfastTestMessage('');
    try {
      const result = await ApiClient.testSteadfast({
        apiKey: settings.steadfastApiKey,
        secretKey: settings.steadfastSecretKey,
        baseUrl: settings.steadfastBaseUrl
      });
      setSteadfastTestStatus('success');
      setSteadfastTestMessage(result.message || 'Steadfast কানেকশন সফলভাবে ভেরিফাই হয়েছে!');
      if (typeof result.balance === 'number') {
        setSteadfastBalance(result.balance);
      }
    } catch (error: any) {
      setSteadfastTestStatus('error');
      setSteadfastTestMessage(error?.message || 'Steadfast কানেকশন ব্যর্থ হয়েছে');
    }
  };

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/courier/pathao/webhook` 
    : 'https://savaria.com/api/courier/pathao/webhook';

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2500);
  };

  if (isLoading) {
    return (
      <CircularProgress label="কুরিয়ার সেটিংস লোড হচ্ছে..." size="md" />
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 font-sans max-w-4xl mx-auto pb-16">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-teal-50 text-teal-600 rounded-2xl">
              <Truck className="h-5 w-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Courier API Integrations
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Pathao ও Steadfast এর ক্রেডেনশিয়াল এডমিন প্যানেল থেকেই সেভ করুন এবং টেস্ট করুন (.env এর প্রয়োজন নেই)
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold shadow-md transition-all hover:shadow-lg disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              সংরক্ষণ হচ্ছে...
            </span>
          ) : saveSuccess ? (
            <>
              <Check className="h-4 w-4 mr-1.5 text-emerald-300" />
              সংরক্ষিত হয়েছে!
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1.5" />
              সেটিংস সংরক্ষণ করুন
            </>
          )}
        </button>
      </div>

      {/* Default Courier Provider Selector */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="space-y-1 border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            ডিফল্ট কুরিয়ার সার্ভিস নির্বাচন করুন (Primary Courier)
          </h3>
          <p className="text-xs text-slate-500">
            অর্ডারের সময় কোন কুরিয়ারটি প্রাইমারি চয়েস হিসেবে বিবেচিত হবে
          </p>
        </div>

        <div className="max-w-md pt-1">
          <div className="relative">
            <select
              value={settings.defaultCourierProvider || 'pathao'}
              onChange={(e) => setSettings({ ...settings, defaultCourierProvider: e.target.value as any })}
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-xs font-extrabold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none pr-10 cursor-pointer"
            >
              <option value="pathao">Pathao Courier (পাঠাও কুরিয়ার - অটো রেট ও ডিসপ্যাচ)</option>
              <option value="steadfast">Steadfast Courier (স্টেডফাস্ট কুরিয়ার - ক্যাশ অন ডেলিভারি)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Vertical Courier Connections List */}
      <div className="space-y-6">
        <div className="px-1">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Courier Connections & Credentials
          </h3>
        </div>

        {/* ============================================================== */}
        {/* 1. PATHAO COURIER BOX */}
        {/* ============================================================== */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-600 text-white font-black flex items-center justify-center text-base shadow-sm shrink-0">
                P
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Pathao Courier (পাঠাও কুরিয়ার)</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  {pathaoTestStatus === 'idle' && (
                    <span className="inline-flex items-center text-[11px] font-bold text-slate-400">
                      ক্রেডেনশিয়াল ইনপুট দিয়ে টেস্ট করুন
                    </span>
                  )}
                  {pathaoTestStatus === 'testing' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 animate-pulse">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      ভেরিফাই হচ্ছে...
                    </span>
                  )}
                  {pathaoTestStatus === 'success' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      কানেকশন সক্রিয় ও ভেরিফাইড
                    </span>
                  )}
                  {pathaoTestStatus === 'error' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      কানেকশন ত্রুটি
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestPathao}
              disabled={pathaoTestStatus === 'testing'}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl font-extrabold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
            >
              {pathaoTestStatus === 'testing' ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  যাচাই চলছে...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  কানেকশন টেস্ট করুন
                </>
              )}
            </button>
          </div>

          {/* Test Status Messages */}
          {pathaoTestStatus === 'success' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-xs text-emerald-800 font-semibold animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{pathaoTestMessage}</span>
              </div>
              {typeof pathaoStoresCount === 'number' && (
                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg">
                  স্টোর সংখ্যা: {pathaoStoresCount}টি
                </span>
              )}
            </div>
          )}

          {pathaoTestStatus === 'error' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2 text-rose-800 text-xs font-semibold animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{pathaoTestMessage}</span>
            </div>
          )}

          {/* Pathao Credentials Input Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Client ID *
              </label>
              <input
                type="text"
                placeholder="उदा. 7N1aMJQbWm"
                value={settings.pathaoClientId || ''}
                onChange={(e) => setSettings({ ...settings, pathaoClientId: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Client Secret *
              </label>
              <div className="relative">
                <input
                  type={showPathaoSecret ? 'text' : 'password'}
                  placeholder="Pathao Client Secret"
                  value={settings.pathaoClientSecret || ''}
                  onChange={(e) => setSettings({ ...settings, pathaoClientSecret: e.target.value })}
                  className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPathaoSecret(!showPathaoSecret)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPathaoSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Client Email (Username) *
              </label>
              <input
                type="email"
                placeholder="merchant@example.com"
                value={settings.pathaoClientEmail || ''}
                onChange={(e) => setSettings({ ...settings, pathaoClientEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Client Password *
              </label>
              <div className="relative">
                <input
                  type={showPathaoPassword ? 'text' : 'password'}
                  placeholder="Pathao Account Password"
                  value={settings.pathaoClientPassword || ''}
                  onChange={(e) => setSettings({ ...settings, pathaoClientPassword: e.target.value })}
                  className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPathaoPassword(!showPathaoPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPathaoPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Store ID (ঐচ্ছিক - খালি রাখলে ১ম স্টোর ব্যবহৃত হবে)
              </label>
              <input
                type="text"
                placeholder="उदा. 12345"
                value={settings.pathaoStoreId || ''}
                onChange={(e) => setSettings({ ...settings, pathaoStoreId: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Environment
              </label>
              <select
                value={settings.pathaoEnvironment || 'production'}
                onChange={(e) => setSettings({ ...settings, pathaoEnvironment: e.target.value as any })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
              >
                <option value="production">Production (লাইভ কুরিয়ার)</option>
                <option value="sandbox">Sandbox (টেস্টিং মোড)</option>
              </select>
            </div>
          </div>

          {/* Webhook copy row */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 gap-2">
            <span className="text-[11px] flex items-center gap-1 font-medium text-slate-500">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              Pathao Webhook URL (অটো স্ট্যাটাস আপডেটের জন্য পাঠাও পোর্টালে দিন):
            </span>
            <button
              type="button"
              onClick={handleCopyWebhook}
              className="text-[11px] font-bold text-red-600 hover:text-red-700 cursor-pointer flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded-lg"
            >
              {webhookCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {webhookCopied ? 'কপি হয়েছে' : 'লিংক কপি করুন'}
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. STEADFAST COURIER BOX */}
        {/* ============================================================== */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-700 text-white font-black flex items-center justify-center text-base shadow-sm shrink-0">
                S
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Steadfast Courier (স্টেডফাস্ট কুরিয়ার)</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  {steadfastTestStatus === 'idle' && (
                    <span className="inline-flex items-center text-[11px] font-bold text-slate-400">
                      API Key ও Secret Key দিয়ে কানেকশন টেস্ট করুন
                    </span>
                  )}
                  {steadfastTestStatus === 'testing' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 animate-pulse">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      ভেরিফাই হচ্ছে...
                    </span>
                  )}
                  {steadfastTestStatus === 'success' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      কানেকশন সক্রিয় ও ভেরিফাইড
                    </span>
                  )}
                  {steadfastTestStatus === 'error' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      কানেকশন ত্রুটি
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestSteadfast}
              disabled={steadfastTestStatus === 'testing'}
              className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white rounded-xl font-extrabold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
            >
              {steadfastTestStatus === 'testing' ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  যাচাই চলছে...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  কানেকশন টেস্ট করুন
                </>
              )}
            </button>
          </div>

          {/* Test Status Messages */}
          {steadfastTestStatus === 'success' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-xs text-emerald-800 font-semibold animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{steadfastTestMessage}</span>
              </div>
              {typeof steadfastBalance === 'number' && (
                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg">
                  বর্তমান ব্যালেন্স: ৳{steadfastBalance}
                </span>
              )}
            </div>
          )}

          {steadfastTestStatus === 'error' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2 text-rose-800 text-xs font-semibold animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{steadfastTestMessage}</span>
            </div>
          )}

          {/* Steadfast Credentials Input Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Steadfast API Key *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Steadfast API Key"
                  value={settings.steadfastApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, steadfastApiKey: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Steadfast Secret Key *
              </label>
              <div className="relative">
                <input
                  type={showSteadfastSecret ? 'text' : 'password'}
                  placeholder="Steadfast Secret Key"
                  value={settings.steadfastSecretKey || ''}
                  onChange={(e) => setSettings({ ...settings, steadfastSecretKey: e.target.value })}
                  className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSteadfastSecret(!showSteadfastSecret)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showSteadfastSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Steadfast API Base URL
              </label>
              <input
                type="text"
                placeholder="https://portal.packzy.com/api/v1"
                value={settings.steadfastBaseUrl || 'https://portal.packzy.com/api/v1'}
                onChange={(e) => setSettings({ ...settings, steadfastBaseUrl: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button at Bottom */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center justify-center px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-extrabold shadow-md transition-all hover:shadow-lg disabled:opacity-50 cursor-pointer gap-2"
        >
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              সংরক্ষণ হচ্ছে...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              কুরিয়ার ক্রেডেনশিয়াল ও সেটিংস সংরক্ষণ করুন
            </>
          )}
        </button>
      </div>

      {/* Reusable Centered Feedback Dialog */}
      <FeedbackDialog
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
      />
    </form>
  );
}
