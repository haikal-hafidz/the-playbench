/**
 * Import Service
 *
 * End-to-end import orchestration for JSON, ZIP packages, and URLs.
 * Handles validation, extraction, conflict detection, storage persistence,
 * game registration, and history tracking.
 */
import JSZip from 'jszip';
import {
  ImportMethod,
  ImportRecord,
  ValidationResult,
  PackageFileRecord,
  CustomGameDataset,
  Game,
} from '../../types';
import { playbenchDB } from '../storage/indexedDb';
import { contentValidator } from './validator';
import { DEFAULT_SECURITY_LIMITS, PackageSecurityError, validateRelativeFilePath } from './security';
import { urlFetcherService } from './urlFetcher';

export interface ImportCandidate {
  id: string;
  method: ImportMethod;
  sourceIdentifier: string;
  sourceName: string;
  sourceSizeBytes: number;
  validation: ValidationResult;
  extractedFiles?: Map<string, Blob>;
  rawJson?: string;
  isConflict?: boolean;
  existingGame?: Game;
}

export type ConflictResolution = 'replace' | 'skip' | 'cancel';

export class ImportService {
  /**
   * Evaluates a raw JSON file or string for import
   */
  async inspectJson(jsonString: string, sourceName = 'file.json'): Promise<ImportCandidate> {
    const sizeBytes = new Blob([jsonString]).size;
    const validation = contentValidator.validateJson(jsonString);

    const gameId = validation.manifestData?.id || `dataset-${Date.now()}`;
    const existingGame = await playbenchDB.getGame(gameId);

    return {
      id: gameId,
      method: 'json',
      sourceIdentifier: sourceName,
      sourceName,
      sourceSizeBytes: sizeBytes,
      validation,
      rawJson: jsonString,
      isConflict: !!existingGame,
      existingGame,
    };
  }

  /**
   * Inspects and securely unpacks a ZIP archive
   */
  async inspectZip(zipBuffer: ArrayBuffer, sourceName = 'package.zip'): Promise<ImportCandidate> {
    const limits = DEFAULT_SECURITY_LIMITS;
    const sizeBytes = zipBuffer.byteLength;

    if (sizeBytes > limits.maxCompressedSize) {
      throw new PackageSecurityError(
        `ZIP archive size (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB) exceeds limit of ${(limits.maxCompressedSize / (1024 * 1024)).toFixed(1)}MB.`,
        'SIZE_LIMIT_EXCEEDED'
      );
    }

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(zipBuffer);
    } catch (err: any) {
      throw new PackageSecurityError(`Failed to read ZIP archive: ${err.message}`, 'MALFORMED_ARCHIVE');
    }

    const fileEntries = Object.keys(zip.files);
    if (fileEntries.length > limits.maxFileCount) {
      throw new PackageSecurityError(
        `ZIP archive contains ${fileEntries.length} files, exceeding limit of ${limits.maxFileCount}.`,
        'MAX_FILES_EXCEEDED'
      );
    }

    let totalDecompressedSize = 0;
    const extractedFiles = new Map<string, Blob>();
    let manifestContent: string | null = null;
    let manifestPath: string | null = null;

    // First pass: locate tpgp.json / manifest.json
    for (const rawPath of fileEntries) {
      const entry = zip.files[rawPath];
      if (entry.dir) continue;

      const normPath = rawPath.replace(/\\/g, '/');
      const basename = normPath.split('/').pop() || '';

      if (basename.toLowerCase() === 'tpgp.json' || basename.toLowerCase() === 'manifest.json') {
        manifestContent = await entry.async('string');
        manifestPath = normPath;
        break;
      }
    }

    if (!manifestContent) {
      return {
        id: `unrecognized-${Date.now()}`,
        method: 'zip',
        sourceIdentifier: sourceName,
        sourceName,
        sourceSizeBytes: sizeBytes,
        validation: {
          status: 'invalid',
          contentType: 'unknown',
          warnings: [],
          errors: ['No "tpgp.json" or "manifest.json" found in ZIP root or subdirectories.'],
          destination: 'unsupported',
          isPlayable: false,
        },
      };
    }

    // Validate manifest
    const validation = contentValidator.validateJson(manifestContent);
    const gameId = validation.manifestData?.id || `imported-${Date.now()}`;
    const baseDir = manifestPath && manifestPath.includes('/') ? manifestPath.substring(0, manifestPath.lastIndexOf('/') + 1) : '';

