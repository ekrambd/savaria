import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  QrCode, 
  Upload, 
  Video, 
  Image as ImageIcon, 
  Youtube, 
  Download, 
  Printer, 
  Copy, 
  ExternalLink, 
  Trash2, 
  Plus, 
  Sparkles, 
  Check, 
  Edit,
  X,
  BookOpen,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { MediaQrItem } from '../types';
import { dbService, getAdminAuthHeaders } from '../lib/dbService';

const ITEMS_PER_PAGE = 15;

export const MediaQrManager: React.FC = () => {
  const [items, setItems] = useState<MediaQrItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<string>('');
  const [uploadEta, setUploadEta] = useState<string>('');
  const [uploadSizeText, setUploadSizeText] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Edit Mode State
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [bookTitle, setBookTitle] = useState('হাতের লেখার বই');
  const [pageNumber, setPageNumber] = useState('');
  const [mediaType, setMediaType] = useState<'video' | 'image' | 'youtube'>('video');
  const [mediaUrl, setMediaUrl] = useState('');
  const [customShortCode, setCustomShortCode] = useState('');
  const [description, setDescription] = useState('');
  
  // Active QR preview for modal / export
  const [selectedItemForPrint, setSelectedItemForPrint] = useState<MediaQrItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await dbService.getMediaQrItems();
      setItems(res || []);
    } catch (e) {
      console.error('Failed to load media QR items:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Auto-generate shortcode helper
  const handleGenerateShortCode = () => {
    const p = pageNumber ? `p${pageNumber.replace(/[^a-zA-Z0-9]/g, '')}` : '';
    const rnd = Math.random().toString(36).substring(2, 6);
    const code = p ? `hw-${p}-${rnd}` : `hw-lesson-${rnd}`;
    setCustomShortCode(code.toLowerCase());
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadSpeed('');
      setUploadEta('');

      const totalBytes = file.size;
      const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
      setUploadSizeText(`0 MB / ${totalMb} MB`);

      const formData = new FormData();
      formData.append('file', file);

      const authHeaders = getAdminAuthHeaders();
      delete (authHeaders as any)['Content-Type'];

      const uploadStartTime = Date.now();

      // Real calculation using XMLHttpRequest with upload progress events
      const data: any = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);

        // Set auth headers
        Object.entries(authHeaders).forEach(([key, val]) => {
          if (val) xhr.setRequestHeader(key, String(val));
        });

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const loaded = event.loaded;
            const total = event.total;
            const percent = Math.min(99, Math.round((loaded / total) * 100));
            setUploadProgress(percent);

            const loadedMb = (loaded / (1024 * 1024)).toFixed(1);
            const totalMbFormatted = (total / (1024 * 1024)).toFixed(1);
            setUploadSizeText(`${loadedMb} MB / ${totalMbFormatted} MB`);

            const elapsedSec = (Date.now() - uploadStartTime) / 1000;
            if (elapsedSec > 0.5 && loaded > 0) {
              const bytesPerSec = loaded / elapsedSec;
              const mbPerSec = (bytesPerSec / (1024 * 1024)).toFixed(1);
              setUploadSpeed(`${mbPerSec} MB/s`);

              const remainingBytes = total - loaded;
              const remainingSec = Math.round(remainingBytes / bytesPerSec);
              if (remainingSec < 60) {
                setUploadEta(`~${remainingSec}s বাকি`);
              } else {
                const mins = Math.floor(remainingSec / 60);
                const secs = remainingSec % 60;
                setUploadEta(`~${mins}m ${secs}s বাকি`);
              }
            }
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resJson = JSON.parse(xhr.responseText);
              setUploadProgress(100);
              resolve(resJson);
            } catch (parseErr) {
              reject(new Error('Invalid server response'));
            }
          } else {
            let errorMsg = `Upload failed (${xhr.status})`;
            try {
              const resJson = JSON.parse(xhr.responseText);
              if (resJson.error) errorMsg = resJson.error;
            } catch {}
            reject(new Error(errorMsg));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error during upload. Please check connection.'));
        };

        xhr.ontimeout = () => {
          reject(new Error('Upload timed out.'));
        };

        xhr.send(formData);
      });
      
      const fileUrl = data.url || (data.filename ? `/uploads/${data.filename}` : '');
      setMediaUrl(fileUrl);
      
      if (file.type.startsWith('video/')) {
        setMediaType('video');
      } else if (file.type.startsWith('image/')) {
        setMediaType('image');
      }

      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (err: any) {
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
      setUploadSpeed('');
      setUploadEta('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startEdit = (item: MediaQrItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setBookTitle(item.bookTitle || 'হাতের লেখার বই');
    setPageNumber(item.pageNumber || '');
    setMediaType(item.mediaType as any || 'video');
    setMediaUrl(item.youtubeUrl || item.fileUrl || '');
    setCustomShortCode(item.shortCode);
    setDescription(item.description || '');

    // Scroll smoothly to form
    window.scrollTo({ top: 100, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setPageNumber('');
    setMediaUrl('');
    setCustomShortCode('');
    setDescription('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a lesson or title');
      return;
    }
    if (!mediaUrl.trim()) {
      alert('Please upload a file or provide a video/image URL');
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        title: title.trim(),
        bookTitle: bookTitle.trim() || undefined,
        pageNumber: pageNumber.trim() || undefined,
        mediaType,
        mediaUrl: mediaUrl.trim(),
        fileUrl: mediaUrl.trim(),
        youtubeUrl: mediaType === 'youtube' ? mediaUrl.trim() : undefined,
        customShortCode: customShortCode.trim() || undefined,
        shortCode: customShortCode.trim() || undefined,
        description: description.trim() || undefined,
      };

      if (editingId) {
        payload.id = editingId;
      }

      await dbService.saveMediaQrItem(payload);

      // Reset form
      cancelEdit();
      await fetchItems();
    } catch (err: any) {
      alert('Failed to save QR media item: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete QR code "${code}"?`)) return;
    try {
      await dbService.deleteMediaQrItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      if (editingId === id) cancelEdit();
    } catch (err: any) {
      alert('Failed to delete item: ' + (err.message || 'Error'));
    }
  };

  const copyShareUrl = (shortCode: string, id: string) => {
    const url = `${window.location.origin}/learn/${shortCode}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open QR download / print modal
  const openQrModal = async (item: MediaQrItem) => {
    setSelectedItemForPrint(item);
    const targetUrl = `${window.location.origin}/learn/${item.shortCode}`;
    try {
      const dataUrl = await QRCode.toDataURL(targetUrl, {
        width: 600,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      setQrDataUrl(dataUrl);
    } catch (e) {
      console.error('QR generation error:', e);
    }
  };

  // Download 100% Pure, Ultra High-Resolution (1200x1200px) QR Code only for sharp printing on books
  const downloadHighResQr = async (item: MediaQrItem) => {
    const targetUrl = `${window.location.origin}/learn/${item.shortCode}`;
    try {
      // 1200x1200px crystal clear 300+ DPI vector-crisp QR code
      const pureQrDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 1200,
        margin: 1, // Minimal margin for maximum QR size
        errorCorrectionLevel: 'H', // Highest error correction for flawless scanning even if worn
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      const link = document.createElement('a');
      const bookPrefix = (item.bookTitle || 'book').replace(/\s+/g, '_');
      const pagePrefix = (item.pageNumber || 'lesson').replace(/\s+/g, '_');
      link.download = `QR-${item.shortCode}-${pagePrefix}.png`;
      link.href = pureQrDataUrl;
      link.click();
    } catch (e) {
      console.error('Error generating pure high-res QR for download:', e);
      alert('QR Download failed');
    }
  };

  const printQr = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !selectedItemForPrint) return;

    const targetUrl = `${window.location.origin}/learn/${selectedItemForPrint.shortCode}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR - ${selectedItemForPrint.shortCode}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 40px;
              color: #111;
            }
            .card {
              border: 2px dashed #999;
              padding: 24px;
              border-radius: 12px;
              text-align: center;
              max-width: 380px;
            }
            img {
              width: 280px;
              height: 280px;
              margin: 0 auto;
            }
            h2 {
              margin: 14px 0 6px 0;
              font-size: 20px;
            }
            p.sub {
              margin: 0 0 10px 0;
              font-size: 15px;
              color: #16a34a;
              font-weight: 600;
            }
            p.link {
              margin: 0;
              font-size: 12px;
              color: #666;
              font-family: monospace;
            }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="${qrDataUrl}" alt="QR Code" />
            <h2>${selectedItemForPrint.bookTitle || 'হাতের লেখার বই'}</h2>
            <p class="sub">${selectedItemForPrint.pageNumber ? `${selectedItemForPrint.pageNumber} - ` : ''}${selectedItemForPrint.title}</p>
            <p class="link">${targetUrl}</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Pagination calculation
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = items.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <QrCode className="w-7 h-7 text-emerald-200" />
            <h1 className="text-2xl font-bold tracking-tight">Book Video & QR Generator</h1>
            <span className="bg-white/20 text-xs px-2.5 py-0.5 rounded-full font-semibold">হাতের লেখার বই</span>
          </div>
          <p className="text-emerald-100 text-sm max-w-2xl leading-relaxed">
            বইয়ের পাতার জন্য ভিডিও/ছবি আপলোড করে স্থায়ী QR কোড তৈরি ও প্রিন্ট করুন। মোবাইল ক্যামেরা বা স্ক্যানার দিয়ে স্ক্যান করলেই শিক্ষার্থী সরাসরি ভিডিও দেখতে পাবে।
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20 text-center min-w-[140px]">
          <div className="text-2xl font-black">{items.length}</div>
          <div className="text-xs text-emerald-100 font-medium">Active QR Codes</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Creation & Edit Form */}
        <div className="lg:col-span-5 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {editingId ? (
                <>
                  <Edit className="w-5 h-5 text-amber-600" />
                  QR কোড এডিট করুন
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-emerald-600" />
                  নতুন QR কোড তৈরি করুন
                </>
              )}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="text-xs text-gray-500 hover:text-rose-600 font-semibold flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                বাতিল করুন
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Book Name & Page */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  বইয়ের নাম (Book)
                </label>
                <input
                  type="text"
                  value={bookTitle}
                  onChange={e => setBookTitle(e.target.value)}
                  placeholder="হাতের লেখার বই"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  পৃষ্ঠা নম্বর (Page)
                </label>
                <input
                  type="text"
                  value={pageNumber}
                  onChange={e => setPageNumber(e.target.value)}
                  placeholder="যেমন: ১ বা Page 1"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Lesson Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                লেসন বা ভিডিওর শিরোনাম (Lesson Title) *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="যেমন: বর্ণমালা 'ক' ও 'খ' লেখার সঠিক নিয়ম"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Media Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                মিডিয়া টাইপ (Media Type)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMediaType('video')}
                  className={`py-2 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    mediaType === 'video'
                      ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-500 font-bold'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  MP4 Video
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('youtube')}
                  className={`py-2 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    mediaType === 'youtube'
                      ? 'bg-red-50 text-red-700 border-2 border-red-500 font-bold'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <Youtube className="w-3.5 h-3.5" />
                  YouTube
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('image')}
                  className={`py-2 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    mediaType === 'image'
                      ? 'bg-blue-50 text-blue-700 border-2 border-blue-500 font-bold'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Image
                </button>
              </div>
            </div>

            {/* Upload or Link Input */}
            {mediaType === 'youtube' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  YouTube Video Link / URL *
                </label>
                <input
                  type="url"
                  required
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ফাইল আপলোড করুন (File Upload - Max 1GB / Cloudflare R2) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept={mediaType === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/*'}
                    onChange={handleFileUpload}
                    className="hidden"
                    id="media-file-input"
                  />
                  <label
                    htmlFor="media-file-input"
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-xl cursor-pointer text-xs font-medium transition-all ${
                      uploading
                        ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                        : 'border-emerald-300 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-500'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-emerald-600" />
                    {uploading ? `Uploading... ${uploadProgress}%` : mediaUrl ? 'Change Uploaded File' : 'ভিডিও বা ছবি সিলেক্ট করুন'}
                  </label>
                </div>

                {uploading && (
                  <div className="mt-2.5 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-emerald-900 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 animate-bounce text-emerald-600" />
                        ভিডিও ক্লাউডফ্লেয়ার R2-এ আপলোড হচ্ছে...
                      </span>
                      <span className="font-mono text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-300">
                        {uploadProgress}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-emerald-200/60 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2.5 transition-all duration-150 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>

                    {/* Real calculation details: Size, Speed, ETA */}
                    <div className="flex items-center justify-between text-[11px] text-emerald-800 font-medium">
                      <span>{uploadSizeText}</span>
                      <div className="flex items-center gap-2">
                        {uploadSpeed && <span className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">{uploadSpeed}</span>}
                        {uploadEta && <span className="font-semibold text-emerald-700">{uploadEta}</span>}
                      </div>
                    </div>
                  </div>
                )}

                {mediaUrl && (
                  <div className="mt-2 text-xs text-gray-600 truncate bg-gray-50 p-2 rounded border border-gray-200">
                    Uploaded: <span className="font-mono text-emerald-700">{mediaUrl}</span>
                  </div>
                )}
              </div>
            )}

            {/* Custom Short Code */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">
                  শর্ট কোড (Custom Short Code - Optional)
                </label>
                {!editingId && (
                  <button
                    type="button"
                    onClick={handleGenerateShortCode}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    অটো তৈরি
                  </button>
                )}
              </div>
              <div className="flex items-center">
                <span className="px-2.5 py-2 text-xs text-gray-500 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg select-none">
                  {typeof window !== 'undefined' ? `${window.location.host}/learn/` : 'handwriting-book.com/learn/'}
                </span>
                <input
                  type="text"
                  value={customShortCode}
                  onChange={e => setCustomShortCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="যেমন: hw-p1"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                খালি রাখলে স্বয়ংক্রিয়ভাবে একটি ইউনিক ছোট লিংক তৈরি হবে।
              </p>
            </div>

            {/* Description / Instructions */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                সংক্ষিপ্ত বিবরণ বা নির্দেশনা (Optional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="যেমন: ভিডিওটি মনোযোগ দিয়ে দেখে ৩ বার অনুশীলন করো..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving || uploading}
              className={`w-full py-3 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all ${
                saving || uploading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : editingId
                    ? 'bg-amber-600 hover:bg-amber-700 active:scale-[0.99]'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]'
              }`}
            >
              <QrCode className="w-4 h-4" />
              {saving ? 'সংরক্ষণ হচ্ছে...' : editingId ? 'পরিবর্তন সংরক্ষণ করুন' : 'QR কোড তৈরি করুন'}
            </button>
          </form>
        </div>

        {/* Existing QR Codes List with Pagination */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                  বইয়ের সমস্ত QR কোডের তালিকা ({items.length})
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  প্রতি পেজে {ITEMS_PER_PAGE} টি করে QR কোড প্রদর্শিত হচ্ছে
                </p>
              </div>
              <button
                onClick={fetchItems}
                className="text-xs text-emerald-600 hover:underline font-semibold"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="py-16 text-center text-gray-400">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm">লোড হচ্ছে...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <QrCode className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-semibold text-gray-600">কোনো QR কোড এখনও তৈরি করা হয়নি</p>
                <p className="text-xs text-gray-400 mt-1">
                  বামে ফর্ম পূরণ করে আপনার বইয়ের প্রথম ভিডিও ও QR কোড তৈরি করুন
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentItems.map((item, idx) => {
                  const globalIndex = startIndex + idx + 1;
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        editingId === item.id 
                          ? 'bg-amber-50/70 border-amber-300' 
                          : 'bg-gray-50/70 hover:bg-white border-gray-200 hover:shadow'
                      }`}
                    >
                      {/* Left: Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="bg-slate-800 text-white text-[11px] font-bold px-2 py-0.5 rounded-md">
                            #{globalIndex}
                          </span>
                          {item.bookTitle && (
                            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded">
                              {item.bookTitle}
                            </span>
                          )}
                          {item.pageNumber && (
                            <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded">
                              পৃষ্ঠা {item.pageNumber}
                            </span>
                          )}
                          <span className="text-[11px] font-medium text-gray-500 uppercase bg-gray-200/80 px-1.5 py-0.5 rounded">
                            {item.mediaType}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-gray-900 truncate">
                          {item.title}
                        </h3>

                        {/* Short link */}
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-emerald-700 font-semibold select-all">
                            {window.location.host}/learn/{item.shortCode}
                          </span>
                          <button
                            onClick={() => copyShareUrl(item.shortCode, item.id)}
                            className="text-gray-500 hover:text-emerald-600 flex items-center gap-1 transition-colors"
                            title="Copy Link"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span className="text-[11px]">{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => openQrModal(item)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                          title="Download / Print QR"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR</span>
                        </button>

                        <button
                          onClick={() => startEdit(item)}
                          className="p-2 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <a
                          href={`/learn/${item.shortCode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-600 hover:text-emerald-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Open Learning Center Page"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        <button
                          onClick={() => handleDelete(item.id, item.shortCode)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                দেখাচ্ছে {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, items.length)} (মোট {items.length} টি)
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
                  // Only show current, first, last, and immediate neighbours if many pages
                  if (
                    totalPages > 7 &&
                    pg !== 1 &&
                    pg !== totalPages &&
                    Math.abs(pg - safeCurrentPage) > 2
                  ) {
                    if (Math.abs(pg - safeCurrentPage) === 3) {
                      return <span key={pg} className="px-1 text-gray-400 text-xs">...</span>;
                    }
                    return null;
                  }

                  const isActive = pg === safeCurrentPage;
                  return (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => setCurrentPage(pg)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pg}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Export & Print Modal */}
      {selectedItemForPrint && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedItemForPrint(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
            >
              ✕
            </button>

            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                প্রিন্ট ও ডাউনলোড প্রিভিউ
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                এই QR কোডটি সরাসরি ডাউনলোড করে আপনার বইয়ের পাতায় ছাপিয়ে দিতে পারেন
              </p>

              {/* QR Card Preview */}
              <div className="p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl max-w-[280px] mx-auto shadow-inner">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="w-full h-auto aspect-square rounded-lg shadow-sm bg-white"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <span className="text-xs text-gray-400">QR তৈরি হচ্ছে...</span>
                  </div>
                )}
                <div className="mt-3">
                  <div className="text-sm font-bold text-gray-900">
                    {selectedItemForPrint.bookTitle || 'হাতের লেখার বই'}
                  </div>
                  <div className="text-xs font-semibold text-emerald-600">
                    {selectedItemForPrint.pageNumber ? `${selectedItemForPrint.pageNumber} • ` : ''}
                    {selectedItemForPrint.title}
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono mt-1">
                    {window.location.host}/learn/{selectedItemForPrint.shortCode}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  onClick={() => downloadHighResQr(selectedItemForPrint)}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Download className="w-4 h-4" />
                  ডাউনলোড (PNG)
                </button>
                <button
                  onClick={printQr}
                  className="w-full py-2.5 px-4 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Printer className="w-4 h-4" />
                  প্রিন্ট করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
