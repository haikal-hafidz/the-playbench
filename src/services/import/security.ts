/**
 * Package Security Utilities
 *
 * Enforces strict boundaries against ZIP path traversal, directory breakouts,
 * oversized files, excessive decompressed sizes, and excessive file counts.
 */

export interface SecurityLimits {
  maxCompressedSize: number; // e.g. 15MB
  maxDecompressedSize: number; // e.g. 30MB
  maxIndividualFileSize: number; // e.g. 10MB
  maxFileCount: number; // e.g. 150 files
  maxDepth: number; // e.g. 5 nested directories
  networkTimeoutMs: number; // e.g. 10,000ms
}

export const DEFAULT_SECURITY_LIMITS: SecurityLimits = {
  maxCompressedSize: 15 * 1024 * 1024,
  maxDecompressedSize: 30 * 1024 * 1024,
  maxIndividualFileSize: 10 * 1024 * 1024,
  maxFileCount: 150,
  maxDepth: 5,
  networkTimeoutMs: 10000,
};

export class PackageSecurityError extends Error {
  public code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'PackageSecurityError';
    this.code = code;
  }
}

/**
 * Validates that an archive relative path does not attempt path traversal
 * or break out of its package container.
 */
export function validateRelativeFilePath(filePath: string, maxDepth = 5): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new PackageSecurityError('File path must be a non-empty string.', 'INVALID_PATH');
  }

  // Reject absolute paths
  if (filePath.startsWith('/') || filePath.startsWith('\\') || /^[a-zA-Z]:/.test(filePath)) {
    throw new PackageSecurityError(`Absolute file paths are forbidden: "${filePath}"`, 'ABSOLUTE_PATH');
  }

  // Normalize slashes
  const normalized = filePath.replace(/\\/g, '/');

  // Check for directory traversal sequences
  const segments = normalized.split('/');
  for (const seg of segments) {
    if (seg === '..' || seg === '.') {
      throw new PackageSecurityError(`Path traversal sequences (".." or ".") are forbidden: "${filePath}"`, 'PATH_TRAVERSAL');
    }
  }

  // Check nesting depth
  if (segments.length > maxDepth + 1) {
    throw new PackageSecurityError(
      `Directory nesting depth (${segments.length}) exceeds maximum permitted depth (${maxDepth}): "${filePath}"`,
      'MAX_DEPTH_EXCEEDED'
    );
  }

  return normalized;
}
