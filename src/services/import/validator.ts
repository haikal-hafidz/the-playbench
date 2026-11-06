/**
 * Import Content Validator
 *
 * Inspects JSON payloads and TPGP manifests, detecting content type,
 * validating schema conformance, checking required fields and runtime specifications.
 */
import { ValidationResult, GameAuthor } from '../../types';

export class ContentValidator {
  /**
   * Validates raw JSON string or parsed object
   */
  validateJson(jsonString: string): ValidationResult {
    let parsed: any;
    try {
      if (!jsonString || !jsonString.trim()) {
        return {
          status: 'invalid',
          contentType: 'unknown',
          warnings: [],
          errors: ['File is empty or contains only whitespace.'],
          destination: 'unsupported',
          isPlayable: false,
        };
      }
      parsed = JSON.parse(jsonString);
    } catch (err: any) {
      return {
        status: 'invalid',
        contentType: 'unknown',
        warnings: [],
        errors: [`Invalid JSON syntax: ${err.message}`],
        destination: 'unsupported',
        isPlayable: false,
      };
    }

    return this.validateParsedObject(parsed);
  }

  /**
   * Identifies content type and evaluates schema requirements
   */
  validateParsedObject(obj: any): ValidationResult {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      if (Array.isArray(obj)) {
        // Could be a questions or answers array
        if (obj.length > 0 && (obj[0].question || obj[0].prompt)) {
          return {
            status: 'valid',
            contentType: 'question-bank',
            name: 'Imported Question Bank',
            recordCount: obj.length,
            warnings: [],
            errors: [],
            destination: 'custom_datasets',
            isPlayable: false,
            manifestData: obj,
          };
        }
      }
      return {
        status: 'invalid',
        contentType: 'unknown',
        warnings: [],
        errors: ['Root JSON structure must be a valid key-value object.'],
        destination: 'unsupported',
        isPlayable: false,
      };
    }

    // 1. TPGP Manifest check
    if (obj.tpgpVersion || obj.schemaVersion || (obj.id && obj.title && obj.runtime)) {
      return this.validateTpgpManifest(obj);
    }

    // 2. Question Bank format
    if (obj.questions && Array.isArray(obj.questions)) {
      return {
        status: 'valid',
        contentType: 'question-bank',
        name: obj.title || obj.name || 'Question Bank',
        description: obj.description,
        version: obj.version || '1.0.0',
        recordCount: obj.questions.length,
        warnings: [],
        errors: [],
        destination: 'custom_datasets',
        isPlayable: false,
        manifestData: obj,
      };
    }

    // 3. Answer Bank format
    if (obj.answers && Array.isArray(obj.answers)) {
      return {
        status: 'valid',
        contentType: 'answer-bank',
        name: obj.title || obj.name || 'Answer Bank',
        description: obj.description,
        version: obj.version || '1.0.0',
        recordCount: obj.answers.length,
        warnings: [],
        errors: [],
        destination: 'custom_datasets',
        isPlayable: false,
        manifestData: obj,
      };
    }

    // 4. Custom Entities / Tables
    if (obj.entities && Array.isArray(obj.entities)) {
      return {
        status: 'valid',
        contentType: 'custom-entities',
        name: obj.title || obj.name || 'Custom Entity Definitions',
        version: obj.version || '1.0.0',
        entityCount: obj.entities.length,
        warnings: [],
        errors: [],
        destination: 'custom_datasets',
        isPlayable: false,
        manifestData: obj,
      };
    }

    // 5. General Game Metadata
    if (obj.title && obj.description) {
      return {
        status: 'valid-with-warnings',
        contentType: 'game-metadata',
        name: obj.title,
        description: obj.description,
        version: obj.version || '1.0.0',
        warnings: ['File contains game metadata only without runnable entrypoint definition.'],
        errors: [],
        destination: 'custom_datasets',
        isPlayable: false,
        manifestData: obj,
      };
    }

    return {
      status: 'unsupported',
      contentType: 'unknown',
      warnings: [],
      errors: ['Unrecognized JSON structure. Expected TPGP Manifest, Question/Answer Bank, or Entity Schema.'],
      destination: 'unsupported',
      isPlayable: false,
    };
  }

  /**
   * Validates a TPGP package manifest
   */
  validateTpgpManifest(manifest: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required Identity Fields
    if (!manifest.id || typeof manifest.id !== 'string') {
      errors.push('Manifest missing required string property: "id"');
    } else if (!/^[a-z0-9-_]+$/.test(manifest.id)) {
      errors.push('Manifest "id" must contain only lowercase alphanumeric characters, dashes, and underscores.');
    }

    if (!manifest.title || typeof manifest.title !== 'string') {
      errors.push('Manifest missing required string property: "title"');
    }

    if (!manifest.version || typeof manifest.version !== 'string') {
      errors.push('Manifest missing required semver string property: "version"');
    } else if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      warnings.push(`Version "${manifest.version}" does not strictly adhere to SemVer format (x.y.z).`);
    }

    // Runtime requirements
    let runtimeEntrypoint: string | undefined;
    if (!manifest.runtime || typeof manifest.runtime !== 'object') {
      errors.push('Manifest missing required object property: "runtime"');
    } else {
      if (!['html-standalone', 'iframe-bundle', 'canvas-embed'].includes(manifest.runtime.type)) {
        errors.push(`Unsupported runtime type: "${manifest.runtime.type}". Permitted types: html-standalone, iframe-bundle, canvas-embed.`);
      }
      if (!manifest.runtime.entrypoint || typeof manifest.runtime.entrypoint !== 'string') {
        errors.push('Manifest runtime missing required "entrypoint" file path.');
      } else {
        runtimeEntrypoint = manifest.runtime.entrypoint;
      }
    }

    // Players config
    if (!manifest.players || typeof manifest.players !== 'object') {
      warnings.push('Manifest missing "players" object. Defaulting to 1-player solo.');
    }

    const status = errors.length > 0 ? 'invalid' : (warnings.length > 0 ? 'valid-with-warnings' : 'valid');
    const author: GameAuthor | undefined = manifest.author ? {
      name: manifest.author.name || 'Anonymous',
      url: manifest.author.url,
      email: manifest.author.email,
    } : undefined;

    return {
      status,
      contentType: 'tpgp-manifest',
      name: manifest.title || manifest.id,
      description: manifest.description || manifest.tagline,
      version: manifest.version,
      author,
      warnings,
      errors,
      destination: status === 'invalid' ? 'unsupported' : 'games',
      isPlayable: status !== 'invalid' && !!runtimeEntrypoint,
      runtimeEntrypoint,
      manifestData: manifest,
    };
  }
}

export const contentValidator = new ContentValidator();
