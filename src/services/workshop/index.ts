/**
 * Workshop Project Service
 *
 * Manages game projects, auto-checklist generation, progress calculation, and development brief generation.
 */
import { GameProject, ChecklistItem, CreationLetter, ImprovementLetter } from '../../types';
import { playbenchDB } from '../storage';

export class WorkshopService {
  /**
   * Retrieves all projects from IndexedDB
   */
  async getAllProjects(): Promise<GameProject[]> {
    return playbenchDB.getAllProjects();
  }

  /**
   * Retrieves a single project by ID
   */
  async getProjectById(id: string): Promise<GameProject | undefined> {
    return playbenchDB.getProject(id);
  }

  /**
   * Saves or updates a project in IndexedDB
   */
  async saveProject(project: GameProject): Promise<void> {
    const updatedProject: GameProject = {
      ...project,
      updatedAt: Date.now(),
    };
    return playbenchDB.saveProject(updatedProject);
  }

  /**
   * Deletes a project from IndexedDB
   */
  async deleteProject(id: string): Promise<void> {
    return playbenchDB.deleteProject(id);
  }

  /**
   * Generates a default checklist based on project requirements and workflow type
   */
  generateChecklist(workflowType: 'creation' | 'improvement', creationLetter?: CreationLetter, improvementLetter?: ImprovementLetter): ChecklistItem[] {
    const items: ChecklistItem[] = [];

    if (workflowType === 'creation') {
      items.push({
        id: 'chk-core-loop',
        label: 'Design and prototype core gameplay loop',
        state: 'required',
        completed: false,
      });
      items.push({
        id: 'chk-rules',
        label: 'Formalize win, loss, and draw rules',
        state: 'required',
        completed: false,
      });
      items.push({
        id: 'chk-art',
        label: 'Establish visual identity and asset styles',
        state: 'required',
        completed: false,
      });
      items.push({
        id: 'chk-tpgp',
        label: 'Create tpgp.json manifest and verify entrypoint',
        state: 'required',
        completed: false,
      });
      items.push({
        id: 'chk-saves',
        label: 'Implement platform bridge state persistence (PLAYBENCH_SAVE_REQUEST)',
        state: creationLetter && creationLetter.storageStrategy?.toLowerCase().includes('save') ? 'required' : 'optional',
        completed: false,
      });
      items.push({
        id: 'chk-offline',
        label: 'Verify zero-CDN offline execution capability',
        state: 'required',
        completed: false,
      });
      items.push({
        id: 'chk-audio',
        label: 'Tactile craft sound effects and acoustic cues',
        state: 'optional',
        completed: false,
      });
      items.push({
        id: 'chk-pass-play',
        label: 'Local pass-and-play turn switching mechanics',
        state: 'to-be-decided',
        completed: false,
      });
    } else {
      items.push({
        id: 'chk-analyze-impl',
        label: `Audit existing code for game (${improvementLetter?.targetGameId || 'target'})`,
        state: 'required',
        completed: false,
      });
      items.push({
        id: 'chk-reproduce-bugs',
        label: 'Reproduce and isolate identified bug reports',
        state: 'required',
        completed: false,
      });
      items.push({
        id: 'chk-features',
        label: 'Implement proposed feature additions',
        state: 'required',
        completed: false,
      });
      items.push({
        id: 'chk-balance',
        label: 'Adjust gameplay balance and pacing parameters',
        state: 'optional',
        completed: false,
      });
      items.push({
        id: 'chk-regression',
        label: 'Perform regression verification on existing save data',
        state: 'required',
        completed: false,
      });
      items.push({
        id: 'chk-version-bump',
        label: `Bump version manifest to ${improvementLetter?.targetVersion || 'next release'}`,
        state: 'required',
        completed: false,
      });
    }

    return items;
  }

