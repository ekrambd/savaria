import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { dbService } from '../lib/dbService';
import { MediaQrItem } from '../types';
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
  ChevronRight
} from 'lucide-react';

export default function MediaViewerPage() {
  const { code } = useParams<{ code: string }>();
  const [item, setItem] = useState<MediaQrItem | null>(null);
  const [allItems, setAllItems] = useState<MediaQrItem[]>([]);
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
        const [found, list] = await Promise.all([
          dbService.getMediaQrItem(code),
          dbService.getMediaQrItems().catch(() => [])
        ]);
        if (isMounted) {
          setItem(found);
          setAllItems(list || []);
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
        // iOS Safari support
        (videoRef.current as any).webkitEnterFullscreen();
      }
    }
  };

  const extractYouTubeId = (url: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-stone-400">ভিডিও লোড হচ্ছে, অপেক্ষা করুন...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-500 mb-4">
          <Film className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold mb-2">ভিডিও বা মিডিয়াটি পাওয়া যায়নি</h1>
        <p className="text-xs sm:text-sm text-stone-400 max-w-sm mb-6">
          QR কোডের লিঙ্কটি সঠিক নয় অথবা মিডিয়াটি এখনো যোগ করা হয়নি।
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-stone-900 text-xs font-bold uppercase tracking-wider hover:bg-stone-200 transition"
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

  // Filter other recommended/related videos (excluding current one)
  const relatedVideos = allItems.filter(m => (m.shortCode !== item.shortCode && m.id !== item.id));

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-stone-900/90 backdrop-blur-md border-b border-stone-800 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-stone-300 hover:text-white text-xs font-bold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>হোমে যান</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition"
              title="শেয়ার লিঙ্ক কপি করুন"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'কপি হয়েছে' : 'শেয়ার'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
        {/* Book / Course Info Pill */}
        {(item.bookTitle || item.pageNumber) && (
          <div className="mb-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs font-bold tracking-wide">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>{item.bookTitle || 'হাতের লেখার বই'}</span>
            {item.pageNumber && (
              <>
                <span className="text-emerald-500">•</span>
                <span>পৃষ্ঠা: {item.pageNumber}</span>
              </>
            )}
          </div>
        )}

        {/* Serial No & Lesson Title */}
        <div className="text-center mb-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
            {item.title}
          </h1>
        </div>

        {/* Media Player Frame */}
        <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-stone-800 shadow-2xl relative flex items-center justify-center group">
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
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm"
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
                className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 hover:bg-black/90 text-white backdrop-blur-sm opacity-80 hover:opacity-100 transition-all pointer-events-auto"
                title="ফুল স্ক্রিন করুন"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </>
          ) : (
            /* Image display */
            <img
              src={item.fileUrl}
              alt={item.title}
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Video Below: Description & Details */}
        {item.description && (
          <div className="mt-4 w-full bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 sm:p-5 text-left">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
              ভিডিও বিবরণ ও নির্দেশনা:
            </h3>
            <p className="text-sm text-stone-200 leading-relaxed whitespace-pre-wrap">
              {item.description}
            </p>
          </div>
        )}

        {/* Related / More Videos Section */}
        {relatedVideos.length > 0 && (
          <div className="mt-8 w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base sm:text-lg font-bold text-white">
                  আরো ভিডিও দেখুন (More Lessons)
                </h2>
              </div>
              <span className="text-xs text-stone-400">
                মোট {relatedVideos.length} টি ভিডিও
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    className="flex items-center gap-3 p-3 rounded-xl bg-stone-900/70 hover:bg-stone-850 border border-stone-800/80 hover:border-emerald-500/50 transition-all group"
                  >
                    <div className="w-20 h-14 rounded-lg bg-stone-800 shrink-0 overflow-hidden relative flex items-center justify-center">
                      {thumb ? (
                        <img src={thumb} alt={rel.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <Film className="w-6 h-6 text-stone-500" />
                      )}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      {rel.pageNumber && (
                        <span className="text-[10px] font-bold text-emerald-400 block mb-0.5">
                          পৃষ্ঠা: {rel.pageNumber}
                        </span>
                      )}
                      <h4 className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                        {rel.title}
                      </h4>
                      {rel.bookTitle && (
                        <p className="text-[10px] text-stone-400 truncate mt-0.5">
                          {rel.bookTitle}
                        </p>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-stone-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Simple Link to Website */}
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 text-xs font-bold transition"
          >
            <span>আমাদের ওয়েবসাইট ভিজিট করুন</span>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
          </Link>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="py-6 border-t border-stone-900 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} Savaria BD — Smart Learning & QR Platform
      </footer>
    </div>
  );
}
