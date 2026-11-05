/**
 * TPGP Platform Bridge
 *
 * Secure postMessage communication layer between host platform and sandboxed game iframe.
 * Validates message origins, message structure, and safely brokers save state reading/writing.
 */
import { playbenchDB } from '../storage';

export type BridgeInboundMessageType =
  | 'PLAYBENCH_MOUNTED'
  | 'PLAYBENCH_READY'
  | 'PLAYBENCH_REQUEST_SAVE'
  | 'PLAYBENCH_SAVE_REQUEST'
  | 'PLAYBENCH_GAME_OVER'
  | 'PLAYBENCH_ERROR';

export interface BridgeMessageEnvelope {
  source: 'tpgp-game';
  gameId: string;
  type: BridgeInboundMessageType;
  payload?: any;
}

export interface BridgeCallbacks {
  onMounted?: () => void;
  onReady?: (info: { title?: string; version?: string }) => void;
  onGameOver?: (data: { score?: number; summary?: string }) => void;
  onError?: (err: { message: string }) => void;
  onSaveConfirmed?: (slot: string) => void;
  onSaveError?: (slot: string, error: string) => void;
}

export interface BridgeAttachOptions {
  maxSaveSlots?: number;
  gameVersion?: string;
}

const SLOT_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;
const MAX_SAVE_PAYLOAD_BYTES = 256 * 1024; // 256 KB
const DEFAULT_MAX_SLOTS = 5;

/**
 * Compare two semver-like strings (major.minor.patch).
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, and 0 if equal.
 */
