import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { 
  S3Client, 
  PutObjectCommand, 
  CreateMultipartUploadCommand, 
  UploadPartCommand, 
  CompleteMultipartUploadCommand, 
  AbortMultipartUploadCommand 
} from '@aws-sdk/client-s3';
import { requireAdmin } from '../middleware/adminAuth';

const uploadRouter = Router();

// Ensure local uploads directory exists
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Temporary directory for streaming file uploads without consuming RAM
const tempUploadDir = path.join(uploadDir, '.temp');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

// Check Cloudflare R2 Credentials
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

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

// Disk storage for large files (videos/PDFs): writes directly to temporary disk stream, ZERO RAM bloat!
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `stream-${uniqueSuffix}${ext}`);
  }
});

// Memory storage for small images requiring WebP compression via Sharp (< 35MB)
const memoryStorage = multer.memoryStorage();

const uploadDisk = multer({
  storage: diskStorage,
  limits: { fileSize: 1500 * 1024 * 1024 } // 1.5GB limit
});

const uploadMemory = multer({
  storage: memoryStorage,
  limits: { fileSize: 40 * 1024 * 1024 } // 40MB limit for images
});

// Multer for chunk multipart upload (memory buffer up to 35MB per chunk)
const uploadChunk = multer({
  storage: memoryStorage,
  limits: { fileSize: 40 * 1024 * 1024 }
});

// Dynamic multer selector: images use memoryStorage (for sharp), videos & large files use diskStorage (zero RAM)
const dynamicUpload = (req: any, res: any, next: any) => {
  const isImageHeader = req.headers['content-type']?.includes('image/') || false;
  // If query specifies memory or image
  if (isImageHeader || req.query.type === 'image') {
    return uploadMemory.single('file')(req, res, next);
  }
  return uploadDisk.single('file')(req, res, next);
};

// =========================================================================
// 1. STANDARD STREAMING UPLOAD ENDPOINT (Zero RAM - Local disk to R2 Stream)
// =========================================================================
uploadRouter.post('/', requireAdmin, dynamicUpload, async (req: any, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const file = req.file;
  const originalName = file.originalname || 'upload';
  const isImage = file.mimetype?.startsWith('image/') && !file.mimetype.includes('svg');
  const isPdf = file.mimetype?.includes('pdf');
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);

  try {
    let finalFileName = '';
    let contentType = file.mimetype || 'application/octet-stream';
    let bodyData: any = null;
    let contentLength: number = 0;

    if (isImage && file.buffer) {
      // Small image: convert to WebP using Sharp
      finalFileName = `img-${uniqueSuffix}.webp`;
      contentType = 'image/webp';
      const webpBuffer = await sharp(file.buffer)
        .rotate()
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
      bodyData = webpBuffer;
      contentLength = webpBuffer.length;
    } else {
      const ext = path.extname(originalName) || (isPdf ? '.pdf' : '');
      finalFileName = `file-${uniqueSuffix}${ext}`;

      if (file.path && fs.existsSync(file.path)) {
        // Large file streamed directly to disk: pipe stream to Cloudflare R2
        bodyData = fs.createReadStream(file.path);
        const stats = fs.statSync(file.path);
        contentLength = stats.size;
      } else if (file.buffer) {
        bodyData = file.buffer;
        contentLength = file.buffer.length;
      }
    }

    // 1. Upload to Cloudflare R2
    if (isR2Configured && s3Client) {
      const key = `uploads/${finalFileName}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: bodyData,
        ContentType: contentType,
        ContentLength: contentLength,
      }));

      // Delete temporary disk file if created
      if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }

      const publicBase = R2_PUBLIC_URL.replace(/\/+$/, '');
      const r2Url = publicBase ? `${publicBase}/${key}` : `/${key}`;
      return res.status(200).json({ url: r2Url, filename: finalFileName, storage: 'r2' });
    }

    // 2. Fallback: Save to VPS local public/uploads directory
    const targetPath = path.join(uploadDir, finalFileName);
    if (file.path && fs.existsSync(file.path)) {
      fs.renameSync(file.path, targetPath);
    } else if (bodyData) {
      fs.writeFileSync(targetPath, bodyData);
    }

    return res.status(200).json({ url: `/uploads/${finalFileName}`, filename: finalFileName, storage: 'local' });

  } catch (err: any) {
    // Cleanup temporary file on error
    if (file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch {}
    }
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message || 'File processing failed' });
  }
});

// =========================================================================
// 2. HIGH-RESILIENCE MULTIPART CHUNKED UPLOAD API (For 100MB - 1.5GB Videos)
// Allows pause, auto-retry per 8MB chunk, network failure recovery!
// =========================================================================

// Initialize multipart session
uploadRouter.post('/chunk/init', requireAdmin, async (req: any, res) => {
  try {
    if (!isR2Configured || !s3Client) {
      return res.status(400).json({ error: 'R2 storage is not configured for multipart upload' });
    }

    const { filename, contentType } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const ext = path.extname(filename) || '.mp4';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const finalFileName = `file-${uniqueSuffix}${ext}`;
    const key = `uploads/${finalFileName}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType || 'video/mp4'
    });

    const result = await s3Client.send(command);

    return res.status(200).json({
      uploadId: result.UploadId,
      key,
      filename: finalFileName
    });
  } catch (err: any) {
    console.error('Error initiating multipart upload:', err);
    return res.status(500).json({ error: err.message || 'Failed to initiate multipart upload' });
  }
});

