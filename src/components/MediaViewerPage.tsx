import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { dbService } from '../lib/dbService';
import { MediaQrItem } from '../types';
import { 
  Play, 
  ExternalLink, 
  BookOpen, 
  ArrowLeft, 
  Sparkles, 
  Share2, 
  Check, 
  Volume2, 
  VolumeX, 
  Maximize2,
  Film,
  Download
} from 'lucide-react';

export default function MediaViewerPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<MediaQrItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadItem() {
      if (!code) {
        setIsLoading(false);
        return;
      }
      try {
        const found = await dbService.getMediaQrItem(code);
        if (isMounted) {
          setItem(found);
        }
      } catch (err) {
        console.error('Failed to load media item:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadItem();
    return () => { isMounted = false; };
  }, [code]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <p className="text-sm font-medium text-stone-400">ভিডিও লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p>
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
          QR কোডের লিঙ্কটি সঠিক নয় অথবা মিডিয়াটি এখনো আপলোড করা হয়নি।
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
          <div className="mb-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs font-bold tracking-wide">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>{item.bookTitle}</span>
            {item.pageNumber && (
              <>
                <span className="text-emerald-500">•</span>
                <span>পৃষ্ঠা: {item.pageNumber}</span>
              </>
            )}
          </div>
        )}

        {/* Title */}
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-center text-white mb-2 tracking-tight">
          {item.title}
        </h1>

        {item.description && (
          <p className="text-xs sm:text-sm text-stone-400 text-center max-w-xl mb-6">
            {item.description}
          </p>
        )}

        {/* Media Player Frame */}
        <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-stone-800 shadow-2xl relative flex items-center justify-center">
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
            <video
              src={item.fileUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            /* Image display */
            <img
              src={item.fileUrl}
              alt={item.title}
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Action & Info Footer below video */}
        <div className="mt-6 w-full flex flex-col sm:flex-row items-center justify-between gap-4 bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 sm:p-5">
          <div className="text-center sm:text-left">
            <p className="text-xs text-stone-400">
              বইয়ের QR কোড স্ক্যান করে এই ভিডিওটি প্লে হয়েছে।
            </p>
            <p className="text-[11px] text-stone-500 font-mono mt-0.5">
              Code: {item.shortCode}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {item.fileUrl && !isYouTube && (
              <a
                href={item.fileUrl}
                download
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition border border-stone-700"
              >
                <Download className="w-4 h-4" />
                <span>ডাউনলোড</span>
              </a>
            )}
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950/40"
            >
              <span>আমাদের ওয়েবসাইট</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="py-6 border-t border-stone-900 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} Savaria BD — Smart Learning & QR Platform
      </footer>
    </div>
  );
}
