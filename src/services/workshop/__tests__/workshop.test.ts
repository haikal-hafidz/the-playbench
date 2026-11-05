import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { workshopService } from '../index';
import { GameProject } from '../../../types';

describe('WorkshopService Unit & Integration Tests', () => {
  beforeEach(async () => {
    // Clear existing projects in test database
    const projects = await workshopService.getAllProjects();
    for (const p of projects) {
      await workshopService.deleteProject(p.id);
    }
  });

  it('generates a valid 18-section development brief for game creation', () => {
    const project: GameProject = {
      id: 'test-proj-1',
      title: 'Clockwork Token Duel',
      status: 'draft',
      workflowType: 'creation',
      creationLetter: {
        title: 'Clockwork Token Duel',
        tagline: 'A tiny micro-duel with brass tokens',
        targetAudience: 'Tabletop gamers',
        creativeVision: 'Tactile craft feel',
        objectives: 'Collect 3 gears',
        genre: ['Strategy'],
        coreRules: 'Place tokens on grid',
        turnStructure: 'Draw, place, score',
        winLossConditions: 'First to 3 gears wins',
        edgeCases: 'Tie goes to highest token value',
        playerCountMin: 2,
        playerCountMax: 2,
        playStyle: 'pass-and-play',
        hostParticipation: true,
        rolesOrTeams: 'Head to head',
        roundDurationMinutes: 10,
        totalRounds: 3,
        difficultyLevels: 'Standard',
        configPresets: 'Match',
        entities: [
          {
            name: 'GearPiece',
            description: 'Brass gear token',
            fields: [{ name: 'val', type: 'number', required: true, description: 'Power' }]
          }
        ],
        storageStrategy: 'IndexedDB slot',
        artStyle: 'Engraved brass',
        layoutStructure: 'Square board',
        animationPreferences: 'Click feedback',
        accessibilityNotes: 'Distinct gear tooth numbers',
        runtimeType: 'iframe-bundle',
        offlineSupport: true,
        constraints: ['Zero CDN'],
        notes: 'Inspired by miniature mechanical clocks'
      },
      checklist: [
        { id: '1', label: 'Item 1', state: 'required', completed: true },
        { id: '2', label: 'Item 2', state: 'optional', completed: false }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const brief = workshopService.generateDevelopmentBrief(project);

    // Verify 18 sections exist in markdown
    expect(brief).toContain('# Game Development Brief: Clockwork Token Duel');
    expect(brief).toContain('## 1. Executive Summary & Project Metadata');
    expect(brief).toContain('## 2. Creative Vision & Core Objectives');
    expect(brief).toContain('## 3. Target Audience & Play Context');
    expect(brief).toContain('## 4. Core Gameplay Mechanics & Loops');
    expect(brief).toContain('## 5. Turn, Round & Session Structure');
    expect(brief).toContain('## 6. Win, Loss, Draw & Scoring Conditions');
    expect(brief).toContain('## 7. Edge Cases & Rule Exceptions');
    expect(brief).toContain('## 8. Player Configuration & Roles');
    expect(brief).toContain('## 9. Game Configuration & Difficulty Presets');
    expect(brief).toContain('## 10. Data Architecture & Entity Schemas');
    expect(brief).toContain('### Entity: `GearPiece`');
    expect(brief).toContain('## 11. Storage & State Persistence Architecture');
    expect(brief).toContain('## 12. Visual Identity & Art Direction');
    expect(brief).toContain('## 13. Layout Structure & Responsive Behavior');
    expect(brief).toContain('## 14. Animation, Audio & Tactile Polish');
    expect(brief).toContain('## 15. Accessibility & Inclusivity Guidelines');
    expect(brief).toContain('## 16. Technical Constraints & TPGP Specification');
    expect(brief).toContain('## 17. Improvement Audit & Regression Controls');
    expect(brief).toContain('## 18. Actionable Implementation Checklist');
  });

  it('persists and retrieves projects from IndexedDB correctly', async () => {
    const project: GameProject = {
      id: 'proj-persist-test',
      title: 'Persistent Project',
      status: 'active',
      workflowType: 'creation',
      checklist: [
        { id: 'c1', label: 'Task 1', state: 'required', completed: false },
        { id: 'c2', label: 'Task 2', state: 'optional', completed: true },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await workshopService.saveProject(project);

    const retrieved = await workshopService.getProjectById('proj-persist-test');
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe('Persistent Project');
    expect(retrieved?.status).toBe('active');
    expect(retrieved?.checklist.length).toBe(2);

    const all = await workshopService.getAllProjects();
    expect(all.some(p => p.id === 'proj-persist-test')).toBe(true);

    await workshopService.deleteProject('proj-persist-test');
    const afterDelete = await workshopService.getProjectById('proj-persist-test');
    expect(afterDelete).toBeUndefined();
  });

  it('calculates checklist progress accurately based on required and optional items', () => {
    const items = [
      { id: '1', label: 'Req 1', state: 'required' as const, completed: true },
      { id: '2', label: 'Req 2', state: 'required' as const, completed: false },
      { id: '3', label: 'Opt 1', state: 'optional' as const, completed: true },
      { id: '4', label: 'Ignored 1', state: 'not-needed' as const, completed: false },
      { id: '5', label: 'Ignored 2', state: 'to-be-decided' as const, completed: false },
    ];

    // Active items count = 3 (Req 1, Req 2, Opt 1). Completed count = 2.
    // Progress = round(2 / 3 * 100) = 67%
    const progress = workshopService.calculateProgress(items);
    expect(progress).toBe(67);
  });
});