export function compareSemver(v1: string, v2: string): number {
  const parse = (v: string) => {
    const parts = (v || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  };
  const [maj1, min1, pat1] = parse(v1);
  const [maj2, min2, pat2] = parse(v2);

  if (maj1 !== maj2) return maj1 - maj2;
  if (min1 !== min2) return min1 - min2;
  return pat1 - pat2;
}

export class SandboxBridge {
  private cleanupFn: (() => void) | null = null;

  attach(
    iframeElement: HTMLIFrameElement,
    expectedGameId: string,
    callbacks: BridgeCallbacks = {},
    options: BridgeAttachOptions = {}
  ): () => void {
    // Clean up any previously attached listener to prevent duplicate event listeners
    this.detach();

    const maxSlots = options.maxSaveSlots || DEFAULT_MAX_SLOTS;

    const handleMessage = async (event: MessageEvent) => {
      // Validate that message came from the target iframe's contentWindow
      if (!iframeElement.contentWindow || event.source !== iframeElement.contentWindow) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // Validate envelope structure
      if (data.source !== 'tpgp-game' || data.gameId !== expectedGameId || typeof data.type !== 'string') {
        return;
      }

      switch (data.type as BridgeInboundMessageType) {
        case 'PLAYBENCH_MOUNTED': {
          callbacks.onMounted?.();
          // Dispatch PLAYBENCH_INIT with initial save state
          await this.dispatchInit(iframeElement, expectedGameId, options.gameVersion || '1.0.0');
          break;
        }

        case 'PLAYBENCH_READY': {
          callbacks.onReady?.(data.payload || {});
          break;
        }

        case 'PLAYBENCH_REQUEST_SAVE': {
          const rawSlot = data.payload && data.payload.slot;
          const slot = (typeof rawSlot === 'string' && SLOT_REGEX.test(rawSlot)) ? rawSlot : 'default';

          try {
            const saved = await playbenchDB.getSave(expectedGameId, slot);
            this.sendToGame(iframeElement, 'PLAYBENCH_RESTORE_SAVE', {
              gameId: expectedGameId,
              slot: slot,
              saveState: saved ? saved.payload : null,
              schemaVersion: saved ? saved.version : undefined,
            });
          } catch (err: any) {
            console.warn(`Error reading save for ${expectedGameId}:`, err);
            this.sendToGame(iframeElement, 'PLAYBENCH_RESTORE_SAVE', {
              gameId: expectedGameId,
              slot: slot,
              saveState: null,
              error: err?.message || 'Failed to read save',
            });
          }
          break;
        }

        case 'PLAYBENCH_SAVE_REQUEST': {
          const payload = data.payload;
          if (!payload || typeof payload !== 'object') {
            this.sendSaveResult(iframeElement, 'unknown', false, 'Invalid save request payload structure');
            callbacks.onSaveError?.('unknown', 'Invalid save request payload structure');
            return;
          }

          const rawSlot = payload.slot || 'default';
          if (typeof rawSlot !== 'string' || !SLOT_REGEX.test(rawSlot)) {
            this.sendSaveResult(iframeElement, String(rawSlot), false, `Invalid slot identifier: "${rawSlot}". Must match /^[a-zA-Z0-9_-]{1,32}$/`);
            callbacks.onSaveError?.(String(rawSlot), 'Invalid slot identifier');
            return;
          }
          const slot = rawSlot;

          const state = payload.state;
          if (!state || typeof state !== 'object' || Array.isArray(state)) {
            this.sendSaveResult(iframeElement, slot, false, 'Save state must be a non-empty object');
            callbacks.onSaveError?.(slot, 'Save state must be a non-empty object');
            return;
          }

          let serialized: string;
          try {
            serialized = JSON.stringify(state);
          } catch {
            this.sendSaveResult(iframeElement, slot, false, 'Save state contains circular references or could not be serialized to JSON');
            callbacks.onSaveError?.(slot, 'Serialization error');
            return;
          }

          if (new Blob([serialized]).size > MAX_SAVE_PAYLOAD_BYTES) {
            this.sendSaveResult(iframeElement, slot, false, `Save payload exceeds maximum allowed size of ${MAX_SAVE_PAYLOAD_BYTES / 1024} KB`);
            callbacks.onSaveError?.(slot, 'Save payload exceeds size limit');
            return;
          }

          try {
            // Check slot count limit
            const existingSaves = await playbenchDB.getSavesForGame(expectedGameId);
            const slotAlreadyExists = existingSaves.some(s => s.slotId === slot);

            if (!slotAlreadyExists && existingSaves.length >= maxSlots) {
              const errMsg = `Maximum save slots reached (${maxSlots}). Cannot create new slot "${slot}".`;
              this.sendSaveResult(iframeElement, slot, false, errMsg);
              callbacks.onSaveError?.(slot, errMsg);
              return;
            }

            // Schema version compatibility check
            const incomingSchemaVersion = (typeof payload.schemaVersion === 'string') ? payload.schemaVersion : '1.0.0';
            const existingSave = existingSaves.find(s => s.slotId === slot);

            if (existingSave && existingSave.version) {
              const comparison = compareSemver(existingSave.version, incomingSchemaVersion);
              // If existing save is of a higher major version or newer semver, prevent downgrade overwrite
              const existingMajor = parseInt(existingSave.version.split('.')[0] || '0', 10);
              const incomingMajor = parseInt(incomingSchemaVersion.split('.')[0] || '0', 10);
              if (existingMajor > incomingMajor || (existingMajor === incomingMajor && comparison > 0)) {
                const errMsg = `Save version conflict: existing save is v${existingSave.version}, but incoming is v${incomingSchemaVersion}. Downgrade prohibited.`;
                this.sendSaveResult(iframeElement, slot, false, errMsg);
                callbacks.onSaveError?.(slot, errMsg);
                return;
              }
            }

            // Write to IndexedDB (resolved only after tx.oncomplete)
            await playbenchDB.writeSave({
              id: `${expectedGameId}:${slot}`,
              gameId: expectedGameId,
              slotId: slot,
              payload: JSON.parse(serialized),
              version: incomingSchemaVersion,
              savedAt: Date.now(),
            });

            this.sendSaveResult(iframeElement, slot, true);
            callbacks.onSaveConfirmed?.(slot);
          } catch (err: any) {
            const errMsg = err?.message || 'Database error occurred while persisting save';
            console.error(`Error persisting save for ${expectedGameId}:`, err);
            this.sendSaveResult(iframeElement, slot, false, errMsg);
            callbacks.onSaveError?.(slot, errMsg);
          }
          break;
        }

        case 'PLAYBENCH_GAME_OVER': {
          callbacks.onGameOver?.(data.payload || {});
          break;
        }

        case 'PLAYBENCH_ERROR': {
          callbacks.onError?.(data.payload || { message: 'Unknown game error' });
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);

    this.cleanupFn = () => {
      window.removeEventListener('message', handleMessage);
    };

    return this.cleanupFn;
  }

  async dispatchInit(iframeElement: HTMLIFrameElement, gameId: string, version: string): Promise<void> {
    try {
      const defaultSave = await playbenchDB.getSave(gameId, 'default');
      this.sendToGame(iframeElement, 'PLAYBENCH_INIT', {
        gameId: gameId,
        version: version,
        saveState: defaultSave ? defaultSave.payload : null,
      });
    } catch {
      this.sendToGame(iframeElement, 'PLAYBENCH_INIT', {
        gameId: gameId,
        version: version,
        saveState: null,
      });
    }
  }

  private sendSaveResult(iframeElement: HTMLIFrameElement, slot: string, success: boolean, error?: string): void {
    this.sendToGame(iframeElement, 'PLAYBENCH_SAVE_RESULT', {
      success: success,
      slot: slot,
      error: error,
    });
  }

  sendToGame(iframeElement: HTMLIFrameElement, type: string, payload: any): void {
    if (iframeElement.contentWindow) {
      iframeElement.contentWindow.postMessage(
        {
          source: 'playbench-host',
          type: type,
          payload: payload,
        },
        '*'
      );
    }
  }

  detach(): void {
    if (this.cleanupFn) {
      this.cleanupFn();
      this.cleanupFn = null;
    }
  }
}
