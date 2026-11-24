import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { dbService } from '../lib/dbService';
import { MediaQrItem, EcomSettings } from '../types';
import { 
  Play, 
  ExternalLink, 
  BookOpen, 
  ArrowLeft, 
  Share2, 
  Check, 
  Film,
  Maximize,
  Sparkles,
  ChevronRight,
  Award,
  GraduationCap
} from 'lucide-react';

export default function MediaViewerPage() {
  const { code } = useParams<{ code: string }>();
  const [item, setItem] = useState<MediaQrItem | null>(null);
  const [allItems, setAllItems] = useState<MediaQrItem[]>([]);
  const [settings, setSettings] = useState<EcomSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!code) {
        setIsLoading(false);
        return;
      }
      try {
        const [found, list, ecomSettings] = await Promise.all([
          dbService.getMediaQrItem(code),
          dbService.getMediaQrItems().catch(() => []),
          dbService.getEcomSettings().catch(() => null)
        ]);
        if (isMounted) {
          setItem(found);
          setAllItems(list || []);
          setSettings(ecomSettings);
        }
      } catch (err) {
        console.error('Failed to load media item:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [code]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFullScreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if ((videoRef.current as any).webkitEnterFullscreen) {
        (videoRef.current as any).webkitEnterFullscreen();
      }
    }
  };

  const extractYouTubeId = (url: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const storeLogo = settings?.storeLogo || settings?.headerSettings?.logoUrl || '';
  const storeName = (settings?.storeName || 'Bangladesh Handwriting Association').trim();
  const fbLink = 'https://www.facebook.com/bangladeshhandwritingassociation';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          <GraduationCap className="w-6 h-6 text-amber-400 absolute inset-0 m-auto" />
        </div>
        <p className="text-sm font-semibold text-slate-300 mt-4 tracking-wide animate-pulse">ভিডিও লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-xl">
          <Film className="w-10 h-10 text-rose-500" />
        </div>
        <h1 className="text-xl font-bold mb-2">ভিডিও বা লেসনটি পাওয়া যায়নি</h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-sm mb-6">
          QR কোডের লিঙ্কটি সঠিক নয় অথবা মিডিয়াটি এখনো যোগ করা হয়নি।
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black uppercase tracking-wider hover:brightness-110 shadow-lg shadow-orange-500/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>মূল ওয়েবসাইটে ফিরে যান</span>
        </Link>
      </div>
    );
  }

  const isYouTube = item.mediaType === 'youtube' || (item.fileUrl && (item.fileUrl.includes('youtube.com') || item.fileUrl.includes('youtu.be')));
  const ytId = isYouTube ? extractYouTubeId(item.youtubeUrl || item.fileUrl) : null;
  const isVideo = item.mediaType === 'video' || (!isYouTube && (item.fileUrl.endsWith('.mp4') || item.fileUrl.endsWith('.webm') || item.fileUrl.endsWith('.mov')));

  const relatedVideos = allItems.filter(m => (m.shortCode !== item.shortCode && m.id !== item.id));

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col selection:bg-amber-400 selection:text-black font-sans relative overflow-x-hidden">
      
      {/* Background Colorful Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-600/15 via-indigo-600/20 to-amber-500/15 blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-0 w-[300px] h-[300px] bg-emerald-500/10 blur-[100px] pointer-events-none -z-10" />

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#0b1120]/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 shadow-xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white text-xs font-bold transition group"
          >
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition">
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>
            <span className="hidden sm:inline">হোমে যান</span>
          </Link>

          {/* Center Brand Identity (Store logo + Bangladesh Handwriting Association) */}
          <a
            href={fbLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:scale-102"
            title="Bangladesh Handwriting Association"
          >
            {storeLogo ? (
              <img 
                src={storeLogo} 
                alt="Bangladesh Handwriting Association" 
                className="w-6 h-6 object-contain rounded-full shadow-sm ring-1 ring-amber-400/50" 
              />
            ) : (
              <Award className="w-4 h-4 text-amber-400" />
            )}
            <span className="text-xs font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-400 truncate max-w-[200px] sm:max-w-none">
              {storeName}
            </span>
            <ExternalLink className="w-3 h-3 text-amber-400/80 shrink-0 hidden sm:inline" />
          </a>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition transform active:scale-95"
              title="শেয়ার লিঙ্ক কপি করুন"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'কপি হয়েছে' : 'শেয়ার'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
        
        {/* Official Header Title & Horizontal Links (Facebook & Website) */}
        <div className="flex flex-col items-center justify-center text-center mb-6 max-w-2xl px-2">
          {/* Main Title: Bangladesh Handwriting Association */}
          <h2 className="text-sm sm:text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-300 uppercase tracking-wider mb-3">
            Bangladesh Handwriting Association
          </h2>

          {/* Horizontal Row: Facebook & Website Buttons side by side */}
          <div className="flex items-center justify-center gap-3">
            <a
              href="https://www.facebook.com/bangladeshhandwritingassociation/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1877F2]/90 hover:bg-[#1877F2] text-white text-xs font-bold shadow-md shadow-blue-600/30 transition transform hover:scale-102 active:scale-95 border border-blue-400/30"
              title="Visit Official Facebook Page"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Facebook Page</span>
              <ExternalLink className="w-3 h-3 text-blue-200" />
            </a>

            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 hover:text-white text-xs font-bold shadow-md transition transform hover:scale-102 active:scale-95 border border-white/10"
              title="Visit Main Website"
            >
              <ExternalLink className="w-4 h-4 text-amber-400" />
              <span>Website</span>
            </Link>
          </div>

          {/* Video / Lesson Title */}
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-tight text-white drop-shadow-sm mt-5">
            {item.title}
          </h1>
          {item.pageNumber && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-400/40 text-emerald-300 text-xs font-black shadow-md">
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>পৃষ্ঠা নং: {item.pageNumber}</span>
            </div>
          )}
        </div>

        {/* Media Player Frame with Vibrant Glowing Border */}
        <div className="w-full aspect-video bg-black rounded-3xl overflow-hidden border-2 border-indigo-500/30 shadow-[0_0_50px_-12px_rgba(99,102,241,0.3)] relative flex items-center justify-center group ring-1 ring-white/10">
          {isYouTube ? (
            ytId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                title={item.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <a
                href={item.youtubeUrl || item.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm shadow-xl shadow-rose-600/30 transition transform hover:scale-102"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>YouTube এ ভিডিওটি দেখুন</span>
              </a>
            )
          ) : isVideo ? (
            <>
              <video
                ref={videoRef}
                src={item.fileUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain cursor-pointer"
                onClick={handleFullScreen}
              />
              <button
                type="button"
                onClick={handleFullScreen}
                className="absolute top-4 right-4 p-2.5 rounded-xl bg-black/60 hover:bg-black/90 text-white backdrop-blur-md opacity-80 hover:opacity-100 transition-all pointer-events-auto border border-white/20 shadow-lg"
                title="ফুল স্ক্রিন করুন"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </>
          ) : (
            <img
              src={item.fileUrl}
              alt={item.title}
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Video Below: Instructions & Lesson Description */}
        {item.description && (
          <div className="mt-5 w-full bg-gradient-to-br from-slate-900/90 to-indigo-950/40 border border-indigo-500/20 rounded-3xl p-5 sm:p-6 text-left shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                শিক্ষার্থীদের জন্য গুরুত্বপূর্ণ নির্দেশনা:
              </h3>
            </div>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed whitespace-pre-wrap font-medium">
              {item.description}
            </p>
          </div>
        )}



        {/* Related / More Videos Section */}
        {relatedVideos.length > 0 && (
          <div className="mt-8 w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-5 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
                <h2 className="text-base sm:text-lg font-black text-white">
                  পরবর্তী লেসনসমূহ (More Lessons)
                </h2>
              </div>
              <span className="text-xs font-bold text-amber-300/80 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                মোট {relatedVideos.length} টি ভিডিও
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {relatedVideos.slice(0, 8).map((rel) => {
                const relIsYt = rel.mediaType === 'youtube' || (rel.fileUrl && (rel.fileUrl.includes('youtube') || rel.fileUrl.includes('youtu.be')));
                const relYtId = relIsYt ? extractYouTubeId(rel.youtubeUrl || rel.fileUrl) : null;
                const thumb = relYtId 
                  ? `https://img.youtube.com/vi/${relYtId}/hqdefault.jpg`
                  : rel.mediaType === 'image' 
                    ? rel.fileUrl 
                    : null;

                return (
                  <Link
                    key={rel.id}
                    to={`/learn/${rel.shortCode}`}
                    className="flex items-center gap-3.5 p-3 rounded-2xl bg-gradient-to-r from-slate-900/90 to-indigo-950/50 hover:from-slate-850 hover:to-indigo-900/60 border border-white/10 hover:border-amber-400/50 transition-all shadow-md hover:shadow-indigo-500/20 group hover:scale-[1.01]"
                  >
                    <div className="w-22 h-15 rounded-xl bg-slate-800 shrink-0 overflow-hidden relative flex items-center justify-center border border-white/10">
                      {thumb ? (
                        <img src={thumb} alt={rel.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <Film className="w-6 h-6 text-slate-400" />
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs">
                        <Play className="w-5 h-5 text-amber-400 fill-amber-400" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      {rel.pageNumber && (
                        <span className="inline-block text-[10px] font-black text-amber-300 bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-md mb-1">
                          পৃষ্ঠা {rel.pageNumber}
                        </span>
                      )}
                      <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-200 transition-colors line-clamp-2">
                        {rel.title}
                      </h4>
                      {rel.bookTitle && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {rel.bookTitle}
                        </p>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Back to Official Store Button */}
        <div className="mt-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-indigo-900 hover:to-slate-800 text-slate-200 hover:text-white border border-indigo-500/30 text-xs font-bold transition shadow-lg shadow-indigo-950/40"
          >
            <span>আমাদের মূল ওয়েবসাইট ভিজিট করুন</span>
            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
          </Link>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="py-6 border-t border-white/10 text-center text-xs text-slate-500 bg-[#060910]">
        © {new Date().getFullYear()} {storeName} — Smart Learning Platform
      </footer>
    </div>
  );
}