    // Second pass: extract files relative to manifest root and enforce path security
    for (const rawPath of fileEntries) {
      const entry = zip.files[rawPath];
      if (entry.dir) continue;

      let relativePath = rawPath.replace(/\\/g, '/');
      if (baseDir && relativePath.startsWith(baseDir)) {
        relativePath = relativePath.slice(baseDir.length);
      }

      // Security checks on entry path
      validateRelativeFilePath(relativePath, limits.maxDepth);

      // Decompress entry into Blob
      const entryBlob = await entry.async('blob');
      if (entryBlob.size > limits.maxIndividualFileSize) {
        throw new PackageSecurityError(
          `File "${relativePath}" (${(entryBlob.size / (1024 * 1024)).toFixed(1)}MB) exceeds max single file limit of ${(limits.maxIndividualFileSize / (1024 * 1024)).toFixed(1)}MB.`,
          'FILE_TOO_LARGE'
        );
      }

      totalDecompressedSize += entryBlob.size;
      if (totalDecompressedSize > limits.maxDecompressedSize) {
        throw new PackageSecurityError(
          `Total decompressed size (${(totalDecompressedSize / (1024 * 1024)).toFixed(1)}MB) exceeds limit of ${(limits.maxDecompressedSize / (1024 * 1024)).toFixed(1)}MB.`,
          'TOTAL_DECOMPRESSED_EXCEEDED'
        );
      }

      extractedFiles.set(relativePath, entryBlob);
    }

    // Verify runtime entrypoint exists in package
    if (validation.runtimeEntrypoint) {
      const entrypointFile = validation.runtimeEntrypoint.replace(/^\.?\//, '');
      if (!extractedFiles.has(entrypointFile)) {
        validation.errors.push(`Specified runtime entrypoint "${validation.runtimeEntrypoint}" was not found inside the ZIP package.`);
        validation.status = 'invalid';
        validation.isPlayable = false;
      }
    }

    const existingGame = await playbenchDB.getGame(gameId);

    return {
      id: gameId,
      method: 'zip',
      sourceIdentifier: sourceName,
      sourceName,
      sourceSizeBytes: sizeBytes,
      validation,
      extractedFiles,
      isConflict: !!existingGame,
      existingGame,
    };
  }

  /**
   * Inspects a remote package from URL
   */
  async inspectUrl(url: string): Promise<ImportCandidate> {
    const fetchRes = await urlFetcherService.fetchRemotePackage(url);
    if (!fetchRes.success) {
      return {
        id: `url-failed-${Date.now()}`,
        method: 'url',
        sourceIdentifier: url,
        sourceName: fetchRes.filename || url,
        sourceSizeBytes: fetchRes.sizeBytes || 0,
        validation: {
          status: 'invalid',
          contentType: 'unknown',
          warnings: [],
          errors: [fetchRes.error || 'Failed to download remote resource.'],
          destination: 'unsupported',
          isPlayable: false,
        },
      };
    }

    if (fetchRes.contentType === 'zip' && fetchRes.data instanceof ArrayBuffer) {
      const candidate = await this.inspectZip(fetchRes.data, fetchRes.filename || 'remote_package.zip');
      candidate.method = 'url';
      candidate.sourceIdentifier = url;
      return candidate;
    } else if (fetchRes.contentType === 'json' && typeof fetchRes.data === 'string') {
      const candidate = await this.inspectJson(fetchRes.data, fetchRes.filename || 'remote_manifest.json');
      candidate.method = 'url';
      candidate.sourceIdentifier = url;
      return candidate;
    }

    return {
      id: `unsupported-${Date.now()}`,
      method: 'url',
      sourceIdentifier: url,
      sourceName: fetchRes.filename || url,
      sourceSizeBytes: fetchRes.sizeBytes || 0,
      validation: {
        status: 'unsupported',
        contentType: 'unknown',
        warnings: [],
        errors: ['Downloaded content was not recognizable as a TPGP manifest or ZIP package.'],
        destination: 'unsupported',
        isPlayable: false,
      },
    };
  }

