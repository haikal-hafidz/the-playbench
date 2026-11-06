/**
 * The Playbench — Prompt Generator Engine
 *
 * Deterministically compiles structured PromptFormState into rich, copyable English prompts.
 * Provides target-agent adaptation while strictly preserving all user-supplied requirements and constraints.
 */
import { PromptFormState, TargetAgent } from '../../types';

export class PromptGenerator {
  /**
   * Generates agent-specific framing header and guidelines
   */
  private static getAgentFraming(agent: TargetAgent): string {
    switch (agent) {
      case 'jules':
        return [
          '### AI Agent Target: Jules (Software Engineer Agent)',
          '- **Execution Directives:** Formulate a structured step-by-step plan before making changes. Use available sandbox tools efficiently.',
          '- **Verification Requirements:** Every file modification must be verified using read-only inspection tools before marking steps complete.',
          '- **Safety & Quality:** Practice test-driven development, execute relevant test suites (`npm test`), run production builds (`npm run build`), and verify zero regressions.',
          '- **Submission:** Conclude with required pre-commit checks and submit cleanly with Git-standard commit messages.'
        ].join('\n');

      case 'claude':
        return [
          '### AI Agent Target: Claude (Anthropic)',
          '- **Execution Directives:** Think systematically through architectural requirements and edge cases. Provide comprehensive, production-grade solutions.',
          '- **Code Delivery:** Deliver complete code blocks without skipping sections or using placeholders (`// ... existing code ...`).',
          '- **Architecture Focus:** Maintain strict separation of concerns, verify strong type safety, and adhere to established design systems.'
        ].join('\n');

      case 'chatgpt':
        return [
          '### AI Agent Target: ChatGPT / OpenAI Coding Assistant',
          '- **Execution Directives:** Follow a clear, methodical plan. State assumptions and explain architectural rationale clearly.',
          '- **Code Delivery:** Provide self-contained, drop-in replacement code blocks with explicit file paths and instructions.',
          '- **Verification:** Detail clear step-by-step manual and automated verification instructions.'
        ].join('\n');

      case 'other':
      default:
        return [
          '### AI Agent Target: Coding Agent',
          '- **Execution Directives:** Follow software engineering best practices. Maintain strict fidelity to project architecture, types, and constraints.',
          '- **Verification:** Ensure all code builds cleanly with zero errors and passes all test suites.'
        ].join('\n');
    }
  }

  /**
   * Compiles the complete structured prompt text deterministically.
   */
  public static generatePrompt(state: PromptFormState): string {
    const lines: string[] = [];

    // Title / Header
    const title = state.title.trim() || 'Software Engineering Task';
    lines.push(`# ${title}`);
    lines.push('');

    // Agent framing
    lines.push(this.getAgentFraming(state.targetAgent));
    lines.push('');

    // Project Context
    if (state.projectContext && state.projectContext.trim()) {
      lines.push('## 1. Project & Application Context');
      lines.push(state.projectContext.trim());
      lines.push('');
    }

    // Task Objective
    lines.push('## 2. Task Objective');
    if (state.taskObjective && state.taskObjective.trim()) {
      lines.push(state.taskObjective.trim());
    } else {
      lines.push('Execute the requested software engineering task meeting all specifications below.');
    }
    lines.push('');

    // Existing Implementation / Baseline Context
    if (state.existingImplementation && state.existingImplementation.trim()) {
      lines.push('## 3. Existing Implementation & Baseline Context');
      lines.push(state.existingImplementation.trim());
      lines.push('');
    }

    // Scope of Work
    if (state.scopeOfWork && state.scopeOfWork.trim()) {
      lines.push('## 4. Scope of Work');
      lines.push(state.scopeOfWork.trim());
      lines.push('');
    }

    // Required Functionality
    const reqs = (state.requiredFunctionality || []).filter(r => r && r.trim().length > 0);
    if (reqs.length > 0) {
      lines.push('## 5. Required Functionality');
      reqs.forEach((r, idx) => {
        lines.push(`${idx + 1}. ${r.trim()}`);
      });
      lines.push('');
    }

    // Constraints & Invariants (Must NEVER be dropped)
    const constraints = (state.constraints || []).filter(c => c && c.trim().length > 0);
    if (constraints.length > 0) {
      lines.push('## 6. Constraints & Invariants (DO NOT MODIFY OR VIOLATE)');
      constraints.forEach(c => {
        lines.push(`- ⚠️ **${c.trim()}**`);
      });
      lines.push('');
    }

    // Relevant Files & Modules
    const files = (state.relevantFiles || []).filter(f => f && f.trim().length > 0);
    if (files.length > 0) {
      lines.push('## 7. Relevant Files & Modules');
      files.forEach(f => {
        lines.push(`- \`${f.trim()}\``);
      });
      lines.push('');
    }

    // Implementation Instructions
    const instructions = (state.instructions || []).filter(i => i && i.trim().length > 0);
    if (instructions.length > 0) {
      lines.push('## 8. Step-by-Step Implementation Instructions');
      instructions.forEach((inst, idx) => {
        lines.push(`${idx + 1}. ${inst.trim()}`);
      });
      lines.push('');
    }

    // Verification & Quality Assurance Requirements
    const verifications = (state.verificationRequirements || []).filter(v => v && v.trim().length > 0);
    if (verifications.length > 0) {
      lines.push('## 9. Testing & Verification Requirements');
      verifications.forEach(v => {
        lines.push(`- [ ] ${v.trim()}`);
      });
      lines.push('');
    }

    // Expected Deliverables & Reporting Format
    const deliverables = (state.deliverables || []).filter(d => d && d.trim().length > 0);
    if (deliverables.length > 0) {
      lines.push('## 10. Expected Deliverables & Completion Report');
      deliverables.forEach(d => {
        lines.push(`- ${d.trim()}`);
      });
      lines.push('');
    }

    // Concluding Directive
    lines.push('---');
    lines.push('*Preserve all existing functionality, verify code thoroughly, and report exact verification results upon completion.*');

    return lines.join('\n');
  }
}
