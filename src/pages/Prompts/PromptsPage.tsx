import React from 'react';
import { Terminal } from 'lucide-react';
import { PlannedSectionView } from '../../components/common/PlannedSectionView';

export const PromptsPage: React.FC = () => {
  return (
    <PlannedSectionView
      title="Prompt Station"
      tagline="Curated library of precision English AI prompts for game engineering."
      stage="Planned"
      targetRoadmap="Stage 5"
      icon={Terminal}
      plannedFeatures={[
        'Game Creation Prompt: Turn high-level concepts into compliant TPGP packages.',
        'Game Improvement Prompt: Add mechanics, fix bugs, and refactor existing game loops.',
        'Game Integration Prompt: Wrap existing HTML/Canvas games into TPGP containers.',
        'Automated Debugging & Playtesting Prompts.',
        'One-click clipboard copy and Markdown export.',
      ]}
      architecturalNote="All prompts are authored in English and enforce zero external CDN dependencies to ensure TPGP offline compatibility."
    />
  );
};
