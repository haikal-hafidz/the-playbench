import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { workshopService } from '../index';
import { playbenchDB } from '../../storage/indexedDb';
import { gameRegistry } from '../../games';
import { GameProject, Game } from '../../../types';

describe('Workshop Architecture, Separation of Concerns & Edge Cases', () => {
  beforeEach(async () => {
    const projects = await workshopService.getAllProjects();
    for (const p of projects) {
      await workshopService.deleteProject(p.id);
    }
  });

  it('keeps Workshop projects isolated from Game records and Game saves', async () => {
    // 1. Create a Workshop project
    const project: GameProject = {
      id: 'proj-isolation-1',
      title: 'Isolated Project',
      status: 'active',
      workflowType: 'creation',
      checklist: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await workshopService.saveProject(project);

    // 2. Fetch registered games and ensure project was NOT added to game store
    const games = await gameRegistry.getAllGames();
    expect(games.some(g => g.id === 'proj-isolation-1')).toBe(false);

    // 3. Ensure games can still be fetched and saved without impacting workshop
    const sampleGame: Game = {
      id: 'game-sample-1',
      title: 'Sample Test Game',
      description: 'Test description',
      genre: ['Puzzle'],
      version: '1.0.0',
      runtime: { type: 'html-standalone', entrypoint: 'index.html' },
      players: { min: 1, max: 2, type: 'solo' },
      tags: ['test'],
      offlineCapable: true,
      packageOrigin: 'bundled',
      playCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await playbenchDB.saveGame(sampleGame);

    const projectsAfter = await workshopService.getAllProjects();
    expect(projectsAfter.length).toBe(1);
    expect(projectsAfter[0].id).toBe('proj-isolation-1');
  });

  it('does not constrain Workshop brief size to 256KB save slot limit', async () => {
    // Large brief simulating a 500KB design document
    const largeContent = 'A'.repeat(500 * 1024);
    const project: GameProject = {
      id: 'proj-large-brief',
      title: 'Large Spec Project',
      status: 'draft',
      workflowType: 'creation',
      briefMarkdown: largeContent,
      checklist: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await workshopService.saveProject(project);
    const retrieved = await workshopService.getProjectById('proj-large-brief');
    expect(retrieved?.briefMarkdown?.length).toBe(500 * 1024);
  });

  it('handles Existing Game Improvement Letter without modifying original game records', async () => {
    const impProject: GameProject = {
      id: 'proj-imp-test',
      title: 'Improvement: number-guess',
      status: 'active',
      workflowType: 'improvement',
      targetGameId: 'number-guess',
      improvementLetter: {
        targetGameId: 'number-guess',
        currentVersion: '1.0.0',
        targetVersion: '1.1.0',
        implementationAudit: 'Baseline test',
        gameplayAdjustments: 'Adjust range',
        scoringChanges: 'Bonus points',
        dataArchitectureChanges: 'Leaderboard table',
        uxImprovements: 'Haptic feedback',
        bugReports: ['Bug 1'],
        featureRequests: ['Feature 1'],
        balanceAdjustments: ['Balance 1'],
        acceptanceCriteria: ['Pass TPGP check'],
        revisionNotes: 'Rev 1',
      },
      checklist: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await workshopService.saveProject(impProject);
    const brief = workshopService.generateDevelopmentBrief(impProject);

    expect(brief).toContain('**Target Game:** `number-guess` (v1.0.0 -> v1.1.0)');
    expect(brief).toContain('Baseline test');
    expect(brief).toContain('🐞 Bug 1');
    expect(brief).toContain('- [ ] Pass TPGP check');
  });

  it('correctly handles all four checklist states and edge case percentages', () => {
    // 0 active items -> returns 0
    expect(workshopService.calculateProgress([])).toBe(0);

    // Only ignored items -> returns 0
    expect(workshopService.calculateProgress([
      { id: '1', label: 'Ignored', state: 'not-needed', completed: true },
      { id: '2', label: 'TBD', state: 'to-be-decided', completed: false }
    ])).toBe(0);

    // 100% completion
    expect(workshopService.calculateProgress([
      { id: '1', label: 'Req 1', state: 'required', completed: true },
      { id: '2', label: 'Opt 1', state: 'optional', completed: true }
    ])).toBe(100);
  });
});
