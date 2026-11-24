import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, 
  BookOpen, Eye, ShieldAlert, Sparkles, RefreshCw, Layers, CheckCircle2 
} from 'lucide-react';

interface PdfSampleReaderProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl?: string;
  samplePages?: string[];
  productTitle: string;
}

export const PdfSampleReader: React.FC<PdfSampleReaderProps> = ({
  isOpen,
  onClose,
  pdfUrl,
  samplePages = [],
  productTitle
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(samplePages.length || 1);
  const [zoom, setZoom] = useState<number>(100);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const [isCopiedWarning, setIsCopiedWarning] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>('continuous');
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // If using sample images (high performance, 0-second canvas rendering)
  const isImageMode = samplePages && samplePages.length > 0;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setCurrentPage(1);
      setZoom(100);
      setIsLoading(true);

      // Fast loader simulation / initial buffer
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 150);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = 'auto';
      };
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [isOpen, isImageMode]);

  // Track how much user has read
  useEffect(() => {
    const total = isImageMode ? samplePages.length : (totalPages || 1);
    const progress = Math.min(100, Math.round((currentPage / total) * 100));
    setReadingProgress(progress);
  }, [currentPage, totalPages, isImageMode, samplePages.length]);

  // Disable Right Click & Keyboard Download Shortcuts (Ctrl+S, Ctrl+P, Cmd+S, Cmd+P)
  useEffect(() => {
    if (!isOpen) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setIsCopiedWarning(true);
      setTimeout(() => setIsCopiedWarning(false), 2000);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'c')) {
        e.preventDefault();
        setIsCopiedWarning(true);
        setTimeout(() => setIsCopiedWarning(false), 2000);
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        handleNextPage();
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        handlePrevPage();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, currentPage, totalPages]);

  if (!isOpen) return null;

  const scrollToPage = (pageNum: number) => {
    setCurrentPage(pageNum);
    if (viewMode === 'continuous') {
      const el = pageRefs.current[pageNum - 1];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    const max = isImageMode ? samplePages.length : totalPages;
    if (currentPage < max) {
      scrollToPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      scrollToPage(currentPage - 1);
    }
  };

  // Update current page on continuous scroll
  const handleScroll = () => {
    if (viewMode !== 'continuous' || !containerRef.current || !isImageMode) return;
    const containerTop = containerRef.current.scrollTop;
    const containerHeight = containerRef.current.clientHeight;
    const centerPoint = containerTop + containerHeight / 3;

    for (let i = 0; i < pageRefs.current.length; i++) {
      const el = pageRefs.current[i];
      if (el) {
        const offsetTop = el.offsetTop;
        const offsetHeight = el.offsetHeight;
        if (centerPoint >= offsetTop && centerPoint < offsetTop + offsetHeight) {
          setCurrentPage(i + 1);
          break;
        }
      }
    }
  };

  // Resolve PDF Viewer URL
  // If remote URL, render via Google Docs PDF Viewer to prevent CORS / blank canvas blocks
  // If local / relative URL, render native embedded
  const isRemotePdf = pdfUrl && (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://'));
  const viewerUrl = isRemotePdf
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`
    : (pdfUrl ? `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH` : '');

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/90 backdrop-blur-md select-none animate-in fade-in duration-200">
      
      {/* 1. TOP PREMIUM HEADER BAR */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between shadow-xl shrink-0 z-10">
        
        {/* Left: Book / Document Title & Protected Badge */}
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-slate-100 truncate max-w-[220px] sm:max-w-md">
                {productTitle}
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <ShieldAlert className="w-3 h-3" />
                <span>Protected Preview</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              কপিরাইট সুরক্ষিত স্যাম্পল প্রিভিউ • ডাউনলোড বা প্রিন্ট প্রযোজ্য নয়
            </p>
          </div>
        </div>

        {/* Center: Live Page Tracker & Reading Progress Indicator */}
        <div className="flex flex-col items-center justify-center shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-800/90 border border-slate-700/80 px-3 py-1 rounded-xl shadow-inner text-xs font-mono font-bold text-slate-200">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="p-1 hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-slate-200 transition cursor-pointer"
              title="Previous Page (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span>Page {currentPage} of {isImageMode ? samplePages.length : totalPages}</span>

            <button
              type="button"
              onClick={handleNextPage}
              disabled={currentPage >= (isImageMode ? samplePages.length : totalPages)}
              className="p-1 hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-slate-200 transition cursor-pointer"
              title="Next Page (Right Arrow)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Micro Progress Bar */}
          <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
            <div 
              className="bg-emerald-400 h-full transition-all duration-300 rounded-full"
              style={{ width: `${readingProgress}%` }}
            />
          </div>
        </div>

        {/* Right: View Mode Toggle, Zoom Controls & Close Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isImageMode && (
            <>
              {/* View Mode Toggle (Continuous Vertical Scroll vs Single Page) */}
              <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('continuous')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                    viewMode === 'continuous' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Vertical Continuous Scroll (Scroll all pages)"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">স্ক্রোল ভিউ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('single')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                    viewMode === 'single' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Single Page View"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">একক পাতা</span>
                </button>
              </div>

              <div className="hidden md:flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1 text-slate-300 text-xs">
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(60, prev - 15))}
                  className="p-1 hover:text-white transition cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="font-mono text-[11px] w-9 text-center">{zoom}%</span>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(200, prev + 15))}
                  className="p-1 hover:text-white transition cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(100)}
                  className="p-1 hover:text-white transition cursor-pointer ml-1"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-rose-600/80 hover:text-white text-slate-300 rounded-xl border border-slate-700 hover:border-rose-500 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold active:scale-95"
            title="Close Preview (Esc)"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </header>

      {/* 2. PROTECTED READING VIEWER CANVAS */}
      <main 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-slate-950 flex flex-col items-center justify-start p-3 sm:p-6 relative select-none scroll-smooth"
      >
        {/* Anti-Piracy Watermark Overlay */}
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-4 z-20">
          <span className="text-white text-5xl sm:text-7xl font-black uppercase rotate-[-25deg] tracking-widest text-center">
            {productTitle}<br />PREVIEW ONLY
          </span>
        </div>

        {/* Quick Warning Notice if tried to copy/download */}
        {isCopiedWarning && (
          <div className="fixed top-20 bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-2xl text-xs z-50 flex items-center gap-2 animate-bounce">
            <ShieldAlert className="w-4 h-4" />
            <span>সতর্কতা: এই স্যাম্পলটি কপিরাইট সুরক্ষিত এবং ডাউনলোড নিষিদ্ধ।</span>
          </div>
        )}

        {/* Rapid Loader Spinner */}
        {isLoading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs text-white">
            <div className="relative">
              <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
              <Sparkles className="w-4 h-4 text-amber-300 absolute top-0 right-0 animate-pulse" />
            </div>
            <p className="mt-3 text-xs sm:text-sm font-bold text-slate-200">
              হাই-স্পিড অপ্টিমাইজড স্যাম্পল প্রস্তুত হচ্ছে...
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              পৃষ্ঠা ও কোয়ালিটি স্মুথ রেন্ডার করা হচ্ছে
            </p>
          </div>
        )}

        {/* Content Render: Multi-page / Image Mode vs Embedded Vector PDF */}
        {isImageMode ? (
          viewMode === 'continuous' ? (
            /* Continuous Vertical Scroll View (All 36 pages scrollable like a real PDF) */
            <div 
              className="w-full flex flex-col items-center gap-6 sm:gap-8 py-4 transition-transform duration-200"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
            >
              {samplePages.map((pageImg, idx) => (
                <div
                  key={idx}
                  ref={(el) => { pageRefs.current[idx] = el; }}
                  className="relative shadow-2xl rounded-xl overflow-hidden border border-slate-800 bg-white max-w-full"
                >
                  {/* Page Number Pill */}
                  <div className="absolute top-3 right-3 z-10 bg-black/60 backdrop-blur-md text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-full shadow border border-white/10 pointer-events-none">
                    Page {idx + 1}
                  </div>
                  <img
                    src={pageImg}
                    alt={`Sample Page ${idx + 1}`}
                    className="max-h-[85vh] w-auto object-contain pointer-events-none select-none"
                    draggable={false}
                    loading={idx < 3 ? 'eager' : 'lazy'}
                    onContextMenu={(e) => e.preventDefault()}
                    onLoad={() => {
                      if (idx === 0) setIsLoading(false);
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* Single Page View */
            <div 
              className="transition-transform duration-200 flex flex-col items-center justify-center my-auto"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
            >
              <div className="relative shadow-2xl rounded-xl overflow-hidden border border-slate-800 bg-white max-w-full">
                <img
                  src={samplePages[currentPage - 1]}
                  alt={`Sample Page ${currentPage}`}
                  className="max-h-[82vh] w-auto object-contain pointer-events-none select-none"
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  onLoad={() => setIsLoading(false)}
                />
              </div>
            </div>
          )
        ) : (
          <div className="w-full max-w-4xl h-full flex flex-col items-center justify-center my-auto rounded-xl overflow-hidden shadow-2xl border border-slate-800 bg-white relative">
            <iframe
              src={viewerUrl}
              className="w-full h-full border-none"
              title="Protected PDF Preview"
              onLoad={() => setIsLoading(false)}
            />
          </div>
        )}
      </main>

      {/* 3. BOTTOM FLOATING NAVIGATION BAR */}
      <footer className="h-14 px-4 sm:px-6 bg-slate-900/90 backdrop-blur-sm border-t border-slate-800 text-white flex items-center justify-between shrink-0 z-10">
        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-emerald-400" />
          <span>পড়ার অগ্রগতি: <strong className="text-emerald-400">{readingProgress}%</strong> সম্পন্ন</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>পূর্ববর্তী পাতা</span>
          </button>

          <span className="text-xs font-mono font-bold text-slate-300 px-2">
            {currentPage} / {isImageMode ? samplePages.length : totalPages}
          </span>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= (isImageMode ? samplePages.length : totalPages)}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
          >
            <span>পরবর্তী পাতা</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>

    </div>
  );
};
