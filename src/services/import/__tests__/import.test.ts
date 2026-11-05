import { describe, it, expect } from 'vitest';
import { contentValidator } from '../validator';
import { validateRelativeFilePath, PackageSecurityError } from '../security';
import JSZip from 'jszip';

describe('Stage 4: Import Center Security & Validation', () => {
  describe('Path Traversal and Security Boundaries', () => {
    it('accepts safe relative paths', () => {
      expect(validateRelativeFilePath('index.html')).toBe('index.html');
      expect(validateRelativeFilePath('assets/sprites/player.png')).toBe('assets/sprites/player.png');
      expect(validateRelativeFilePath('js/engine/audio/sound.wav')).toBe('js/engine/audio/sound.wav');
    });

    it('rejects directory breakout attempts with ..', () => {
      expect(() => validateRelativeFilePath('../secret.txt')).toThrow(PackageSecurityError);
      expect(() => validateRelativeFilePath('assets/../../etc/passwd')).toThrow(PackageSecurityError);
      expect(() => validateRelativeFilePath('deep/nested/../../../escape.js')).toThrow(PackageSecurityError);
    });

    it('rejects absolute paths', () => {
      expect(() => validateRelativeFilePath('/etc/hosts')).toThrow(PackageSecurityError);
      expect(() => validateRelativeFilePath('\\windows\\system32')).toThrow(PackageSecurityError);
      expect(() => validateRelativeFilePath('C:/Documents/game.json')).toThrow(PackageSecurityError);
    });

    it('rejects nesting deeper than max depth limit', () => {
      const overlyDeep = 'd1/d2/d3/d4/d5/d6/d7/deep_file.png';
      expect(() => validateRelativeFilePath(overlyDeep, 5)).toThrow(PackageSecurityError);
    });
  });

  describe('ContentValidator: JSON Manifests & Datasets', () => {
    it('validates a complete compliant TPGP manifest', () => {
      const validTpgp = JSON.stringify({
        tpgpVersion: '1.0.0',
        id: 'test-puzzle',
        title: 'Test Puzzle',
        version: '1.2.0',
        runtime: {
          type: 'html-standalone',
          entrypoint: 'index.html',
        },
        players: { min: 1, max: 2, type: 'solo' },
      });

      const res = contentValidator.validateJson(validTpgp);
      expect(res.status).toBe('valid');
      expect(res.contentType).toBe('tpgp-manifest');
      expect(res.name).toBe('Test Puzzle');
      expect(res.destination).toBe('games');
      expect(res.isPlayable).toBe(true);
      expect(res.errors.length).toBe(0);
    });

    it('rejects invalid TPGP manifest with missing required fields or bad ID characters', () => {
      const invalidTpgp = JSON.stringify({
        tpgpVersion: '1.0.0',
        id: 'INVALID ID WITH SPACES!',
        // missing title and runtime
      });

      const res = contentValidator.validateJson(invalidTpgp);
      expect(res.status).toBe('invalid');
      expect(res.isPlayable).toBe(false);
      expect(res.destination).toBe('unsupported');
      expect(res.errors.some(e => e.includes('id'))).toBe(true);
      expect(res.errors.some(e => e.includes('title'))).toBe(true);
    });

    it('correctly classifies a question bank JSON dataset', () => {
      const qBank = JSON.stringify({
        title: 'Trivia Master',
        version: '1.0.0',
        questions: [
          { question: 'What is 2+2?', answer: '4' },
          { question: 'What is 3+3?', answer: '6' },
        ],
      });

      const res = contentValidator.validateJson(qBank);
      expect(res.status).toBe('valid');
      expect(res.contentType).toBe('question-bank');
      expect(res.destination).toBe('custom_datasets');
      expect(res.isPlayable).toBe(false);
      expect(res.recordCount).toBe(2);
    });

    it('correctly classifies an answer bank JSON dataset', () => {
      const aBank = JSON.stringify({
        title: 'Word Clues',
        answers: ['APPLE', 'BANANA', 'CHERRY'],
      });

      const res = contentValidator.validateJson(aBank);
      expect(res.status).toBe('valid');
      expect(res.contentType).toBe('answer-bank');
      expect(res.destination).toBe('custom_datasets');
      expect(res.recordCount).toBe(3);
    });

    it('correctly classifies custom entity table definitions', () => {
      const entityJson = JSON.stringify({
        title: 'RPG Schema',
        entities: [
          { name: 'Character', fields: [{ name: 'hp', type: 'number' }] },
          { name: 'InventoryItem', fields: [{ name: 'weight', type: 'number' }] },
        ],
      });

      const res = contentValidator.validateJson(entityJson);
      expect(res.status).toBe('valid');
      expect(res.contentType).toBe('custom-entities');
      expect(res.destination).toBe('custom_datasets');
      expect(res.entityCount).toBe(2);
    });

    it('identifies game metadata without executable entrypoint with a warning', () => {
      const metaOnly = JSON.stringify({
        title: 'Concept Game',
        description: 'An idea for a turn-based board game without code.',
      });

      const res = contentValidator.validateJson(metaOnly);
      expect(res.status).toBe('valid-with-warnings');
      expect(res.contentType).toBe('game-metadata');
      expect(res.destination).toBe('custom_datasets');
      expect(res.isPlayable).toBe(false);
      expect(res.warnings.length).toBeGreaterThan(0);
    });

    it('rejects malformed syntax JSON', () => {
      const malformed = '{ title: "Unquoted key", }';
      const res = contentValidator.validateJson(malformed);
      expect(res.status).toBe('invalid');
      expect(res.errors.some(e => e.includes('Invalid JSON syntax'))).toBe(true);
    });
  });

  describe('ZIP Package Creation & Validation Workflow', () => {
    it('creates and parses a valid TPGP zip package with JSZip', async () => {
      const zip = new JSZip();
      const manifest = {
        tpgpVersion: '1.0.0',
        id: 'tic-tac-toe',
        title: 'Tic Tac Toe',
        version: '1.0.0',
        players: { min: 1, max: 2, type: 'solo' },
        runtime: {
          type: 'html-standalone',
          entrypoint: 'index.html',
        },
      };

      zip.file('tpgp.json', JSON.stringify(manifest));
      zip.file('index.html', '<html><body><h1>Playbench Tic Tac Toe</h1></body></html>');
      zip.file('styles.css', 'body { background: #222; }');

      const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
      expect(zipBuffer.byteLength).toBeGreaterThan(0);

      // Verify unpack logic
      const unzipped = await JSZip.loadAsync(zipBuffer);
      expect(Object.keys(unzipped.files)).toContain('tpgp.json');
      expect(Object.keys(unzipped.files)).toContain('index.html');
      expect(Object.keys(unzipped.files)).toContain('styles.css');

      const manifestStr = await unzipped.files['tpgp.json'].async('string');
      const validation = contentValidator.validateJson(manifestStr);
      expect(validation.status).toBe('valid');
      expect(validation.isPlayable).toBe(true);
      expect(validation.runtimeEntrypoint).toBe('index.html');
    });
  });
});
