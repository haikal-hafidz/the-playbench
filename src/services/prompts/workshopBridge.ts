/**
 * The Playbench — Workshop to Prompt Station Bridge
 *
 * Converts structured GameProject records from The Workshop into PromptFormState,
 * enabling seamless handoff to coding agents without manual data entry.
 */
import { GameProject, PromptFormState, TargetAgent } from '../../types';

export class WorkshopBridge {
  /**
   * Converts a GameProject (creation or improvement) into a structured PromptFormState.
   */
  static convertProjectToPromptState(
    project: GameProject,
    targetAgent: TargetAgent = 'jules'
  ): PromptFormState {
    const isCreation = project.workflowType === 'creation';
    const c = project.creationLetter;
    const imp = project.improvementLetter;

    const title = isCreation
      ? `Implement Game: ${project.title}`
      : `Improve Game: ${imp?.targetGameId || project.title} (Target v${imp?.targetVersion || 'next'})`;

    const templateId = isCreation ? 'game-creation' : 'game-improvement';

    // 1. Project & Application Context
    let projectContext = `Project: ${project.title} (ID: ${project.id})\n`;
    projectContext += `Workflow: ${isCreation ? 'New Game Creation' : 'Game Improvement'}\n`;
    projectContext += `Platform: The Playbench (A personal creative workshop for little games)\n`;
    projectContext += `Target Audience: ${c?.targetAudience || 'Friends & family via public website'}`;

    // 2. Task Objective
    let taskObjective = '';
    if (isCreation) {
      taskObjective = c?.creativeVision || project.conceptNote || `Implement the complete standalone TPGP game package for "${project.title}".`;
    } else {
      taskObjective = imp?.implementationAudit || `Enhance ${imp?.targetGameId || project.title} from v${imp?.currentVersion} to v${imp?.targetVersion}.`;
    }

    // 3. Existing Implementation / Baseline Context
    let existingImplementation = '';
    if (isCreation) {
      existingImplementation = `Game is being developed as a brand new TPGP package. Runtime type: ${c?.runtimeType || 'iframe-bundle'}.\n`;
      if (c?.tagline) existingImplementation += `Tagline: "${c.tagline}"\n`;
      if (c?.genre?.length) existingImplementation += `Genre: ${c.genre.join(', ')}\n`;
      if (c?.artStyle) existingImplementation += `Art Style: ${c.artStyle}\n`;
    } else {
      existingImplementation = `Target Game ID: ${imp?.targetGameId}\n`;
      existingImplementation += `Current Version: v${imp?.currentVersion}\n`;
      existingImplementation += `Target Version: v${imp?.targetVersion}\n`;
      if (imp?.revisionNotes) existingImplementation += `Revision Notes: ${imp.revisionNotes}\n`;
    }

    // 4. Scope of Work
    let scopeOfWork = '';
    if (isCreation) {
      scopeOfWork = `Author public/games/${project.id}/ directory containing index.html, game.js, styles, and a valid tpgp.json manifest.`;
    } else {
      scopeOfWork = `Update game scripts and tpgp.json in public/games/${imp?.targetGameId || project.id}/ to implement requested features and bug fixes.`;
    }

    // 5. Required Functionality
    const requiredFunctionality: string[] = [];
    if (isCreation && c) {
      if (c.coreRules) requiredFunctionality.push(`Core Rules: ${c.coreRules}`);
      if (c.turnStructure) requiredFunctionality.push(`Turn & Round Structure: ${c.turnStructure}`);
      if (c.winLossConditions) requiredFunctionality.push(`Win/Loss Conditions: ${c.winLossConditions}`);
      if (c.edgeCases) requiredFunctionality.push(`Edge Cases: ${c.edgeCases}`);
      requiredFunctionality.push(`Player Configuration: ${c.playerCountMin}-${c.playerCountMax} players (${c.playStyle})`);
      if (c.storageStrategy) requiredFunctionality.push(`Storage Strategy: ${c.storageStrategy}`);
      if (c.entities && c.entities.length > 0) {
        c.entities.forEach(ent => {
          const fieldList = ent.fields.map(f => `${f.name} (${f.type})`).join(', ');
          requiredFunctionality.push(`Data Entity [${ent.name}]: ${ent.description} -> Fields: [${fieldList}]`);
        });
      }
    } else if (imp) {
      if (imp.gameplayAdjustments) requiredFunctionality.push(`Gameplay Adjustments: ${imp.gameplayAdjustments}`);
      if (imp.scoringChanges) requiredFunctionality.push(`Scoring Changes: ${imp.scoringChanges}`);
      if (imp.dataArchitectureChanges) requiredFunctionality.push(`Data Architecture Changes: ${imp.dataArchitectureChanges}`);
      if (imp.uxImprovements) requiredFunctionality.push(`UX Polish: ${imp.uxImprovements}`);
      if (imp.featureRequests?.length) {
        imp.featureRequests.forEach(feat => requiredFunctionality.push(`Feature Request: ${feat}`));
      }
      if (imp.bugReports?.length) {
        imp.bugReports.forEach(bug => requiredFunctionality.push(`Bug Fix: ${bug}`));
      }
      if (imp.balanceAdjustments?.length) {
        imp.balanceAdjustments.forEach(bal => requiredFunctionality.push(`Balance Adjustment: ${bal}`));
      }
    }

    // 6. Constraints
    const constraints: string[] = [
      'Strict zero-CDN offline execution; no remote external asset/script tags allowed',
      'Game code runs inside an isolated iframe sandbox without direct platform storage access',
      'TPGP save state payloads must not exceed 256 KB serialized JSON',
      'Preserve backwards compatibility for existing saves'
    ];
    if (isCreation && c?.constraints?.length) {
      c.constraints.forEach(con => {
        if (!constraints.includes(con)) constraints.push(con);
      });
    }

    // 7. Relevant Files
    const relevantFiles: string[] = isCreation
      ? [
          `public/games/${project.id}/tpgp.json`,
          `public/games/${project.id}/index.html`,
          `public/games/${project.id}/game.js`,
          'docs/TPGP_SPECIFICATION.md',
          'src/services/runtime/sandboxBridge.ts'
        ]
      : [
          `public/games/${imp?.targetGameId || project.id}/tpgp.json`,
          `public/games/${imp?.targetGameId || project.id}/game.js`,
          'src/services/runtime/sandboxBridge.ts'
        ];

    // 8. Instructions from Checklist
    const instructions: string[] = [];
    if (project.checklist && project.checklist.length > 0) {
      project.checklist.forEach(item => {
        const statusMark = item.completed ? '[DONE]' : '[TODO]';
        instructions.push(`${statusMark} (${item.state}) ${item.label}`);
      });
    } else {
      instructions.push('1. Review specifications and create initial files.');
      instructions.push('2. Implement game mechanics.');
      instructions.push('3. Verify in Game Space sandbox.');
    }

    // 9. Verification Requirements
    const verificationRequirements: string[] = [];
    if (imp && imp.acceptanceCriteria?.length) {
      imp.acceptanceCriteria.forEach(crit => verificationRequirements.push(crit));
    } else {
      verificationRequirements.push('Verify game initializes via TPGP handshake (PLAYBENCH_MOUNTED / PLAYBENCH_READY)');
      verificationRequirements.push('Verify state saving and restoring via PLAYBENCH_SAVE_REQUEST');
      verificationRequirements.push('Verify zero console errors during standard gameplay loop');
    }

    // 10. Deliverables
    const deliverables: string[] = [
      `Complete game implementation in public/games/${isCreation ? project.id : (imp?.targetGameId || project.id)}/`,
      'Valid tpgp.json manifest',
      'Verification confirmation checklist'
    ];

    return {
      title,
      targetAgent,
      templateId,
      projectContext,
      taskObjective,
      existingImplementation,
      scopeOfWork,
      requiredFunctionality,
      constraints,
      relevantFiles,
      instructions,
      verificationRequirements,
      deliverables
    };
  }
}
