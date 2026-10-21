import { CLOCKIN_API_URL } from '../services/apiClient';

/**
 * Resolves an avatar or image URL to ensure local `/uploads` paths point to the backend server,
 * while leaving absolute URLs (CloudFront CDN, S3, data URIs, external links) untouched.
 */
export function getAvatarUrl(url?: string | null): string | undefined {
  if (!url) return undefined;

  // Already a full URL or base64 data URI
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  ) {
    return url;
  }

  // Relative path (e.g., /uploads/avatars/avatar-123.jpg)
  const baseUrl = (CLOCKIN_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${cleanPath}`;
}
