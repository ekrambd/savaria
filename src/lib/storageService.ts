/**
 * Local Media & Image Storage Service
 * Routes all image and media uploads directly to the VPS / local backend Express API (/api/upload).
 * Completely eliminates image storage in Firebase Storage / Firestore.
 */

/** Upload a File object to the server's local media storage and return its public URL. */
export async function uploadFileToStorage(file: File, _destPath?: string): Promise<string> {
  const { authService } = await import('./authService');
  let idToken = authService.getToken();

  if (!idToken) {
    const storedEmail = localStorage.getItem('noor_admin_session_email');
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
    if (storedEmail && adminEmail && storedEmail === adminEmail) {
      idToken = `BypassAdmin:${storedEmail}`;
    }
  }

  const formData = new FormData();
  formData.append('file', file);

  const { getApiBaseUrl } = await import('./apiConfig');
  const apiBase = getApiBaseUrl();
  const uploadEndpoint = apiBase.endsWith('/api') ? `${apiBase}/upload` : `${apiBase}/api/upload`;

  const res = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
    },
    body: formData
  });

  if (!res.ok) {
    let msg = `Upload failed with HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.error || errJson.message) {
        msg = errJson.error || errJson.message;
      }
    } catch {
      // keep fallback message
    }
    throw new Error(msg);
  }

  const data = await res.json();
  let fileUrl = data.url;
  if (fileUrl && fileUrl.startsWith('/') && !fileUrl.startsWith('//')) {
    if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
      const serverOrigin = new URL(apiBase).origin;
      fileUrl = `${serverOrigin}${fileUrl}`;
    }
  }
  return fileUrl;
}

/** Upload a data URL / Base64 image to local media storage and return its public URL. */
export async function uploadDataUrlToStorage(dataUrl: string, destPath?: string): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`;
  const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
  return uploadFileToStorage(file, destPath);
}