// Upload individual chunk (5MB - 20MB)
uploadRouter.post('/chunk/part', requireAdmin, uploadChunk.single('chunk'), async (req: any, res) => {
  try {
    if (!isR2Configured || !s3Client) {
      return res.status(400).json({ error: 'R2 storage not configured' });
    }

    const uploadId = req.body.uploadId;
    const key = req.body.key;
    const partNumber = parseInt(req.body.partNumber, 10);

    if (!uploadId || !key || !partNumber || !req.file) {
      return res.status(400).json({ error: 'uploadId, key, partNumber and chunk are required' });
    }

    const uploadPartCommand = new UploadPartCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: req.file.buffer
    });

    const result = await s3Client.send(uploadPartCommand);

    return res.status(200).json({
      partNumber,
      etag: result.ETag
    });
  } catch (err: any) {
    console.error('Error uploading part:', err);
    return res.status(500).json({ error: err.message || 'Failed to upload part' });
  }
});

// Complete multipart upload session
uploadRouter.post('/chunk/complete', requireAdmin, async (req: any, res) => {
  try {
    if (!isR2Configured || !s3Client) {
      return res.status(400).json({ error: 'R2 storage not configured' });
    }

    const { uploadId, key, parts, filename } = req.body;
    if (!uploadId || !key || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'uploadId, key and parts array are required' });
    }

    // Sort parts by PartNumber ascending
    const sortedParts = parts.map((p: any) => ({
      PartNumber: Number(p.PartNumber || p.partNumber),
      ETag: p.ETag || p.etag
    })).sort((a: any, b: any) => a.PartNumber - b.PartNumber);

    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts
      }
    });

    await s3Client.send(completeCommand);

    const publicBase = R2_PUBLIC_URL.replace(/\/+$/, '');
    const r2Url = publicBase ? `${publicBase}/${key}` : `/${key}`;

    return res.status(200).json({
      url: r2Url,
      filename: filename || path.basename(key),
      storage: 'r2'
    });
  } catch (err: any) {
    console.error('Error completing multipart upload:', err);
    return res.status(500).json({ error: err.message || 'Failed to complete multipart upload' });
  }
});

// Abort multipart upload session (on user cancel or unrecoverable error)
uploadRouter.post('/chunk/abort', requireAdmin, async (req: any, res) => {
  try {
    if (!isR2Configured || !s3Client) {
      return res.status(200).json({ ok: true });
    }

    const { uploadId, key } = req.body;
    if (uploadId && key) {
      await s3Client.send(new AbortMultipartUploadCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        UploadId: uploadId
      }));
    }
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(200).json({ ok: false, error: err.message });
  }
});

export { uploadRouter };
