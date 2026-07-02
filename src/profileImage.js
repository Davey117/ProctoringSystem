export const PROFILE_IMAGE_FALLBACK = 'https://via.placeholder.com/150';

export function resolveProfileImageUrl(apiUrl, rawProfileUrl, includeCacheBust = true) {
  if (!rawProfileUrl || rawProfileUrl === 'default_url') {
    return PROFILE_IMAGE_FALLBACK;
  }

  const cleaned = String(rawProfileUrl).trim();
  const isAbsolute = cleaned.startsWith('http://') || cleaned.startsWith('https://');
  const base = (apiUrl || '').replace(/\/+$/, '');
  const normalizedPath = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  const fullUrl = isAbsolute ? cleaned : `${base}${normalizedPath}`;

  if (!includeCacheBust) {
    return fullUrl;
  }

  const joiner = fullUrl.includes('?') ? '&' : '?';
  return `${fullUrl}${joiner}v=${Date.now()}`;
}