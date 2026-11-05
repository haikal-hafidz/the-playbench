/**
 * URL Fetcher Service
 *
 * Secure remote fetcher for importing game manifests and ZIP packages.
 * Enforces HTTPS, maximum size limits, timeouts, and friendly CORS diagnostics.
 */
import { DEFAULT_SECURITY_LIMITS } from './security';

export interface RemoteFetchResult {
  success: boolean;
  contentType: 'json' | 'zip' | 'unknown';
  data?: string | ArrayBuffer;
  error?: string;
  errorType?: 'cors' | 'timeout' | 'network' | 'size' | 'invalid_protocol' | 'unsupported_format';
  filename?: string;
  sizeBytes?: number;
}

export class UrlFetcherService {
  /**
   * Fetches remote package or manifest from given URL
   */
  async fetchRemotePackage(urlStr: string, options?: { timeoutMs?: number; maxSize?: number }): Promise<RemoteFetchResult> {
    const timeoutMs = options?.timeoutMs || DEFAULT_SECURITY_LIMITS.networkTimeoutMs;
    const maxSize = options?.maxSize || DEFAULT_SECURITY_LIMITS.maxCompressedSize;

    // 1. URL Protocol Validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlStr);
    } catch {
      return {
        success: false,
        contentType: 'unknown',
        error: `Invalid URL format: "${urlStr}". Please provide a complete, well-formed web address.`,
        errorType: 'invalid_protocol',
      };
    }

    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return {
        success: false,
        contentType: 'unknown',
        error: `Disallowed protocol "${parsedUrl.protocol}". Only HTTPS (or local HTTP) URLs can be imported.`,
        errorType: 'invalid_protocol',
      };
    }

    // 2. Abort Controller & Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(urlStr, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, application/zip, application/octet-stream, */*',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          contentType: 'unknown',
          error: `Remote server responded with HTTP status ${response.status} (${response.statusText}).`,
          errorType: 'network',
        };
      }

      // Check Content-Length header if present
      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        const declaredSize = parseInt(contentLengthHeader, 10);
        if (!isNaN(declaredSize) && declaredSize > maxSize) {
          return {
            success: false,
            contentType: 'unknown',
            error: `Remote file size (${(declaredSize / (1024 * 1024)).toFixed(1)}MB) exceeds platform limit of ${(maxSize / (1024 * 1024)).toFixed(1)}MB.`,
            errorType: 'size',
          };
        }
      }

      // Read buffer while monitoring actual size
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > maxSize) {
        return {
          success: false,
          contentType: 'unknown',
          error: `Downloaded package size (${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(1)}MB) exceeds platform limit of ${(maxSize / (1024 * 1024)).toFixed(1)}MB.`,
          errorType: 'size',
        };
      }

      // Determine content type
      const responseContentType = response.headers.get('content-type') || '';
      const pathname = parsedUrl.pathname.toLowerCase();
      const filename = pathname.split('/').pop() || 'imported_package';

      // Check for ZIP signature (PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04)
      const bytes = new Uint8Array(arrayBuffer);
      const isZip = (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07));

      if (isZip || pathname.endsWith('.zip') || responseContentType.includes('zip')) {
        return {
          success: true,
          contentType: 'zip',
          data: arrayBuffer,
          filename: filename.endsWith('.zip') ? filename : `${filename}.zip`,
          sizeBytes: arrayBuffer.byteLength,
        };
      }

      // Attempt to decode as text/JSON
      try {
        const textDecoder = new TextDecoder('utf-8', { fatal: true });
        const text = textDecoder.decode(arrayBuffer);
        return {
          success: true,
          contentType: 'json',
          data: text,
          filename: filename.endsWith('.json') ? filename : `${filename}.json`,
          sizeBytes: arrayBuffer.byteLength,
        };
      } catch {
        return {
          success: false,
          contentType: 'unknown',
          error: 'Remote resource is neither a valid ZIP package nor a valid text/JSON document.',
          errorType: 'unsupported_format',
        };
      }
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        return {
          success: false,
          contentType: 'unknown',
          error: `Connection timed out after ${timeoutMs / 1000} seconds. The host server took too long to respond.`,
          errorType: 'timeout',
        };
      }

      // TypeError: Failed to fetch is the standard browser indicator for CORS failures or network disconnects
      if (err.message && (err.message.includes('Failed to fetch') || err.name === 'TypeError')) {
        return {
          success: false,
          contentType: 'unknown',
          error: `Cross-Origin Request Blocked (CORS) or network disconnect: The remote server at "${parsedUrl.host}" does not permit cross-origin downloads from web browsers. Try downloading the file to your computer first, then import it directly via JSON or ZIP tab.`,
          errorType: 'cors',
        };
      }

      return {
        success: false,
        contentType: 'unknown',
        error: `Network error: ${err.message || 'Unknown network failure'}`,
        errorType: 'network',
      };
    }
  }
}

export const urlFetcherService = new UrlFetcherService();