  /**
   * Finalizes the import of a candidate according to conflict resolution strategy
   */
  async executeImport(
    candidate: ImportCandidate,
    resolution: ConflictResolution = 'replace'
  ): Promise<ImportRecord> {
    const now = Date.now();

    // Conflict handling
    if (candidate.isConflict && resolution === 'cancel') {
      const cancelledRecord: ImportRecord = {
        id: `import-${now}`,
        name: candidate.validation.name || candidate.sourceName,
        importMethod: candidate.method,
        source: candidate.sourceIdentifier,
        contentType: candidate.validation.contentType,
        version: candidate.validation.version,
        status: 'cancelled',
        validationResult: candidate.validation,
        failureReason: 'Import was cancelled by user because an existing game with the same ID was found.',
        targetGameId: candidate.id,
        importedAt: now,
      } as any;
      await playbenchDB.saveImportRecord(cancelledRecord);
      return cancelledRecord;
    }

    if (candidate.isConflict && resolution === 'skip') {
      const skippedRecord: ImportRecord = {
        id: `import-${now}`,
        name: candidate.validation.name || candidate.sourceName,
        importMethod: candidate.method,
        source: candidate.sourceIdentifier,
        contentType: candidate.validation.contentType,
        version: candidate.validation.version,
        status: 'cancelled',
        validationResult: candidate.validation,
        failureReason: 'Import skipped; existing registered game was retained.',
        targetGameId: candidate.id,
        importedAt: now,
      } as any;
      await playbenchDB.saveImportRecord(skippedRecord);
      return skippedRecord;
    }

    // Invalid check
    if (candidate.validation.status === 'invalid') {
      const failedRecord: ImportRecord = {
        id: `import-${now}`,
        name: candidate.validation.name || candidate.sourceName,
        importMethod: candidate.method,
        source: candidate.sourceIdentifier,
        contentType: candidate.validation.contentType,
        version: candidate.validation.version,
        status: 'failed',
        validationResult: candidate.validation,
        failureReason: candidate.validation.errors.join('; ') || 'Validation failed.',
        targetGameId: candidate.id,
        importedAt: now,
      } as any;
      await playbenchDB.saveImportRecord(failedRecord);
      return failedRecord;
    }

    try {
      // Branch based on destination
      if (candidate.validation.destination === 'games') {
        const manifest = candidate.validation.manifestData;

        // 1. If ZIP package with extracted files, store files
        if (candidate.extractedFiles && candidate.extractedFiles.size > 0) {
          // Clean existing package files if replacing
          if (candidate.isConflict && resolution === 'replace') {
            await playbenchDB.deletePackageFiles(candidate.id);
          }

          const fileRecords: PackageFileRecord[] = [];
          for (const [filePath, fileBlob] of candidate.extractedFiles.entries()) {
            const buffer = await fileBlob.arrayBuffer();
            fileRecords.push({
              id: `${candidate.id}:${filePath}`,
              packageId: candidate.id,
              filePath,
              mimeType: fileBlob.type || 'application/octet-stream',
              data: buffer,
              size: fileBlob.size,
            });
          }
          await playbenchDB.savePackageFiles(fileRecords);
        }

        // 2. Register/Update Game in games store
        const registeredGame: Game = {
          id: manifest.id,
          title: manifest.title,
          tagline: manifest.tagline,
          description: manifest.description || manifest.tagline || 'Imported TPGP game package.',
          genre: Array.isArray(manifest.genre) ? manifest.genre : [manifest.genre || 'Other'],
          version: manifest.version || '1.0.0',
          author: candidate.validation.author || { name: 'Unknown Author' },
          runtime: {
            type: manifest.runtime?.type || 'html-standalone',
            entrypoint: manifest.runtime?.entrypoint || 'index.html',
            aspectRatio: manifest.runtime?.aspectRatio,
            preferredWidth: manifest.runtime?.preferredWidth,
            preferredHeight: manifest.runtime?.preferredHeight,
          },
          coverUrl: manifest.coverImage || undefined,
          players: {
            min: manifest.players?.min || 1,
            max: manifest.players?.max || 1,
            type: (manifest.players?.type as any) || 'solo',
          },
          tags: manifest.tags || ['imported'],
          offlineCapable: true,
          packageOrigin: candidate.method === 'url' ? 'imported-url' : (candidate.method === 'zip' ? 'imported-zip' : 'imported-json'),
          playCount: candidate.existingGame?.playCount || 0,
          createdAt: candidate.existingGame?.createdAt || now,
          updatedAt: now,
        };

        await playbenchDB.saveGame(registeredGame);

        const successRecord: ImportRecord = {
          id: `import-${now}`,
          name: registeredGame.title,
          importMethod: candidate.method,
          source: candidate.sourceIdentifier,
          contentType: candidate.validation.contentType,
          version: registeredGame.version,
          status: 'success',
          validationResult: candidate.validation,
          registeredGameId: registeredGame.id,
          importedAt: now,
        };

        await playbenchDB.saveImportRecord(successRecord);
        return successRecord;
      } else {
        // Custom dataset (question bank, answer bank, entities, metadata)
        const customDataset: CustomGameDataset = {
          id: `dataset-${candidate.id}-${now}`,
          name: candidate.validation.name || candidate.sourceName,
          contentType: candidate.validation.contentType,
          version: candidate.validation.version || '1.0.0',
          data: candidate.validation.manifestData || JSON.parse(candidate.rawJson || '{}'),
          importedAt: now,
        };

        await playbenchDB.saveCustomDataset(customDataset);

        const successRecord: ImportRecord = {
          id: `import-${now}`,
          name: customDataset.name,
          importMethod: candidate.method,
          source: candidate.sourceIdentifier,
          contentType: candidate.validation.contentType,
          version: customDataset.version,
          status: 'success',
          validationResult: candidate.validation,
          importedAt: now,
        };

        await playbenchDB.saveImportRecord(successRecord);
        return successRecord;
      }
    } catch (err: any) {
      const errorRecord: ImportRecord = {
        id: `import-${now}`,
        name: candidate.validation.name || candidate.sourceName,
        importMethod: candidate.method,
        source: candidate.sourceIdentifier,
        contentType: candidate.validation.contentType,
        version: candidate.validation.version,
        status: 'failed',
        validationResult: candidate.validation,
        failureReason: `Import persistence error: ${err.message}`,
        importedAt: now,
      };
      await playbenchDB.saveImportRecord(errorRecord);
      return errorRecord;
    }
  }

  /**
   * Retrieves all logged import history records
   */
  async getHistory(): Promise<ImportRecord[]> {
    return playbenchDB.getAllImportRecords();
  }

  /**
   * Deletes a specific history record
   */
  async deleteHistoryEntry(id: string): Promise<void> {
    return playbenchDB.deleteImportRecord(id);
  }
}

export const importService = new ImportService();
