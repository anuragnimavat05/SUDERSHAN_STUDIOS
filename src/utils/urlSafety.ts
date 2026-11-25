const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./,
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
}

export function validateExternalHttpUrl(rawUrl: string): UrlValidationResult {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { valid: false, error: 'URL is required.' };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 500) {
    return { valid: false, error: 'URL exceeds the 500-character limit.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Please enter a valid http:// or https:// URL.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, error: 'Only http:// and https:// URLs are permitted.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs containing embedded credentials are not allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || !hostname.includes('.') || BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: 'Localhost and internal hostnames are not permitted.' };
  }

  if (
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    return { valid: false, error: 'Internal network domains are not permitted.' };
  }

  if (hostname.startsWith('[') || hostname.includes(':')) {
    const cleanV6 = hostname.replace(/^\[|\]$/g, '');
    if (
      cleanV6 === '::1' ||
      cleanV6 === '::' ||
      cleanV6.startsWith('fe80:') ||
      cleanV6.startsWith('fc') ||
      cleanV6.startsWith('fd') ||
      cleanV6.includes('127.0.0.1') ||
      cleanV6.includes('169.254.')
    ) {
      return { valid: false, error: 'Private or loopback IPv6 addresses are not permitted.' };
    }
  }

  for (const pattern of PRIVATE_IPV4_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'Private or link-local IP addresses are not permitted.' };
    }
  }

  return { valid: true, normalizedUrl: parsed.toString() };
}
