/**
 * TPGP Platform Bridge
 *
 * Secure postMessage communication layer between host platform and sandboxed game iframe.
 * Validates message origins, message structure, and safely brokers save state reading/writing.
 */
import { playbenchDB } from '../storage';

export type BridgeInboundMessageType =
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
  onReady?: (info: { title?: string; version?: string }) => void;
  onGameOver?: (data: { score?: number; summary?: string }) => void;
  onError?: (err: { message: string }) => void;
  onSaveConfirmed?: (slot: string) => void;
}

export class SandboxBridge {
  private cleanupFn: (() => void) | null = null;

  attach(
    iframeElement: HTMLIFrameElement,
    expectedGameId: string,
    callbacks: BridgeCallbacks = {}
  ): () => void {
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

      switch (data.type) {
        case 'PLAYBENCH_READY': {
          callbacks.onReady?.(data.payload || {});
          break;
        }

        case 'PLAYBENCH_REQUEST_SAVE': {
          const slot = (data.payload && data.payload.slot) || 'default';
          try {
            const saved = await playbenchDB.getSave(expectedGameId, slot);
            this.sendToGame(iframeElement, 'PLAYBENCH_RESTORE_SAVE', {
              gameId: expectedGameId,
              slot: slot,
              saveState: saved ? saved.payload : null,
            });
          } catch (err) {
            console.warn(`Error reading save for ${expectedGameId}:`, err);
          }
          break;
        }

        case 'PLAYBENCH_SAVE_REQUEST': {
          const slot = (data.payload && data.payload.slot) || 'default';
          const state = data.payload && data.payload.state;
          if (state && typeof state === 'object') {
            try {
              await playbenchDB.writeSave({
                id: `${expectedGameId}:${slot}`,
                gameId: expectedGameId,
                slotId: slot,
                payload: state,
                version: '1.0.0',
                savedAt: Date.now(),
              });
              callbacks.onSaveConfirmed?.(slot);
            } catch (err) {
              console.error(`Error persisting save for ${expectedGameId}:`, err);
            }
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
