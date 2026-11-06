import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Save,
  RotateCcw,
  Trash2,
  FolderOpen,
  Plus,
  X,
  FileCode,
  Sparkles,
  AlertCircle,
  Eye,
  Edit3
} from 'lucide-react';
import {
  PromptFormState,
  PromptTemplateId,
  TargetAgent,
  SavedPrompt,
  GameProject
} from '../../types';
import { PROMPT_TEMPLATES, PromptGenerator, WorkshopBridge } from '../../services/prompts';
import { playbenchDB } from '../../services/storage';

export const PromptsPage: React.FC = () => {
  // State for active template & agent
  const [selectedTemplateId, setSelectedTemplateId] = useState<PromptTemplateId>('game-creation');
  const [targetAgent, setTargetAgent] = useState<TargetAgent>('jules');

  // Active form state
  const [formState, setFormState] = useState<PromptFormState>(() => {
    const t = PROMPT_TEMPLATES['game-creation'];
    return {
      title: t.defaultTitle,
      targetAgent: 'jules',
      templateId: 'game-creation',
      projectContext: 'The Playbench: A personal creative workshop for little games.',
      taskObjective: t.defaultTaskObjective,
      existingImplementation: '',
      scopeOfWork: t.defaultScopeOfWork,
      requiredFunctionality: [...t.defaultRequiredFunctionality],
      constraints: [...t.defaultConstraints],
      relevantFiles: [...t.defaultRelevantFiles],
      instructions: [...t.defaultInstructions],
      verificationRequirements: [...t.defaultVerificationRequirements],
      deliverables: [...t.defaultDeliverables]
    };
  });

  // UI modes & status
  const [editMode, setEditMode] = useState<'structured' | 'manual'>('structured');
  const [customPromptText, setCustomPromptText] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Persistence: Saved Prompts & Workshop Projects
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [currentPromptId, setCurrentPromptId] = useState<string | null>(null);
  const [workshopProjects, setWorkshopProjects] = useState<GameProject[]>([]);
  const [showWorkshopModal, setShowWorkshopModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'library'>('editor');

  // Input helpers for dynamic array fields
  const [newReq, setNewReq] = useState('');
  const [newConstraint, setNewConstraint] = useState('');
  const [newFile, setNewFile] = useState('');
  const [newInstruction, setNewInstruction] = useState('');
  const [newVerification, setNewVerification] = useState('');
  const [newDeliverable, setNewDeliverable] = useState('');

  // Load saved prompts and workshop projects on mount
  const loadStoredData = useCallback(async () => {
    try {
      const prompts = await playbenchDB.getAllSavedPrompts();
      setSavedPrompts(prompts);
      const projects = await playbenchDB.getAllProjects();
      setWorkshopProjects(projects);
    } catch (err) {
      console.error('Failed to load stored data:', err);
      setErrorMessage('Could not load stored prompts or workshop projects.');
    }
  }, []);

  useEffect(() => {
    loadStoredData();
  }, [loadStoredData]);

  // Handle template selection change
  const handleSelectTemplate = (tId: PromptTemplateId) => {
    setSelectedTemplateId(tId);
    const tmpl = PROMPT_TEMPLATES[tId];
    if (!tmpl) return;

    setFormState(prev => ({
      ...prev,
      title: tmpl.defaultTitle,
      templateId: tId,
      taskObjective: tmpl.defaultTaskObjective,
      scopeOfWork: tmpl.defaultScopeOfWork,
      requiredFunctionality: [...tmpl.defaultRequiredFunctionality],
      constraints: [...tmpl.defaultConstraints],
      relevantFiles: [...tmpl.defaultRelevantFiles],
      instructions: [...tmpl.defaultInstructions],
      verificationRequirements: [...tmpl.defaultVerificationRequirements],
      deliverables: [...tmpl.defaultDeliverables]
    }));
    setEditMode('structured');
    setCustomPromptText('');
  };

  // Handle agent selection change
  const handleSelectAgent = (agent: TargetAgent) => {
    setTargetAgent(agent);
    setFormState(prev => ({
      ...prev,
      targetAgent: agent
    }));
  };

  // Compute live generated prompt markdown
  const liveGeneratedPrompt = useMemo(() => {
    return PromptGenerator.generatePrompt({
      ...formState,
      targetAgent
    });
  }, [formState, targetAgent]);

  // Active prompt displayed (either manual override or generated)
  const activePromptText = editMode === 'manual' ? customPromptText : liveGeneratedPrompt;

  // Toggle to manual editing
  const handleToggleManualEdit = () => {
    if (editMode === 'structured') {
      setCustomPromptText(liveGeneratedPrompt);
      setEditMode('manual');
    } else {
      setEditMode('structured');
    }
  };

  // Reset to template defaults
  const handleReset = () => {
    const tmpl = PROMPT_TEMPLATES[selectedTemplateId];
    if (!tmpl) return;
    setFormState({
      title: tmpl.defaultTitle,
      targetAgent,
      templateId: selectedTemplateId,
      projectContext: 'The Playbench: A personal creative workshop for little games.',
      taskObjective: tmpl.defaultTaskObjective,
      existingImplementation: '',
      scopeOfWork: tmpl.defaultScopeOfWork,
      requiredFunctionality: [...tmpl.defaultRequiredFunctionality],
      constraints: [...tmpl.defaultConstraints],
      relevantFiles: [...tmpl.defaultRelevantFiles],
      instructions: [...tmpl.defaultInstructions],
      verificationRequirements: [...tmpl.defaultVerificationRequirements],
      deliverables: [...tmpl.defaultDeliverables]
    });
    setCustomPromptText('');
    setEditMode('structured');
    setCurrentPromptId(null);
  };

  // Save prompt to IndexedDB
  const handleSavePrompt = async () => {
    try {
      const id = currentPromptId || `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const saved: SavedPrompt = {
        id,
        title: formState.title || 'Untitled Prompt',
        targetAgent,
        templateId: selectedTemplateId,
        formState,
        generatedText: activePromptText,
        createdAt: currentPromptId ? (savedPrompts.find(p => p.id === currentPromptId)?.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now()
      };

      await playbenchDB.savePrompt(saved);
      setCurrentPromptId(id);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      await loadStoredData();
    } catch (err) {
      console.error('Failed to save prompt:', err);
      setErrorMessage('Failed to save prompt to local storage.');
    }
  };

  // Open saved prompt from library
  const handleLoadSavedPrompt = (prompt: SavedPrompt) => {
    setFormState(prompt.formState);
    setSelectedTemplateId(prompt.templateId);
    setTargetAgent(prompt.targetAgent);
    setCurrentPromptId(prompt.id);
    if (prompt.generatedText) {
      setCustomPromptText(prompt.generatedText);
    }
    setActiveTab('editor');
  };

  // Delete saved prompt
  const handleDeleteSavedPrompt = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await playbenchDB.deletePrompt(id);
      if (currentPromptId === id) {
        setCurrentPromptId(null);
      }
      await loadStoredData();
    } catch (err) {
      console.error('Failed to delete prompt:', err);
      setErrorMessage('Failed to delete prompt.');
    }
  };

  // Import from Workshop Project
  const handleImportWorkshopProject = (project: GameProject) => {
    const importedState = WorkshopBridge.convertProjectToPromptState(project, targetAgent);
    setFormState(importedState);
    setSelectedTemplateId(importedState.templateId);
    setCurrentPromptId(null);
    setEditMode('structured');
    setShowWorkshopModal(false);
  };

  // Copy to clipboard with fallback for non-secure / restricted environments
  const handleCopyPrompt = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(activePromptText);
      } else {
        // Fallback using textarea execCommand
        const textArea = document.createElement('textarea');
        textArea.value = activePromptText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!successful) throw new Error('execCommand copy failed');
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      setErrorMessage('Unable to copy to clipboard automatically. Please select text manually.');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  // Array item manipulation helpers
  const handleAddArrayItem = (field: keyof PromptFormState, value: string, setter: (val: string) => void) => {
    if (!value.trim()) return;
    setFormState(prev => ({
      ...prev,
      [field]: [...((prev[field] as string[]) || []), value.trim()]
    }));
    setter('');
  };

  const handleRemoveArrayItem = (field: keyof PromptFormState, index: number) => {
    setFormState(prev => ({
      ...prev,
      [field]: ((prev[field] as string[]) || []).filter((_, i) => i !== index)
    }));
  };

  const templatesList = Object.values(PROMPT_TEMPLATES);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 8px 48px 8px' }}>
      {/* Workbench Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        marginBottom: '20px',
        backgroundColor: '#f7f4ec',
        border: '2px solid #5d4037',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '8px',
            backgroundColor: '#2e7d32',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <Terminal size={24} />
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '1.4rem',
              fontWeight: 700,
              color: '#3e2723',
              fontFamily: '"Courier New", Courier, monospace',
              letterSpacing: '-0.5px'
            }}>
              The Prompt Station
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#6d4c41' }}>
              Precision English prompt engineering forge for coding agents & TPGP packages
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
          {/* Navigation Tabs */}
          <div style={{
            display: 'inline-flex',
            border: '1px solid #8d6e63',
            borderRadius: '6px',
            overflow: 'hidden',
            backgroundColor: '#efebe4'
          }}>
            <button
              onClick={() => setActiveTab('editor')}
              style={{
                padding: '7px 14px',
                border: 'none',
                backgroundColor: activeTab === 'editor' ? '#2e7d32' : 'transparent',
                color: activeTab === 'editor' ? '#fff' : '#4e342e',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FileCode size={15} />
              Prompt Forge
            </button>
            <button
              onClick={() => setActiveTab('library')}
              style={{
                padding: '7px 14px',
                border: 'none',
                backgroundColor: activeTab === 'library' ? '#2e7d32' : 'transparent',
                color: activeTab === 'library' ? '#fff' : '#4e342e',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FolderOpen size={15} />
              Saved Library ({savedPrompts.length})
            </button>
          </div>

          {/* Workshop Project Import Trigger */}
          <button
            onClick={() => setShowWorkshopModal(true)}
            style={{
              padding: '7px 14px',
              backgroundColor: '#fff',
              border: '1px solid #8d6e63',
              borderRadius: '6px',
              color: '#3e2723',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <Sparkles size={15} color="#2e7d32" />
            Load from Workshop
          </button>
        </div>
      </div>

      {errorMessage && (
        <div style={{
          backgroundColor: '#ffebee',
          color: '#c62828',
          padding: '10px 16px',
          borderRadius: '6px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.9rem',
          border: '1px solid #ef9a9a'
        }}>
          <AlertCircle size={18} />
          {errorMessage}
          <button
            onClick={() => setErrorMessage(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#c62828' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'library' ? (
        /* SAVED PROMPTS LIBRARY VIEW */
        <div style={{
          backgroundColor: '#fff',
          border: '2px solid #5d4037',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#3e2723' }}>Saved Prompts Archive</h2>
            <button
              onClick={() => setActiveTab('editor')}
              style={{
                padding: '6px 12px',
                backgroundColor: '#2e7d32',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={15} /> Create New Prompt
            </button>
          </div>

          {savedPrompts.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 16px',
              backgroundColor: '#faf7f2',
              borderRadius: '8px',
              border: '1px dashed #bcaaa4'
            }}>
              <Terminal size={36} color="#8d6e63" style={{ marginBottom: '12px' }} />
              <h3 style={{ margin: '0 0 6px 0', color: '#4e342e' }}>No saved prompts yet</h3>
              <p style={{ margin: '0 0 16px 0', color: '#795548', fontSize: '0.9rem' }}>
                Construct your prompts in the forge and save them to build your personal coding agent prompt library.
              </p>
              <button
                onClick={() => setActiveTab('editor')}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#2e7d32',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Go to Prompt Forge
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {savedPrompts.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleLoadSavedPrompt(p)}
                  style={{
                    backgroundColor: '#faf7f2',
                    border: '1px solid #d7ccc8',
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#2e7d32';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#d7ccc8';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{
                      display: 'inline-block',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#e8f5e9',
                      color: '#2e7d32',
                      border: '1px solid #c8e6c9'
                    }}>
                      {p.targetAgent.toUpperCase()}
                    </span>
                    <button
                      onClick={e => handleDeleteSavedPrompt(p.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#a1887f',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      title="Delete Prompt"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <h3 style={{ margin: '10px 0 6px 0', fontSize: '1rem', color: '#3e2723' }}>
                    {p.title}
                  </h3>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem', color: '#6d4c41', lineClamp: 2, overflow: 'hidden' }}>
                    {p.formState.taskObjective || 'No objective specified.'}
                  </p>
                  <div style={{ fontSize: '0.75rem', color: '#8d6e63' }}>
                    Saved on {new Date(p.updatedAt).toLocaleDateString()} at {new Date(p.updatedAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* PROMPT FORGE WORKSPACE: TWO-COLUMN LAYOUT */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) minmax(360px, 1.1fr)', gap: '20px' }}>
          {/* LEFT COLUMN: CONTROLS & STRUCTURED INPUTS */}
          <div style={{
            backgroundColor: '#fff',
            border: '2px solid #5d4037',
            borderRadius: '8px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.04)'
          }}>
            {/* Template Selector & Target Agent */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '16px', borderBottom: '1px solid #d7ccc8' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#3e2723', marginBottom: '6px' }}>
                  Prompt Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={e => handleSelectTemplate(e.target.value as PromptTemplateId)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #8d6e63',
                    backgroundColor: '#faf7f2',
                    fontSize: '0.9rem',
                    color: '#3e2723',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                >
                  <optgroup label="TPGP Game Engineering Templates">
                    {templatesList.filter(t => t.category === 'tpgp').map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="General Development Templates">
                    {templatesList.filter(t => t.category === 'general').map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                </select>
                <div style={{ fontSize: '0.78rem', color: '#6d4c41', marginTop: '4px' }}>
                  {PROMPT_TEMPLATES[selectedTemplateId]?.description}
                </div>
              </div>

              {/* Target Agent Switcher */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#3e2723', marginBottom: '6px' }}>
                  Target Coding Agent
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {(['jules', 'claude', 'chatgpt', 'other'] as TargetAgent[]).map(agent => (
                    <button
                      key={agent}
                      onClick={() => handleSelectAgent(agent)}
                      style={{
                        padding: '6px 4px',
                        borderRadius: '6px',
                        border: targetAgent === agent ? '2px solid #2e7d32' : '1px solid #d7ccc8',
                        backgroundColor: targetAgent === agent ? '#e8f5e9' : '#faf7f2',
                        color: targetAgent === agent ? '#1b5e20' : '#4e342e',
                        fontWeight: targetAgent === agent ? 700 : 500,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        textTransform: 'capitalize'
                      }}
                    >
                      {agent}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Input Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#3e2723', marginBottom: '4px' }}>
                  Prompt Title *
                </label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={e => setFormState(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Implement Tac-Toe TPGP Package"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #8d6e63',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Task Objective */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#3e2723', marginBottom: '4px' }}>
                  Task Objective *
                </label>
                <textarea
                  rows={2}
                  value={formState.taskObjective}
                  onChange={e => setFormState(prev => ({ ...prev, taskObjective: e.target.value }))}
                  placeholder="Primary goal of the prompt..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #8d6e63',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Scope of Work (Optional) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#5d4037', marginBottom: '4px' }}>
                  Scope of Work <span style={{ fontWeight: 400, color: '#8d6e63' }}>(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={formState.scopeOfWork}
                  onChange={e => setFormState(prev => ({ ...prev, scopeOfWork: e.target.value }))}
                  placeholder="Files, boundaries, and components involved..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #bcaaa4',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Required Functionality Array */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#3e2723', marginBottom: '4px' }}>
                  Required Functionality ({formState.requiredFunctionality.length})
                </label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={newReq}
                    onChange={e => setNewReq(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddArrayItem('requiredFunctionality', newReq, setNewReq)}
                    placeholder="Add required feature..."
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #bcaaa4',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    onClick={() => handleAddArrayItem('requiredFunctionality', newReq, setNewReq)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#2e7d32',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                  {formState.requiredFunctionality.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        fontSize: '0.82rem'
                      }}
                    >
                      <span>{idx + 1}. {item}</span>
                      <button
                        onClick={() => handleRemoveArrayItem('requiredFunctionality', idx)}
                        style={{ border: 'none', background: 'none', color: '#9e9e9e', cursor: 'pointer', padding: '2px' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Constraints Array (Guards) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#c62828', marginBottom: '4px' }}>
                  Constraints & Invariants ({formState.constraints.length})
                </label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={newConstraint}
                    onChange={e => setNewConstraint(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddArrayItem('constraints', newConstraint, setNewConstraint)}
                    placeholder="e.g. Do not modify existing save format..."
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #bcaaa4',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    onClick={() => handleAddArrayItem('constraints', newConstraint, setNewConstraint)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#c62828',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                  {formState.constraints.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        backgroundColor: '#ffebee',
                        borderRadius: '4px',
                        fontSize: '0.82rem',
                        color: '#b71c1c'
                      }}
                    >
                      <span>⚠️ {item}</span>
                      <button
                        onClick={() => handleRemoveArrayItem('constraints', idx)}
                        style={{ border: 'none', background: 'none', color: '#e57373', cursor: 'pointer', padding: '2px' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Relevant Files Array */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#5d4037', marginBottom: '4px' }}>
                  Relevant Files & Modules ({formState.relevantFiles.length})
                </label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={newFile}
                    onChange={e => setNewFile(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddArrayItem('relevantFiles', newFile, setNewFile)}
                    placeholder="e.g. src/services/storage/indexedDb.ts"
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #bcaaa4',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    onClick={() => handleAddArrayItem('relevantFiles', newFile, setNewFile)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#5d4037',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {formState.relevantFiles.map((item, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        backgroundColor: '#efebe9',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontFamily: 'monospace'
                      }}
                    >
                      {item}
                      <button
                        onClick={() => handleRemoveArrayItem('relevantFiles', idx)}
                        style={{ border: 'none', background: 'none', color: '#8d6e63', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#5d4037', marginBottom: '4px' }}>
                  Implementation Instructions ({formState.instructions.length})
                </label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={newInstruction}
                    onChange={e => setNewInstruction(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddArrayItem('instructions', newInstruction, setNewInstruction)}
                    placeholder="Add step instruction..."
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #bcaaa4',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    onClick={() => handleAddArrayItem('instructions', newInstruction, setNewInstruction)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#5d4037',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                  {formState.instructions.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        backgroundColor: '#fafafa',
                        borderRadius: '4px',
                        fontSize: '0.82rem'
                      }}
                    >
                      <span>{item}</span>
                      <button
                        onClick={() => handleRemoveArrayItem('instructions', idx)}
                        style={{ border: 'none', background: 'none', color: '#9e9e9e', cursor: 'pointer', padding: '2px' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Testing & Verification Requirements */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#5d4037', marginBottom: '4px' }}>
                  Testing & Verification ({formState.verificationRequirements.length})
                </label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={newVerification}
                    onChange={e => setNewVerification(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddArrayItem('verificationRequirements', newVerification, setNewVerification)}
                    placeholder="e.g. Verify all 19 vitest tests pass..."
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #bcaaa4',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    onClick={() => handleAddArrayItem('verificationRequirements', newVerification, setNewVerification)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#5d4037',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                  {formState.verificationRequirements.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        backgroundColor: '#e8f5e9',
                        borderRadius: '4px',
                        fontSize: '0.82rem'
                      }}
                    >
                      <span>[ ] {item}</span>
                      <button
                        onClick={() => handleRemoveArrayItem('verificationRequirements', idx)}
                        style={{ border: 'none', background: 'none', color: '#9e9e9e', cursor: 'pointer', padding: '2px' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expected Deliverables */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#5d4037', marginBottom: '4px' }}>
                  Expected Deliverables ({formState.deliverables.length})
                </label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={newDeliverable}
                    onChange={e => setNewDeliverable(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddArrayItem('deliverables', newDeliverable, setNewDeliverable)}
                    placeholder="e.g. Completed bundle and test run output..."
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #bcaaa4',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    onClick={() => handleAddArrayItem('deliverables', newDeliverable, setNewDeliverable)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#5d4037',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                  {formState.deliverables.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        backgroundColor: '#fafafa',
                        borderRadius: '4px',
                        fontSize: '0.82rem'
                      }}
                    >
                      <span>- {item}</span>
                      <button
                        onClick={() => handleRemoveArrayItem('deliverables', idx)}
                        style={{ border: 'none', background: 'none', color: '#9e9e9e', cursor: 'pointer', padding: '2px' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Form Actions */}
            <div style={{ display: 'flex', gap: '10px', paddingTop: '10px', borderTop: '1px solid #d7ccc8' }}>
              <button
                onClick={handleReset}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #bcaaa4',
                  borderRadius: '6px',
                  color: '#4e342e',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RotateCcw size={15} /> Reset Form
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: LIVE PROMPT PREVIEW & COPY ACTIONS */}
          <div style={{
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            border: '2px solid #3e2723',
            borderRadius: '8px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            minHeight: '600px'
          }}>
            {/* Terminal Preview Top Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '14px',
              borderBottom: '1px solid #333',
              marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ff5f56' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#27c93f' }} />
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#aaa', fontFamily: 'monospace' }}>
                  prompt-preview.md {editMode === 'manual' ? '(edited)' : '(live)'}
                </span>
              </div>

              {/* Mode Toggle & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={handleToggleManualEdit}
                  style={{
                    padding: '5px 10px',
                    backgroundColor: editMode === 'manual' ? '#3e2723' : '#2d2d2d',
                    color: '#fff',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title={editMode === 'manual' ? 'Return to auto-generated preview' : 'Edit raw prompt text directly'}
                >
                  {editMode === 'manual' ? <Eye size={13} /> : <Edit3 size={13} />}
                  {editMode === 'manual' ? 'Live Auto' : 'Manual Edit'}
                </button>

                <button
                  onClick={handleSavePrompt}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: saveSuccess ? '#2e7d32' : '#333',
                    color: '#fff',
                    border: '1px solid #555',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  {saveSuccess ? <Check size={13} /> : <Save size={13} />}
                  {saveSuccess ? 'Saved!' : 'Save'}
                </button>

                <button
                  onClick={handleCopyPrompt}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: copySuccess ? '#2e7d32' : '#388e3c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  {copySuccess ? <Check size={15} /> : <Copy size={15} />}
                  {copySuccess ? 'Copied Prompt!' : 'Copy Prompt'}
                </button>
              </div>
            </div>

            {/* Prompt View / Textarea */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {editMode === 'manual' ? (
                <textarea
                  value={customPromptText}
                  onChange={e => setCustomPromptText(e.target.value)}
                  style={{
                    flex: 1,
                    width: '100%',
                    backgroundColor: '#181818',
                    color: '#e0e0e0',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    padding: '14px',
                    fontSize: '0.88rem',
                    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                    lineHeight: '1.6',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                <pre style={{
                  flex: 1,
                  margin: 0,
                  padding: '14px',
                  backgroundColor: '#181818',
                  borderRadius: '4px',
                  border: '1px solid #292929',
                  overflowY: 'auto',
                  fontSize: '0.86rem',
                  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6',
                  color: '#cfd8dc'
                }}>
                  {liveGeneratedPrompt}
                </pre>
              )}
            </div>

            {/* Bottom Status / Word Count */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '10px',
              marginTop: '10px',
              borderTop: '1px solid #2d2d2d',
              fontSize: '0.75rem',
              color: '#888'
            }}>
              <span>Target: <strong>{targetAgent.toUpperCase()}</strong></span>
              <span>
                {activePromptText.length} characters | {activePromptText.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Workshop Import Modal */}
      {showWorkshopModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '2px solid #5d4037',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#3e2723', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#2e7d32" />
                Import from Workshop Project
              </h3>
              <button
                onClick={() => setShowWorkshopModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#757575' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#616161' }}>
                Select an existing Workshop game project to automatically populate all requirements, gameplay loops, checklists, and constraints into a coding prompt.
              </p>

              {workshopProjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#8d6e63' }}>
                  No projects found in Workshop. Create a game project in The Workshop first.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {workshopProjects.map(proj => (
                    <div
                      key={proj.id}
                      onClick={() => handleImportWorkshopProject(proj)}
                      style={{
                        padding: '12px 14px',
                        border: '1px solid #d7ccc8',
                        borderRadius: '6px',
                        backgroundColor: '#faf7f2',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#2e7d32';
                        e.currentTarget.style.backgroundColor = '#f1f8e9';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#d7ccc8';
                        e.currentTarget.style.backgroundColor = '#faf7f2';
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#3e2723' }}>
                          {proj.title}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#795548', marginTop: '2px' }}>
                          Workflow: {proj.workflowType} | Status: {proj.status}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#2e7d32', fontWeight: 600 }}>
                        Select →
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', textAlign: 'right' }}>
              <button
                onClick={() => setShowWorkshopModal(false)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