  /**
   * Calculates completion progress percentage for a checklist
   * Considers only 'required' and 'optional' items.
   */
  calculateProgress(checklist: ChecklistItem[]): number {
    const activeItems = checklist.filter(item => item.state === 'required' || item.state === 'optional');
    if (activeItems.length === 0) return 0;
    const completedCount = activeItems.filter(item => item.completed).length;
    return Math.round((completedCount / activeItems.length) * 100);
  }

  /**
   * Generates an 18-section structured Markdown Development Brief suitable for LLM or developer implementation
   */
  generateDevelopmentBrief(project: GameProject): string {
    const isCreation = project.workflowType === 'creation';
    const c = project.creationLetter;
    const imp = project.improvementLetter;

    let md = `# Game Development Brief: ${project.title}\n\n`;
    md += `> The Playbench Official Engineering Brief — ${isCreation ? 'New Game Creation' : 'Game Improvement'}\n\n`;

    // 1. Executive Summary & Project Metadata
    md += `## 1. Executive Summary & Project Metadata\n`;
    md += `- **Project ID:** \`${project.id}\`\n`;
    md += `- **Workflow Type:** ${project.workflowType}\n`;
    md += `- **Project Status:** ${project.status.toUpperCase()}\n`;
    md += `- **Last Updated:** ${new Date(project.updatedAt).toISOString()}\n`;
    md += `- **Concept Summary:** ${project.conceptNote || c?.tagline || 'Original tabletop game experience'}\n\n`;

    // 2. Creative Vision & Objectives
    md += `## 2. Creative Vision & Core Objectives\n`;
    md += `${c?.creativeVision || (imp ? imp.implementationAudit : '_Vision not specified_')}\n\n`;
    if (c?.objectives) {
      md += `**Key Objectives:**\n${c.objectives}\n\n`;
    }

    // 3. Target Audience & Play Context
    md += `## 3. Target Audience & Play Context\n`;
    md += `- **Target Audience:** ${c?.targetAudience || 'Friends & family (The Playbench public audience)'}\n`;
    md += `- **Play Style:** ${c?.playStyle || 'Solo / Local pass-and-play'}\n`;
    md += `- **Session Length:** ${c?.roundDurationMinutes ? `${c.roundDurationMinutes} minutes per round` : '5-15 minutes casual'}\n\n`;

    // 4. Core Gameplay Mechanics & Loops
    md += `## 4. Core Gameplay Mechanics & Loops\n`;
    md += `${c?.coreRules || imp?.gameplayAdjustments || '_Gameplay loop not defined_'}\n\n`;

    // 5. Turn, Round & Session Structure
    md += `## 5. Turn, Round & Session Structure\n`;
    md += `${c?.turnStructure || `Rounds: ${c?.totalRounds || 1} rounds total`}\n\n`;

    // 6. Win, Loss & Scoring Conditions
    md += `## 6. Win, Loss, Draw & Scoring Conditions\n`;
    md += `${c?.winLossConditions || imp?.scoringChanges || '_Scoring criteria not defined_'}\n\n`;

    // 7. Edge Cases & Rule Exceptions
    md += `## 7. Edge Cases & Rule Exceptions\n`;
    md += `${c?.edgeCases || '_None documented_'}\n\n`;

    // 8. Player Configuration & Roles
    md += `## 8. Player Configuration & Roles\n`;
    md += `- **Player Count:** ${c?.playerCountMin ?? 1} to ${c?.playerCountMax ?? 2}\n`;
    md += `- **Host Participation:** ${c?.hostParticipation ? 'Active participant' : 'Facilitator / Spectator'}\n`;
    md += `- **Roles & Teams:** ${c?.rolesOrTeams || 'Individual free-for-all'}\n\n`;

    // 9. Game Configuration & Difficulty Presets
    md += `## 9. Game Configuration & Difficulty Presets\n`;
    md += `- **Difficulty Levels:** ${c?.difficultyLevels || 'Standard'}\n`;
    md += `- **Config Presets:** ${c?.configPresets || 'Default classic settings'}\n\n`;

    // 10. Data Architecture & Entity Schemas
    md += `## 10. Data Architecture & Entity Schemas\n`;
    if (c?.entities && c.entities.length > 0) {
      c.entities.forEach(entity => {
        md += `### Entity: \`${entity.name}\`\n`;
        md += `${entity.description}\n\n`;
        md += `| Field | Type | Required | Description |\n`;
        md += `| :--- | :--- | :--- | :--- |\n`;
        entity.fields.forEach(f => {
          md += `| \`${f.name}\` | \`${f.type}\` | ${f.required ? 'Yes' : 'No'} | ${f.description || '-'} |\n`;
        });
        md += `\n`;
      });
    } else {
      md += `${imp?.dataArchitectureChanges || '_Single gameState object with slot persistence_'}\n\n`;
    }

    // 11. Storage & State Persistence Architecture
    md += `## 11. Storage & State Persistence Architecture\n`;
    md += `- **Storage Strategy:** ${c?.storageStrategy || 'The Playbench Bridge via IndexedDB (max 256KB)'}\n`;
    md += `- **Save Protocol:** \`PLAYBENCH_SAVE_REQUEST\` & \`PLAYBENCH_RESTORE_REQUEST\`\n\n`;

    // 12. Visual Identity & Art Direction
    md += `## 12. Visual Identity & Art Direction\n`;
    md += `${c?.artStyle || '_Tactile tabletop aesthetic matching the cutting-mat environment_'}\n\n`;

    // 13. Layout Structure & Responsive Behavior
    md += `## 13. Layout Structure & Responsive Behavior\n`;
    md += `${c?.layoutStructure || 'Self-contained responsive canvas/grid fitting 16:9 or 4:3 viewport inside iframe'}\n\n`;

    // 14. Animation, Audio & Tactile Polish
    md += `## 14. Animation, Audio & Tactile Polish\n`;
    md += `${c?.animationPreferences || 'Subtle card flip / token drop feedback with zero external dependencies'}\n\n`;

    // 15. Accessibility & Inclusivity Guidelines
    md += `## 15. Accessibility & Inclusivity Guidelines\n`;
    md += `${c?.accessibilityNotes || 'High contrast text, keyboard navigation support, color-blind friendly cues'}\n\n`;

    // 16. Technical Constraints & TPGP Specification
    md += `## 16. Technical Constraints & TPGP Specification\n`;
    md += `- **Runtime Type:** ${c?.runtimeType || 'iframe-bundle'}\n`;
    md += `- **Offline Support:** ${c?.offlineSupport ? 'Strict zero-CDN offline execution' : 'Standard'}\n`;
    if (c?.constraints && c.constraints.length > 0) {
      c.constraints.forEach(con => {
        md += `- ${con}\n`;
      });
    }
    md += `\n`;

    // 17. Improvement Audit & Regression Controls
    md += `## 17. Improvement Audit & Regression Controls\n`;
    if (imp) {
      md += `**Target Game:** \`${imp.targetGameId}\` (v${imp.currentVersion} -> v${imp.targetVersion})\n`;
      md += `**Audit:** ${imp.implementationAudit}\n`;
      if (imp.bugReports?.length) md += `**Bugs:**\n${imp.bugReports.map(b => `- 🐞 ${b}`).join('\n')}\n`;
      if (imp.uxImprovements) md += `**UX Improvements:** ${imp.uxImprovements}\n`;
      if (imp.acceptanceCriteria?.length) md += `**Acceptance Criteria:**\n${imp.acceptanceCriteria.map(a => `- [ ] ${a}`).join('\n')}\n`;
    } else {
      md += `_Initial release. Ensure backwards-compatible save state schema versioning._\n\n`;
    }

    // 18. Actionable Implementation Checklist
    md += `## 18. Actionable Implementation Checklist\n`;
    project.checklist.forEach(item => {
      const mark = item.completed ? '[x]' : '[ ]';
      const stateBadge = item.state !== 'required' ? ` *(${item.state})*` : '';
      md += `- ${mark} ${item.label}${stateBadge}\n`;
    });

    return md;
  }
}

export const workshopService = new WorkshopService();
