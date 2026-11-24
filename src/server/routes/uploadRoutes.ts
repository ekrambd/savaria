import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { requireAdmin } from '../middleware/adminAuth';

const uploadRouter = Router();

// Ensure uploads directory exists for fallback or local assets
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Check Cloudflare R2 Credentials
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''; // e.g. https://pub-xxxxxx.r2.dev or https://media.handwriting-book.com

const isR2Configured = Boolean(
  R2_ACCOUNT_ID && 
  R2_ACCESS_KEY_ID && 
  R2_SECRET_ACCESS_KEY && 
  R2_BUCKET_NAME
);

let s3Client: S3Client | null = null;
if (isR2Configured) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

// Multer memory storage so Sharp / S3 can process buffer directly
const storage = multer.memoryStorage();

// Increase max file size limit to 1GB (1024 * 1024 * 1024 bytes)
const upload = multer({ 
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB limit for videos
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

    let finalBuffer: Buffer = req.file.buffer;
    let finalFileName = '';
    let contentType = req.file.mimetype || 'application/octet-stream';

    if (isImage) {
      // Auto compress & convert images to next-gen WebP format
      finalFileName = `img-${uniqueSuffix}.webp`;
      contentType = 'image/webp';
      finalBuffer = await sharp(req.file.buffer)
        .rotate()
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
    } else {
      const ext = path.extname(originalName) || (isPdf ? '.pdf' : '');
      finalFileName = `file-${uniqueSuffix}${ext}`;
    }

    // If Cloudflare R2 is configured, upload directly to R2!
    if (isR2Configured && s3Client) {
      const key = `uploads/${finalFileName}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: finalBuffer,
        ContentType: contentType,
      }));

      const publicBase = R2_PUBLIC_URL.replace(/\/+$/, '');
      const r2Url = publicBase ? `${publicBase}/${key}` : `/${key}`;
      return res.status(200).json({ url: r2Url, filename: finalFileName, storage: 'r2' });
    }

    // Fallback: Save to VPS local public/uploads directory
    const outputPath = path.join(uploadDir, finalFileName);
    fs.writeFileSync(outputPath, finalBuffer);
    return res.status(200).json({ url: `/uploads/${finalFileName}`, filename: finalFileName, storage: 'local' });

  } catch (err: any) {
    console.error('Upload processing error:', err);
    return res.status(500).json({ error: err.message || 'File processing failed' });
  }
});

export { uploadRouter };
