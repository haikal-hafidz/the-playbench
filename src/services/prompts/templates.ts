/**
 * The Playbench — Prompt Templates Library
 *
 * Provides structured built-in templates for TPGP game engineering and common coding workflows.
 */
import { PromptTemplate, PromptTemplateId } from '../../types';

export const PROMPT_TEMPLATES: Record<PromptTemplateId, PromptTemplate> = {
  // --- TPGP Domain Templates (Section 9) ---
  'game-creation': {
    id: 'game-creation',
    name: 'Game Creation Prompt',
    category: 'tpgp',
    description: 'Transform high-level game concepts into compliant, standalone TPGP packages ready for The Playbench.',
    defaultTitle: 'Create New TPGP Game Package',
    defaultTaskObjective: 'Implement a new standalone, tactile mini-game conforming to The Playbench Game Package (TPGP 1.0) standard.',
    defaultScopeOfWork: 'Create self-contained HTML/CSS/JS or Canvas bundle in public/games/<game-id>/ with a valid tpgp.json manifest.',
    defaultRequiredFunctionality: [
      'Interactive gameplay loop matching core game rules',
      'TPGP lifecycle handshake (PLAYBENCH_MOUNTED -> PLAYBENCH_INIT -> PLAYBENCH_READY)',
      'State persistence integration via PLAYBENCH_SAVE_REQUEST and PLAYBENCH_RESTORE_REQUEST',
      'Tactile artisan aesthetic matching The Playbench tabletop visual direction',
      'Responsive canvas/layout supporting solo and pass-and-play mechanisms'
    ],
    defaultConstraints: [
      'Strict zero-CDN offline execution; all dependencies must be locally bundled',
      'Game code must remain completely decoupled from React or host framework internals',
      'Save state payloads must not exceed 256 KB serialized JSON',
      'Do not attempt direct access to parent localStorage or IndexedDB; use postMessage bridge'
    ],
    defaultRelevantFiles: [
      'public/games/<game-id>/tpgp.json',
      'public/games/<game-id>/index.html',
      'public/games/<game-id>/game.js',
      'docs/TPGP_SPECIFICATION.md'
    ],
    defaultInstructions: [
      '1. Draft and validate the tpgp.json manifest conforming to TPGP 1.0 schema.',
      '2. Build index.html with inline or bundled stylesheet and scripts.',
      '3. Implement postMessage bridge listening for window "message" events from parent.',
      '4. Add tactile audio/visual feedback upon player interaction.',
      '5. Verify flawless execution when loaded inside a sandboxed iframe.'
    ],
    defaultVerificationRequirements: [
      'Verify game initializes cleanly inside iframe sandbox="allow-scripts allow-forms allow-pointer-lock"',
      'Verify save/restore cycles survive browser reloads without data corruption',
      'Verify layout responsiveness across desktop (16:9) and mobile screen dimensions'
    ],
    defaultDeliverables: [
      'Complete playable game bundle in public/games/<game-id>/',
      'Valid tpgp.json manifest with accurate metadata, author, and version properties',
      'Automated or manual verification checklist demonstrating functional gameplay'
    ]
  },

  'game-improvement': {
    id: 'game-improvement',
    name: 'Game Improvement Prompt',
    category: 'tpgp',
    description: 'Add new mechanics, refine balance, and resolve issues in existing registered games.',
    defaultTitle: 'Enhance Existing Game Package',
    defaultTaskObjective: 'Iterate on an existing registered TPGP game to introduce targeted gameplay enhancements, bugfixes, and balance tuning.',
    defaultScopeOfWork: 'Update game scripts, styles, and version manifest while guaranteeing backwards compatibility for save states.',
    defaultRequiredFunctionality: [
      'Implement proposed feature additions and scoring/rule adjustments',
      'Resolve reported gameplay regressions and edge cases',
      'Bump game version manifest semver tag',
      'Ensure backwards-compatible migration for existing player save data'
    ],
    defaultConstraints: [
      'Preserve existing save data compatibility; do not break older save slots',
      'Do not introduce external network dependencies or external font/script links',
      'Retain existing core visual identity while enhancing feedback'
    ],
    defaultRelevantFiles: [
      'public/games/<game-id>/tpgp.json',
      'public/games/<game-id>/game.js',
      'src/services/runtime/sandboxBridge.ts'
    ],
    defaultInstructions: [
      '1. Audit existing implementation and reproduce identified balance issues or bugs.',
      '2. Apply changes incrementally and test with existing save slot payloads.',
      '3. Update tpgp.json version number and record release notes in manifest.',
      '4. Verify regression resilience in both solo and pass-and-play scenarios.'
    ],
    defaultVerificationRequirements: [
      'Confirm older save slot states load without errors in the upgraded version',
      'Verify gameplay balance and scoring rules function as specified'
    ],
    defaultDeliverables: [
      'Updated game files with clean diffs',
      'Bumped version in tpgp.json',
      'Verification confirmation of save state persistence'
    ]
  },

  'game-integration': {
    id: 'game-integration',
    name: 'Game Integration Prompt',
    category: 'tpgp',
    description: 'Wrap standalone third-party web games into isolated, compliant TPGP packages.',
    defaultTitle: 'Integrate Standalone Game to TPGP Standard',
    defaultTaskObjective: 'Package an existing web game into a compliant TPGP bundle for seamless execution in The Playbench Game Space.',
    defaultScopeOfWork: 'Vendor all external dependencies, inject the TPGP bridge listener, and author the tpgp.json manifest.',
    defaultRequiredFunctionality: [
      'TPGP bridge handshake integration (PLAYBENCH_MOUNTED / PLAYBENCH_READY)',
      'Save/restore state serialization hook into game lifecycle',
      'Bundling all external images, fonts, sound files, and scripts locally'
    ],
    defaultConstraints: [
      'Zero external CDN requests; eliminate all third-party script/style tags',
      'Safe file path structures without traversal sequences (..)',
      'Total package size must stay within platform ceilings (<15MB compressed, <30MB decompressed)'
    ],
    defaultRelevantFiles: [
      'docs/TPGP_SPECIFICATION.md',
      'src/services/import/validator.ts',
      'src/services/runtime/sandboxBridge.ts'
    ],
    defaultInstructions: [
      '1. Review the third-party game assets and download all remote dependencies locally.',
      '2. Add the TPGP message listener script to window.',
      '3. Formulate the tpgp.json manifest with proper runtime configuration and entrypoint.',
      '4. Validate the archive structure using the Import Center validator.'
    ],
    defaultVerificationRequirements: [
      'Run Import Center validation checks and verify status is valid with 0 errors',
      'Launch game inside Game Space and verify isolated execution'
    ],
    defaultDeliverables: [
      'Fully self-contained TPGP package (.zip or directory)',
      'Verified tpgp.json manifest'
    ]
  },

  'game-debugging': {
    id: 'game-debugging',
    name: 'Game Debugging Prompt',
    category: 'tpgp',
    description: 'Isolate runtime exceptions, bridge communication drops, or state sync failures.',
    defaultTitle: 'Debug Game Runtime and Platform Bridge',
    defaultTaskObjective: 'Diagnose and resolve runtime bugs or postMessage communication failures occurring in Game Space.',
    defaultScopeOfWork: 'Investigate message events, iframe sandboxing restrictions, and state serialization bottlenecks.',
    defaultRequiredFunctionality: [
      'Identify root cause of runtime error or unexpected freeze',
      'Restore deterministic state synchronization between iframe and host platform',
      'Add defensive error boundaries and descriptive logging'
    ],
    defaultConstraints: [
      'Do not weaken iframe sandboxing attributes (keep sandbox restricted)',
      'Do not pollute global window namespaces'
    ],
    defaultRelevantFiles: [
      'src/services/runtime/sandboxBridge.ts',
      'src/pages/GameSpace/GameSpacePage.tsx'
    ],
    defaultInstructions: [
      '1. Reproduce the bug using browser developer tools and examine console logs.',
      '2. Inspect postMessage event origin and message type payload.',
      '3. Fix the offending logic in the game or sandbox bridge adapter.',
      '4. Validate fix with automated unit tests.'
    ],
    defaultVerificationRequirements: [
      'Confirm error no longer triggers under the reproduction conditions',
      'Ensure zero regressions in sandbox handshake or save operations'
    ],
    defaultDeliverables: [
      'Patched source code resolving the defect',
      'Diagnostic summary explaining root cause and resolution'
    ]
  },

  'game-testing': {
    id: 'game-testing',
    name: 'Game Testing Prompt',
    category: 'tpgp',
    description: 'Author unit, integration, and end-to-end tests for game mechanics and platform contracts.',
    defaultTitle: 'Author Automated Game Verification Suite',
    defaultTaskObjective: 'Implement robust automated tests verifying game logic, rules enforcement, and bridge communications.',
    defaultScopeOfWork: 'Write Vitest and/or Playwright test suites covering critical user journeys and edge cases.',
    defaultRequiredFunctionality: [
      'Core game loop state transition unit tests',
      'Bridge message validation and serialization tests',
      'Edge case tests (empty inputs, maximum score limits, save migrations)'
    ],
    defaultConstraints: [
      'Tests must execute deterministically without flaky timers or race conditions',
      'All test suites must run and pass via npm test'
    ],
    defaultRelevantFiles: [
      'src/services/runtime/__tests__/',
      'src/services/import/__tests__/'
    ],
    defaultInstructions: [
      '1. Define test fixtures and mock iframe message events.',
      '2. Exercise all valid and invalid game actions.',
      '3. Validate error throwing and edge-case handling.',
      '4. Verify 100% pass rate in local test runner.'
    ],
    defaultVerificationRequirements: [
      'Execute vitest run and ensure all suites pass with zero failures'
    ],
    defaultDeliverables: [
      'Comprehensive test file with descriptive describe/it blocks',
      'Test execution logs confirming successful completion'
    ]
  },

  'tpgp-protocol': {
    id: 'tpgp-protocol',
    name: 'TPGP Documentation & Standards Prompt',
    category: 'tpgp',
    description: 'Audit, update, or expand official TPGP specifications and schema requirements.',
    defaultTitle: 'Audit and Update TPGP Specification',
    defaultTaskObjective: 'Review and refine The Playbench Game Package (TPGP) specification and runtime adapter protocols.',
    defaultScopeOfWork: 'Document schema versions, security isolation rules, and message specifications in docs/TPGP_SPECIFICATION.md.',
    defaultRequiredFunctionality: [
      'Clear definition of mandatory and optional tpgp.json properties',
      'Explicit postMessage contract specifications with payload schemas',
      'Security boundaries regarding sandboxed iframes and local storage isolation'
    ],
    defaultConstraints: [
      'Keep documentation synchronized with actual runtime bridge code',
      'Maintain backwards compatibility guidelines for older packages'
    ],
    defaultRelevantFiles: [
      'docs/TPGP_SPECIFICATION.md',
      'docs/ARCHITECTURE.md',
      'src/types/index.ts'
    ],
    defaultInstructions: [
      '1. Inspect current bridge implementation in src/services/runtime/sandboxBridge.ts.',
      '2. Update markdown specifications in docs/ with clear examples and tables.',
      '3. Ensure type definitions align strictly with documented interfaces.'
    ],
    defaultVerificationRequirements: [
      'Cross-check all code examples in docs against actual TypeScript interfaces'
    ],
    defaultDeliverables: [
      'Updated docs/TPGP_SPECIFICATION.md with accurate schemas and examples'
    ]
  },

  // --- General Task Templates ---
  'new-feature': {
    id: 'new-feature',
    name: 'Build a New Feature',
    category: 'general',
    description: 'Implement a new platform feature or submodule from specification to completion.',
    defaultTitle: 'Implement New Feature',
    defaultTaskObjective: 'Build a complete, production-ready feature adhering to The Playbench architectural patterns.',
    defaultScopeOfWork: 'Develop components, services, state management, types, and automated tests for the feature.',
    defaultRequiredFunctionality: [
      'Core UI/UX implementation matching the workbench visual language',
      'State management and persistence layer integration',
      'Responsive design supporting mobile and desktop viewports',
      'Full test coverage with passing unit and integration tests'
    ],
    defaultConstraints: [
      'Do not modify existing unrelated modules or introduce unnecessary dependencies',
      'Ensure zero TypeScript compilation errors and clean production build'
    ],
    defaultRelevantFiles: [
      'src/components/',
      'src/pages/',
      'src/types/index.ts'
    ],
    defaultInstructions: [
      '1. Review requirements and verify existing components to reuse.',
      '2. Implement data structures and business logic services.',
      '3. Build the UI components following established design tokens.',
      '4. Add automated tests and verify build output.'
    ],
    defaultVerificationRequirements: [
      'npm test passes cleanly',
      'npm run build generates valid production bundle without warnings'
    ],
    defaultDeliverables: [
      'Completed feature code',
      'Automated test suites',
      'Verification confirmation'
    ]
  },

  'bug-fix': {
    id: 'bug-fix',
    name: 'Fix a Bug',
    category: 'general',
    description: 'Diagnose, isolate, and repair a bug without causing regressions.',
    defaultTitle: 'Fix Platform Bug',
    defaultTaskObjective: 'Resolve an identified issue while maintaining complete backward compatibility and system stability.',
    defaultScopeOfWork: 'Pinpoint bug root cause, write a regression test, and implement the minimal targeted fix.',
    defaultRequiredFunctionality: [
      'Defect is completely resolved under all reproduction conditions',
      'Regression test added to prevent recurrence',
      'Surrounding unaffected code remains untouched'
    ],
    defaultConstraints: [
      'Do not introduce wide architectural rewrites for isolated bugs',
      'Keep diffs clean and focused solely on the problem area'
    ],
    defaultRelevantFiles: [],
    defaultInstructions: [
      '1. Reproduce the bug and identify failure mechanism.',
      '2. Write a failing test asserting desired behavior.',
      '3. Implement minimal targeted fix to make the test pass.',
      '4. Run full test suite to confirm zero regressions.'
    ],
    defaultVerificationRequirements: [
      'Failing test passes after fix',
      'All existing tests continue to pass'
    ],
    defaultDeliverables: [
      'Bugfix code change',
      'Regression test covering the failure condition'
    ]
  },

  'investigate-issue': {
    id: 'investigate-issue',
    name: 'Investigate and Diagnose an Issue',
    category: 'general',
    description: 'Conduct deep forensic investigation into complex bugs, bottlenecks, or unexpected behaviors.',
    defaultTitle: 'Investigate and Root-Cause Issue',
    defaultTaskObjective: 'Perform thorough diagnosis of an unexplained error or performance issue and recommend actionable fixes.',
    defaultScopeOfWork: 'Inspect system logs, trace call stacks, verify data structures, and outline a resolution strategy.',
    defaultRequiredFunctionality: [
      'Comprehensive root-cause explanation with step-by-step trace',
      'Assessment of affected files, modules, and edge cases',
      'Concrete remediation recommendation or patch'
    ],
    defaultConstraints: [
      'Do not modify production code until root cause is definitively proven',
      'Ground findings strictly in reproducible code behavior'
    ],
    defaultRelevantFiles: [],
    defaultInstructions: [
      '1. Trace code execution path leading to the unexpected state.',
      '2. Check environment assumptions, timing issues, or unhandled errors.',
      '3. Document the exact mechanism causing the anomaly.'
    ],
    defaultVerificationRequirements: [
      'Demonstrate reproducible scenario highlighting the root cause'
    ],
    defaultDeliverables: [
      'Diagnostic report with root cause analysis and recommended action plan'
    ]
  },

  'refactor': {
    id: 'refactor',
    name: 'Refactor a Specific Component',
    category: 'general',
    description: 'Clean up code structure, improve maintainability, and reduce complexity while preserving behavior.',
    defaultTitle: 'Refactor Component / Module',
    defaultTaskObjective: 'Restructure component logic to improve readability, modularity, and maintainability without altering external behavior.',
    defaultScopeOfWork: 'Refactor target module, extract reusable helpers, eliminate duplication, and strengthen typing.',
    defaultRequiredFunctionality: [
      'Behavioral parity: all existing capabilities and user workflows operate identically',
      'Improved code readability and adherence to project conventions',
      'Enhanced TypeScript types and reduction of any-casts'
    ],
    defaultConstraints: [
      'Strict zero-regression requirement: do not alter public interfaces or behavior',
      'All existing tests must pass without modification'
    ],
    defaultRelevantFiles: [],
    defaultInstructions: [
      '1. Verify existing tests provide adequate coverage before refactoring.',
      '2. Perform incremental refactoring steps (extract methods, simplify conditions).',
      '3. Run test runner after every change to verify zero behavioral drift.'
    ],
    defaultVerificationRequirements: [
      '100% pass on all existing test suites without editing test assertions'
    ],
    defaultDeliverables: [
      'Cleaned, well-structured source code with improved modularity'
    ]
  },

  'ui-ux': {
    id: 'ui-ux',
    name: 'UI/UX Implementation',
    category: 'general',
    description: 'Implement or enhance visual layouts, craft design tokens, tactile feedback, and responsiveness.',
    defaultTitle: 'Implement UI/UX Experience',
    defaultTaskObjective: 'Create tactile, artisan-themed user interfaces aligning with The Playbench cutting-mat visual metaphor.',
    defaultScopeOfWork: 'Build responsive views, style tokens, micro-interactions, and accessible visual components.',
    defaultRequiredFunctionality: [
      'Artisan workbench visual styling (cutting mat, gridlines, paper notes, craft badges)',
      'Smooth responsive layout adapting across mobile, tablet, and desktop',
      'Accessible keyboard focus states, high contrast text, and clear feedback'
    ],
    defaultConstraints: [
      'Avoid generic SaaS cards, neon gradients, or glassmorphism',
      'Prevent horizontal viewport overflow on mobile screens'
    ],
    defaultRelevantFiles: [
      'src/components/',
      'src/styles/'
    ],
    defaultInstructions: [
      '1. Apply existing Playbench color tokens (#2e7d32, #fbfbf8, #3e2723, etc.).',
      '2. Ensure visual hierarchy clearly distinguishes primary actions from secondary tools.',
      '3. Test responsive breakpoints at 375px (mobile) and 1280px (desktop).'
    ],
    defaultVerificationRequirements: [
      'Visual verification confirming flawless layout across mobile and desktop viewports'
    ],
    defaultDeliverables: [
      'Responsive, tactile UI component implementation with screenshot verification'
    ]
  },

  'code-review': {
    id: 'code-review',
    name: 'Code Review & Audit',
    category: 'general',
    description: 'Perform rigorous architectural and security code review of changes before merging.',
    defaultTitle: 'Perform Comprehensive Code Review',
    defaultTaskObjective: 'Conduct thorough review of code changes against Playbench architectural guidelines and security standards.',
    defaultScopeOfWork: 'Audit diffs for bugs, security holes (iframe sandboxing, path traversal, injection), style adherence, and test coverage.',
    defaultRequiredFunctionality: [
      'Detailed checklist evaluation across correctness, safety, and maintainability',
      'Specific, actionable feedback with code snippets where improvements are needed',
      'Clear rating and decision recommendation'
    ],
    defaultConstraints: [
      'Review against actual requirements and project constraints, not personal style preferences',
      'Check strict security boundaries for iframe runtimes and IndexedDB transactions'
    ],
    defaultRelevantFiles: [],
    defaultInstructions: [
      '1. Check file diffs for potential bugs, unhandled nulls, or memory leaks.',
      '2. Verify iframe sandbox permissions and postMessage origin checks.',
      '3. Verify IndexedDB transactions resolve on tx.oncomplete.',
      '4. Verify test suite completeness and build output.'
    ],
    defaultVerificationRequirements: [
      'Verify all automated checks and builds succeed'
    ],
    defaultDeliverables: [
      'Structured review report highlighting findings, security audit, and verdict'
    ]
  },

  'testing-qa': {
    id: 'testing-qa',
    name: 'Testing and Quality Assurance',
    category: 'general',
    description: 'Strengthen platform reliability with comprehensive test coverage and edge case verification.',
    defaultTitle: 'Quality Assurance & Test Suite Expansion',
    defaultTaskObjective: 'Design and implement automated tests covering edge cases, failure states, and performance constraints.',
    defaultScopeOfWork: 'Author unit, integration, and E2E tests validating critical platform workflows.',
    defaultRequiredFunctionality: [
      'Coverage of edge cases: invalid formats, network failures, corrupt data, storage exhaustion',
      'Deterministic execution with mock storage and timers',
      'Clear descriptive test assertions'
    ],
    defaultConstraints: [
      'Tests must not depend on external network or cloud services',
      'Keep execution time fast and lightweight'
    ],
    defaultRelevantFiles: [
      'src/services/',
      'src/pages/'
    ],
    defaultInstructions: [
      '1. Identify critical untested user flows and edge cases.',
      '2. Write unit tests utilizing Vitest testing utilities.',
      '3. Verify all assertions run and report accurate metrics.'
    ],
    defaultVerificationRequirements: [
      'npm test runs all suites with 100% pass rate'
    ],
    defaultDeliverables: [
      'Expanded automated test suites with high code coverage'
    ]
  },

  'feature-integration': {
    id: 'feature-integration',
    name: 'Integration Between Existing Features',
    category: 'general',
    description: 'Connect disparate platform modules (e.g. Workshop with Prompts, Import with Game Collection).',
    defaultTitle: 'Integrate Platform Modules',
    defaultTaskObjective: 'Build seamless data pipelines and user workflows connecting two or more platform modules.',
    defaultScopeOfWork: 'Implement cross-module data bridges, unified navigation, and consistent state synchronization.',
    defaultRequiredFunctionality: [
      'Smooth bidirectional or unidirectional data transfer between modules',
      'Preserve data integrity across module boundaries without mutation',
      'Intuitive user entry points connecting related workflows'
    ],
    defaultConstraints: [
      'Do not tightly couple independent modules; use clean adapter interfaces',
      'Maintain modular architecture and isolation guarantees'
    ],
    defaultRelevantFiles: [
      'src/services/',
      'src/pages/'
    ],
    defaultInstructions: [
      '1. Define clean TypeScript interface bridging the two modules.',
      '2. Implement service adapter converting data formats.',
      '3. Add UI controls allowing users to transfer context between sections.',
      '4. Test integration workflows end-to-end.'
    ],
    defaultVerificationRequirements: [
      'Validate end-to-end user journey across both modules without errors'
    ],
    defaultDeliverables: [
      'Integration bridge service, UI entry points, and end-to-end verification'
    ]
  }
};
