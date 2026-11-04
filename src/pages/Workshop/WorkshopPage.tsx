import React from 'react';
import { Hammer } from 'lucide-react';
import { PlannedSectionView } from '../../components/common/PlannedSectionView';

export const WorkshopPage: React.FC = () => {
  return (
    <PlannedSectionView
      title="The Workshop"
      tagline="A creative forge for authoring game concepts and tracking development."
      stage="Planned"
      targetRoadmap="Stage 3"
      icon={Hammer}
      plannedFeatures={[
        'New Game Creation Letter: Structured drafting for hooks, loops, and mechanics.',
        'Existing Game Improvement Letter: Bug tracking, balance tweaks, and feature iterations.',
        'Dynamic 4-state task checklists (Required, Optional, Not Needed, To Be Decided).',
        'AI Development Brief Generator (Markdown export directly feedable into LLMs).',
      ]}
      architecturalNote="Projects and draft letters are kept isolated in IndexedDB 'projects' store. They remain private on the owner's machine and are never broadcast to public visitors."
    />
  );
};
