import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { requireAdmin } from '../middleware/adminAuth';

const uploadRouter = Router();

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer memory storage so Sharp can process buffer immediately
const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size
});

uploadRouter.post('/', requireAdmin, upload.single('file'), async (req: any, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const originalName = req.file.originalname || 'upload';
    const isImage = req.file.mimetype.startsWith('image/') && !req.file.mimetype.includes('svg');
    const isPdf = req.file.mimetype.includes('pdf');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);

    if (isImage) {
      // Auto compress & convert to next-gen WebP format (80-90% reduction, crystal sharp quality)
      const webpFileName = `img-${uniqueSuffix}.webp`;
      const outputPath = path.join(uploadDir, webpFileName);

      await sharp(req.file.buffer)
        .rotate() // auto-orient from EXIF
        .webp({ quality: 82, effort: 4 })
        .toFile(outputPath);

      return res.status(200).json({ url: `/uploads/${webpFileName}` });
    }

    // PDFs, SVGs, Videos, Documents: write buffer directly with original extension
    const ext = path.extname(originalName) || (isPdf ? '.pdf' : '');
    const regularFileName = `file-${uniqueSuffix}${ext}`;
    const outputPath = path.join(uploadDir, regularFileName);

    fs.writeFileSync(outputPath, req.file.buffer);
    return res.status(200).json({ url: `/uploads/${regularFileName}` });
  } catch (err: any) {
    console.error('Upload processing error:', err);
    return res.status(500).json({ error: err.message || 'File processing failed' });
  }
});

export { uploadRouter };
