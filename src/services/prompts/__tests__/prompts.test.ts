import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { PROMPT_TEMPLATES, PromptGenerator, WorkshopBridge } from '../index';
import { playbenchDB } from '../../storage/indexedDb';
import { PromptFormState, SavedPrompt, GameProject } from '../../../types';

describe('Prompt Station Service & Generator Tests', () => {
  beforeEach(async () => {
    // Clear saved prompts before each test
    const prompts = await playbenchDB.getAllSavedPrompts();
    for (const p of prompts) {
      await playbenchDB.deletePrompt(p.id);
    }
  });

  describe('Prompt Templates', () => {
    it('defines all required TPGP domain and general task templates', () => {
      const requiredTemplates = [
        'game-creation',
        'game-improvement',
        'game-integration',
        'game-debugging',
        'game-testing',
        'tpgp-protocol',
        'new-feature',
        'bug-fix',
        'investigate-issue',
        'refactor',
        'ui-ux',
        'code-review',
        'testing-qa',
        'feature-integration'
      ];

      for (const id of requiredTemplates) {
        const tmplId = id as import('../../../types').PromptTemplateId;
        expect(PROMPT_TEMPLATES[tmplId]).toBeDefined();
        expect(PROMPT_TEMPLATES[tmplId].name).toBeTruthy();
        expect(PROMPT_TEMPLATES[tmplId].defaultRequiredFunctionality.length).toBeGreaterThan(0);
        expect(PROMPT_TEMPLATES[tmplId].defaultConstraints.length).toBeGreaterThan(0);
      }
    });

    it('contains strict zero-CDN offline constraints in TPGP templates', () => {
      const creationTemplate = PROMPT_TEMPLATES['game-creation'];
      const hasZeroCdn = creationTemplate.defaultConstraints.some(c =>
        c.toLowerCase().includes('zero-cdn') || c.toLowerCase().includes('offline')
      );
      expect(hasZeroCdn).toBe(true);
    });
  });

  describe('Prompt Generator Engine', () => {
    it('compiles a deterministic markdown prompt containing all structured inputs', () => {
      const formState: PromptFormState = {
        title: 'Custom Test Task',
        targetAgent: 'jules',
        templateId: 'game-creation',
        projectContext: 'The Playbench workbench project.',
        taskObjective: 'Create a tactile card matching game.',
        existingImplementation: 'None, brand new game.',
        scopeOfWork: 'Create public/games/cards/ with index.html and tpgp.json.',
        requiredFunctionality: ['Flip cards on click', 'Check match rules', 'Save scores'],
        constraints: ['Zero CDN scripts', 'Save payload under 256KB'],
        relevantFiles: ['public/games/cards/tpgp.json', 'public/games/cards/game.js'],
        instructions: ['Draft manifest', 'Write game loop', 'Test iframe mounting'],
        verificationRequirements: ['Verify saves persist', 'Verify 60fps animations'],
        deliverables: ['Self-contained bundle', 'Passing unit tests']
      };

      const prompt = PromptGenerator.generatePrompt(formState);

      expect(prompt).toContain('# Custom Test Task');
      expect(prompt).toContain('AI Agent Target: Jules (Software Engineer Agent)');
      expect(prompt).toContain('Create a tactile card matching game.');
      expect(prompt).toContain('Zero CDN scripts');
      expect(prompt).toContain('Save payload under 256KB');
      expect(prompt).toContain('public/games/cards/tpgp.json');
      expect(prompt).toContain('Verify saves persist');
      expect(prompt).toContain('Self-contained bundle');
    });

    it('adapts agent directives according to targetAgent without dropping user requirements', () => {
      const baseState: PromptFormState = {
        title: 'Agent Adaptation Test',
        targetAgent: 'claude',
        templateId: 'bug-fix',
        projectContext: '',
        taskObjective: 'Fix card flip glitch.',
        existingImplementation: '',
        scopeOfWork: '',
        requiredFunctionality: ['Resolve card flip animation lock'],
        constraints: ['Keep existing card data intact'],
        relevantFiles: [],
        instructions: [],
        verificationRequirements: [],
        deliverables: []
      };

      const claudePrompt = PromptGenerator.generatePrompt({ ...baseState, targetAgent: 'claude' });
      expect(claudePrompt).toContain('AI Agent Target: Claude (Anthropic)');
      expect(claudePrompt).toContain('Fix card flip glitch.');
      expect(claudePrompt).toContain('Keep existing card data intact');

      const chatgptPrompt = PromptGenerator.generatePrompt({ ...baseState, targetAgent: 'chatgpt' });
      expect(chatgptPrompt).toContain('AI Agent Target: ChatGPT / OpenAI Coding Assistant');
      expect(chatgptPrompt).toContain('Fix card flip glitch.');
      expect(chatgptPrompt).toContain('Keep existing card data intact');

      const otherPrompt = PromptGenerator.generatePrompt({ ...baseState, targetAgent: 'other' });
      expect(otherPrompt).toContain('AI Agent Target: Coding Agent');
      expect(otherPrompt).toContain('Fix card flip glitch.');
    });

    it('handles empty optional fields gracefully with fallbacks', () => {
      const minimalState: PromptFormState = {
        title: '',
        targetAgent: 'jules',
        templateId: 'game-creation',
        projectContext: '',
        taskObjective: '',
        existingImplementation: '',
        scopeOfWork: '',
        requiredFunctionality: [],
        constraints: [],
        relevantFiles: [],
        instructions: [],
        verificationRequirements: [],
        deliverables: []
      };

      const prompt = PromptGenerator.generatePrompt(minimalState);
      expect(prompt).toContain('# Software Engineering Task');
      expect(prompt).toContain('Execute the requested software engineering task');
    });
  });

  describe('Workshop Integration Bridge', () => {
    it('converts a creation GameProject into PromptFormState accurately', () => {
      const sampleCreationProject: GameProject = {
        id: 'dice-duel',
        title: 'Dice Duel',
        status: 'active',
        workflowType: 'creation',
        conceptNote: 'Fast-paced two player dice rolling combat.',
        creationLetter: {
          title: 'Dice Duel',
          tagline: 'Roll for glory.',
          targetAudience: 'Friends & tabletop gamers',
          creativeVision: 'Tactile wooden dice dueling game.',
          objectives: 'Defeat opponent by rolling strategic combinations.',
          genre: ['Dice', 'Strategy'],
          coreRules: 'Players take turns rolling 5 dice with rerolls.',
          turnStructure: '3 rolls per turn, 5 rounds total.',
          winLossConditions: 'Highest cumulative score wins.',
          edgeCases: 'Ties resolved by sudden death roll.',
          playerCountMin: 2,
          playerCountMax: 2,
          playStyle: 'pass-and-play',
          hostParticipation: true,
          rolesOrTeams: 'Individual 1v1',
          roundDurationMinutes: 5,
          totalRounds: 5,
          difficultyLevels: 'Standard',
          configPresets: 'Classic 5-die set',
          entities: [
            {
              name: 'PlayerScore',
              description: 'Tracks rounds won and total points.',
              fields: [
                { name: 'roundWins', type: 'number', required: true, description: 'Rounds won' },
                { name: 'totalPoints', type: 'number', required: true, description: 'Accumulated score' }
              ]
            }
          ],
          storageStrategy: 'IndexedDB slot saves',
          artStyle: 'Warm carved wood aesthetic',
          layoutStructure: 'Top/bottom split screen for pass-and-play',
          animationPreferences: '3D physics tumbling dice simulation',
          accessibilityNotes: 'High contrast dice pips and voice announcement option',
          runtimeType: 'iframe-bundle',
          offlineSupport: true,
          constraints: ['No WebGL external heavy engines; use Canvas 2D or lightweight CSS']
        },
        checklist: [
          { id: '1', label: 'Design dice physics', state: 'required', completed: true },
          { id: '2', label: 'Implement scoring rules', state: 'required', completed: false }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const promptState = WorkshopBridge.convertProjectToPromptState(sampleCreationProject, 'jules');

      expect(promptState.title).toBe('Implement Game: Dice Duel');
      expect(promptState.templateId).toBe('game-creation');
      expect(promptState.projectContext).toContain('Dice Duel');
      expect(promptState.taskObjective).toBe('Tactile wooden dice dueling game.');
      expect(promptState.requiredFunctionality.some(r => r.includes('Core Rules'))).toBe(true);
      expect(promptState.requiredFunctionality.some(r => r.includes('Data Entity [PlayerScore]'))).toBe(true);
      expect(promptState.constraints).toContain('No WebGL external heavy engines; use Canvas 2D or lightweight CSS');
      expect(promptState.instructions.some(i => i.includes('[DONE]') && i.includes('Design dice physics'))).toBe(true);
      expect(promptState.instructions.some(i => i.includes('[TODO]') && i.includes('Implement scoring rules'))).toBe(true);
    });

    it('converts an improvement GameProject into PromptFormState accurately', () => {
      const sampleImprovementProject: GameProject = {
        id: 'number-guess-enhancement',
        title: 'Number Guess V2',
        status: 'active',
        workflowType: 'improvement',
        targetGameId: 'number-guess',
        improvementLetter: {
          targetGameId: 'number-guess',
          currentVersion: '1.0.0',
          targetVersion: '1.1.0',
          implementationAudit: 'Number Guess lacks audio feedback and difficulty toggles.',
          gameplayAdjustments: 'Add 1-50 Easy mode and 1-500 Hard mode.',
          scoringChanges: 'Bonus points for guessing in fewer than 4 attempts.',
          dataArchitectureChanges: 'Save high scores per difficulty preset.',
          uxImprovements: 'Add tactile click audio when guessing.',
          bugReports: ['Guess counter does not reset on restart.'],
          featureRequests: ['Difficulty selector dropdown'],
          balanceAdjustments: ['Allow 7 guesses in Easy mode, 5 in Hard mode'],
          acceptanceCriteria: ['All difficulties work', 'Save persists high score per mode'],
          revisionNotes: 'Ready for release.'
        },
        checklist: [
          { id: 'c1', label: 'Add audio clicks', state: 'required', completed: false }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const promptState = WorkshopBridge.convertProjectToPromptState(sampleImprovementProject, 'claude');

      expect(promptState.title).toContain('Improve Game: number-guess');
      expect(promptState.templateId).toBe('game-improvement');
      expect(promptState.taskObjective).toContain('Number Guess lacks audio feedback');
      expect(promptState.requiredFunctionality.some(r => r.includes('Bonus points'))).toBe(true);
      expect(promptState.requiredFunctionality.some(r => r.includes('Bug Fix: Guess counter does not reset'))).toBe(true);
      expect(promptState.verificationRequirements).toContain('All difficulties work');
    });
  });

  describe('IndexedDB Saved Prompts Persistence', () => {
    it('saves, retrieves, and deletes saved prompt records', async () => {
      const prompt: SavedPrompt = {
        id: 'test-prompt-1',
        title: 'Unit Test Prompt',
        targetAgent: 'jules',
        templateId: 'game-creation',
        formState: {
          title: 'Unit Test Prompt',
          targetAgent: 'jules',
          templateId: 'game-creation',
          projectContext: 'Ctx',
          taskObjective: 'Obj',
          existingImplementation: '',
          scopeOfWork: '',
          requiredFunctionality: ['Feature 1'],
          constraints: ['Constraint 1'],
          relevantFiles: [],
          instructions: [],
          verificationRequirements: [],
          deliverables: []
        },
        generatedText: '# Unit Test Prompt\nSample generated markdown',
        createdAt: 1000,
        updatedAt: 2000
      };

      await playbenchDB.savePrompt(prompt);

      const retrieved = await playbenchDB.getSavedPrompt('test-prompt-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Unit Test Prompt');
      expect(retrieved?.targetAgent).toBe('jules');
      expect(retrieved?.generatedText).toContain('Sample generated markdown');

      const all = await playbenchDB.getAllSavedPrompts();
      expect(all.length).toBe(1);
      expect(all[0].id).toBe('test-prompt-1');

      await playbenchDB.deletePrompt('test-prompt-1');
      const afterDelete = await playbenchDB.getSavedPrompt('test-prompt-1');
      expect(afterDelete).toBeUndefined();
    });
  });
});
