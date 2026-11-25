import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  GraduationCap,
  Bookmark,
  BookmarkCheck,
  ListVideo,
  Info,
  FolderPlus
} from 'lucide-react';

export default function MediaViewerPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<MediaQrItem | null>(null);
  const [allItems, setAllItems] = useState<MediaQrItem[]>([]);
  const [settings, setSettings] = useState<EcomSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'lessons' | 'saved' | 'instructions'>('lessons');
  const [savedCollection, setSavedCollection] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bha_saved_collection');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

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

  const toggleSaveCollection = (id: string) => {
    setSavedCollection(prev => {
      const updated = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try {
        localStorage.setItem('bha_saved_collection', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

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

  // Play another video YouTube-style: smoothly scroll up to player and switch
  const handleSelectVideo = (targetItem: MediaQrItem) => {
    setItem(targetItem);
    navigate(`/learn/${targetItem.shortCode}`, { replace: true });
    if (playerContainerRef.current) {
      playerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const extractYouTubeId = (url: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const storeLogo = settings?.storeLogo || settings?.headerSettings?.logoUrl || '';
  const fbLink = 'https://www.facebook.com/bangladeshhandwritingassociation/';

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

  const otherLessons = allItems.filter(m => (m.shortCode !== item.shortCode && m.id !== item.id));
  const savedLessons = allItems.filter(m => savedCollection.includes(m.id));
  const isCurrentSaved = savedCollection.includes(item.id);

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

          {/* Center Brand Identity (Store Logo + Bangladesh Handwriting Association - Proper Title Case) */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 shadow-sm">
            {storeLogo ? (
              <img 
                src={storeLogo} 
                alt="Bangladesh Handwriting Association" 
                className="w-6 h-6 object-contain rounded-full shadow-sm ring-1 ring-amber-400/50" 
              />
            ) : (
              <Award className="w-4 h-4 text-amber-400" />
            )}
            <span className="text-xs sm:text-sm font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-400 truncate max-w-[210px] sm:max-w-none">
              Bangladesh Handwriting Association
            </span>
          </div>

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
        
        {/* Top Branding Section: Logo + Title Case (Not all capital) + Quick Social Links */}
        <div className="flex flex-col items-center justify-center text-center mb-5 max-w-2xl px-2">
          <div className="flex items-center justify-center gap-2.5 mb-2.5">
            {storeLogo ? (
              <img 
                src={storeLogo} 
                alt="Logo" 
                className="w-9 h-9 object-contain rounded-full shadow-md ring-2 ring-amber-400/60" 
              />
            ) : (
              <GraduationCap className="w-8 h-8 text-amber-400" />
            )}
            <h2 className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-300 tracking-tight">
              Bangladesh Handwriting Association
            </h2>
          </div>

          {/* Social Row: Facebook & Website Buttons */}
          <div className="flex items-center justify-center gap-2.5">
            <a
              href={fbLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1877F2]/90 hover:bg-[#1877F2] text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition transform hover:scale-102 active:scale-95 border border-blue-400/30"
              title="Visit Official Facebook Page"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Facebook Page</span>
              <ExternalLink className="w-3 h-3 text-blue-200" />
            </a>

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 hover:text-white text-xs font-semibold shadow-md transition transform hover:scale-102 active:scale-95 border border-white/10"
              title="Visit Main Website"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Website</span>
            </Link>
          </div>
        </div>

        {/* Video Player Frame with Video Preview and YouTube-style Experience */}
        <div 
          ref={playerContainerRef}
          className="w-full aspect-video bg-black rounded-3xl overflow-hidden border-2 border-indigo-500/30 shadow-[0_0_50px_-12px_rgba(99,102,241,0.3)] relative flex items-center justify-center group ring-1 ring-white/10 transition-all"
        >
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
                key={item.fileUrl}
                ref={videoRef}
                src={item.fileUrl}
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="w-full h-full object-contain cursor-pointer bg-black"
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

        {/* Video Title Bar & Add to Collection Action */}
        <div className="w-full mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {item.pageNumber && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                  <BookOpen className="w-3 h-3 text-emerald-400" />
                  পৃষ্ঠা নং: {item.pageNumber}
                </span>
              )}
              {item.bookTitle && (
                <span className="text-xs text-slate-400 font-medium">
                  • {item.bookTitle}
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-white leading-tight">
              {item.title}
            </h1>
          </div>

          {/* Quick Collection Bookmark Button */}
          <button
            type="button"
            onClick={() => toggleSaveCollection(item.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 shrink-0 ${
              isCurrentSaved
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'
            }`}
            title="কালেকশনে যোগ করুন / বুকমার্ক করুন"
          >
            {isCurrentSaved ? (
              <>
                <BookmarkCheck className="w-4 h-4 text-slate-950" />
                <span>কালেকশনে যুক্ত</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4 text-amber-400" />
                <span>কালেকশনে যোগ করুন</span>
              </>
            )}
          </button>
        </div>

        {/* Interactive App-Style Tabs (All Lessons, My Collection, Instructions) */}
        <div className="w-full mt-6">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('lessons')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'lessons'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ListVideo className="w-4 h-4" />
              <span>সমস্ত ভিডিও ({allItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'saved'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FolderPlus className="w-4 h-4" />
              <span>আমার কালেকশন ({savedLessons.length})</span>
            </button>

            {item.description && (
              <button
                type="button"
                onClick={() => setActiveTab('instructions')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'instructions'
                    ? 'bg-white/20 text-white border border-white/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Info className="w-4 h-4" />
                <span>নির্দেশনা</span>
              </button>
            )}
          </div>

          {/* TAB 1: ALL LESSONS (YouTube-Style Interactive Playlist) */}
          {activeTab === 'lessons' && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs text-slate-400">
                  যেকোনো ভিডিওতে ক্লিক করলে ওপরে প্লেয়ারে তাৎক্ষণিক প্লে হবে:
                </span>
                <span className="text-xs font-semibold text-amber-300">
                  {otherLessons.length} টি অন্যান্য ভিডিও
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Current Active Video Card */}
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-indigo-950/70 border-2 border-indigo-500/60 shadow-lg relative overflow-hidden">
                  <div className="w-24 h-16 rounded-xl bg-black shrink-0 overflow-hidden relative flex items-center justify-center border border-indigo-400/40">
                    {isVideo ? (
                      <video src={item.fileUrl} preload="metadata" className="w-full h-full object-cover" />
                    ) : (
                      <Film className="w-6 h-6 text-indigo-300" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wider animate-pulse">
                        Now Playing
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block mb-0.5">
                      এখন চলছে
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-2">
                      {item.title}
                    </h4>
                    {item.pageNumber && (
                      <span className="text-[10px] text-indigo-200 block mt-0.5">
                        পৃষ্ঠা: {item.pageNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* Other Videos */}
                {otherLessons.map((other) => {
                  const otherIsVideo = other.mediaType === 'video' || (other.fileUrl && !other.fileUrl.includes('youtube'));
                  const otherIsSaved = savedCollection.includes(other.id);

                  return (
                    <div
                      key={other.id}
                      onClick={() => handleSelectVideo(other)}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-slate-900/90 to-indigo-950/50 hover:from-slate-800 hover:to-indigo-900/60 border border-white/10 hover:border-amber-400/50 transition-all shadow-md group cursor-pointer hover:scale-[1.01]"
                    >
                      {/* Video Thumbnail Preview */}
                      <div className="w-24 h-16 rounded-xl bg-slate-950 shrink-0 overflow-hidden relative flex items-center justify-center border border-white/10 group-hover:border-amber-400/40 transition">
                        {otherIsVideo ? (
                          <video 
                            src={other.fileUrl} 
                            preload="metadata" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                          />
                        ) : (
                          <Film className="w-6 h-6 text-slate-400" />
                        )}
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 flex items-center justify-center transition-all">
                          <div className="w-7 h-7 rounded-full bg-amber-400/90 group-hover:bg-amber-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-3.5 h-3.5 text-black fill-black ml-0.5" />
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        {other.pageNumber && (
                          <span className="inline-block text-[10px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded mb-0.5">
                            পৃষ্ঠা {other.pageNumber}
                          </span>
                        )}
                        <h4 className="text-xs sm:text-sm font-semibold text-white group-hover:text-amber-200 transition-colors line-clamp-2">
                          {other.title}
                        </h4>
                        {other.bookTitle && (
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {other.bookTitle}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSaveCollection(other.id);
                          }}
                          className={`p-1.5 rounded-lg transition ${
                            otherIsSaved ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-white'
                          }`}
                          title="বুকমার্ক / কালেকশন"
                        >
                          <Bookmark className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: MY COLLECTION */}
          {activeTab === 'saved' && (
            <div className="mt-4">
              {savedLessons.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-3xl bg-slate-900/50 border border-white/10">
                  <Bookmark className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-300 mb-1">কোনো ভিডিও কালেকশনে যুক্ত করা হয়নি</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                    যেকোনো ভিডিওর পাশে থাকা বুকমার্ক বাটনে ক্লিক করে আপনার প্রিয় লেসনগুলো এখানে সংরক্ষণ করতে পারেন।
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('lessons')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                  >
                    সমস্ত ভিডিও দেখুন
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedLessons.map((saved) => (
                    <div
                      key={saved.id}
                      onClick={() => handleSelectVideo(saved)}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-slate-900/90 to-indigo-950/50 hover:from-slate-800 hover:to-indigo-900/60 border border-amber-400/30 transition-all shadow-md group cursor-pointer"
                    >
                      <div className="w-24 h-16 rounded-xl bg-slate-950 shrink-0 overflow-hidden relative flex items-center justify-center border border-white/10">
                        <video src={saved.fileUrl} preload="metadata" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Play className="w-4 h-4 text-amber-400 fill-amber-400" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        {saved.pageNumber && (
                          <span className="text-[10px] font-bold text-amber-300 block mb-0.5">
                            পৃষ্ঠা: {saved.pageNumber}
                          </span>
                        )}
                        <h4 className="text-xs sm:text-sm font-semibold text-white group-hover:text-amber-200 line-clamp-2">
                          {saved.title}
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveCollection(saved.id);
                        }}
                        className="p-1.5 rounded-lg text-amber-400 hover:text-rose-400 transition"
                        title="কালেকশন থেকে সরান"
                      >
                        <BookmarkCheck className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INSTRUCTIONS */}
          {activeTab === 'instructions' && item.description && (
            <div className="mt-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900/90 to-indigo-950/40 border border-indigo-500/20 text-left shadow-xl relative overflow-hidden">
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
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="py-6 border-t border-white/10 text-center text-xs text-slate-500 bg-[#060910]">
        © {new Date().getFullYear()} Bangladesh Handwriting Association — Smart Learning Platform
      </footer>
    </div>
  );
}