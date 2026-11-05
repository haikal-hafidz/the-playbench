import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Hammer,
  Plus,
  FileText,
  ArrowLeft,
  Trash2,
  Search,
  Copy,
  Check,
  Sliders,
  Edit3,
  Eye,
  ShieldAlert
} from 'lucide-react';
import { CuttingMat } from '../../components/desk/CuttingMat';
import { workshopService } from '../../services/workshop';
import { gameRegistry } from '../../services/games';
import { getUserRole } from '../../services/storage/preferences';
import { GameProject, ChecklistItem, ChecklistItemState, Game, CustomEntity } from '../../types';

export const WorkshopPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<GameProject[]>([]);
  const [registeredGames, setRegisteredGames] = useState<Game[]>([]);
  const [selectedProject, setSelectedProject] = useState<GameProject | null>(null);
  const [viewMode, setViewMode] = useState<'dashboard' | 'create-letter' | 'improve-letter' | 'checklist' | 'brief'>('dashboard');
  const [creationTab, setCreationTab] = useState<'identity' | 'gameplay' | 'player' | 'game-config' | 'data' | 'visuals' | 'tech'>('identity');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'completed' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [isEditingBrief, setIsEditingBrief] = useState(false);
  const [briefEditText, setBriefEditText] = useState('');
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const [newChecklistState, setNewChecklistState] = useState<ChecklistItemState>('required');
  const [userRole, setUserRole] = useState<'host' | 'player'>(getUserRole());

  // Load projects, registered games, and user role
  useEffect(() => {
    loadAll();
  }, []);

  // Handle direct navigation to creation letter (e.g. from Desk button)
  useEffect(() => {
    if (searchParams.get('mode') === 'create') {
      startNewCreationProject();
    }
  }, [searchParams]);

  const loadAll = async () => {
    const role = getUserRole();
    setUserRole(role);
    const projList = await workshopService.getAllProjects();
    setProjects(projList);
    const gameList = await gameRegistry.getAllGames();
    setRegisteredGames(gameList);
  };

  const startNewCreationProject = () => {
    const newProj: GameProject = {
      id: `proj-${Date.now()}`,
      title: 'Untitled Craft Game',
      status: 'draft',
      workflowType: 'creation',
      creationLetter: {
        title: 'Untitled Craft Game',
        tagline: 'A little game of tact and strategy',
        targetAudience: 'Friends, solo thinkers, and pass-and-play companions',
        creativeVision: 'A warm, illustrated tabletop experience celebrating tactile decision-making.',
        objectives: 'Collect or manipulate wooden tokens to meet secret goals before turns expire.',
        genre: ['Strategy', 'Puzzle', 'Tactile Tabletop'],
        coreRules: 'Players take turns picking and rotating tokens on a grid to form adjacent matching motifs.',
        turnStructure: 'Turn sequence: 1. Draw 1 token. 2. Place or shift 1 token. 3. Check for motif alignment.',
        winLossConditions: 'First player to complete 3 secret motifs wins. Run out of deck triggers tiebreak by points.',
        edgeCases: 'Empty draw pile restarts with reshuffled discards. Placements cannot exceed border boundary.',
        playerCountMin: 1,
        playerCountMax: 4,
        playStyle: 'pass-and-play',
        hostParticipation: true,
        rolesOrTeams: 'Free-for-all individual players',
        roundDurationMinutes: 10,
        totalRounds: 3,
        difficultyLevels: 'Gentle, Standard, Master',
        configPresets: 'Quick 5-minute match, Standard 15-minute game',
        entities: [
          {
            name: 'Token',
            description: 'Carved craft piece placed on the board surface',
            fields: [
              { name: 'id', type: 'string', required: true, description: 'Unique piece ID' },
              { name: 'symbol', type: 'string', required: true, description: 'Icon symbol motif' },
              { name: 'gridX', type: 'number', required: true, description: 'Horizontal board coordinate' },
              { name: 'gridY', type: 'number', required: true, description: 'Vertical board coordinate' },
            ]
          }
        ],
        storageStrategy: 'Local IndexedDB slot persistence via PLAYBENCH_SAVE_REQUEST (< 256KB)',
        artStyle: 'Warm cut-paper tokens, soft shadows, green cutting mat grid alignment.',
        layoutStructure: 'Clean centered board grid flanked by player deck and goal cards.',
        animationPreferences: 'Gentle 150ms drop shadow bounce on placement.',
        accessibilityNotes: 'Colorblind symbols paired with distinct silhouettes; keyboard grid focus.',
        runtimeType: 'iframe-bundle',
        offlineSupport: true,
        constraints: ['Zero external network requests', 'Runs in iframe sandbox', 'Max 256KB save footprint'],
        notes: '',
      },
      checklist: [],
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    newProj.checklist = workshopService.generateChecklist('creation', newProj.creationLetter);
    setSelectedProject(newProj);
    setViewMode('create-letter');
    setCreationTab('identity');
  };

  const startNewImprovementProject = (targetGameId?: string) => {
    const defaultTarget = targetGameId || (registeredGames[0]?.id || 'number-guess');
    const newProj: GameProject = {
      id: `proj-${Date.now()}`,
      title: `Improvement: ${defaultTarget}`,
      status: 'draft',
      workflowType: 'improvement',
      targetGameId: defaultTarget,
      improvementLetter: {
        targetGameId: defaultTarget,
        currentVersion: '1.0.0',
        targetVersion: '1.1.0',
        implementationAudit: 'Standalone HTML game with simple input loop. Needs structured save slot integration and difficulty options.',
        gameplayAdjustments: 'Introduce hard mode with wider guess range (1-100) and bonus score calculation based on remaining attempts.',
        scoringChanges: 'Calculate final score = remainingAttempts * 100 + speedBonus.',
        dataArchitectureChanges: 'Save high scores and round statistics inside standard TPGP save payload.',
        uxImprovements: 'Provide haptic/visual shake feedback on invalid guesses and celebratory confetti animation on victory.',
        bugReports: ['Guessed numbers do not clear automatically after submission on mobile keyboards.'],
        featureRequests: ['Add difficulty selector before game starts.'],
        balanceAdjustments: ['Allow 7 guesses for easy mode, 5 for standard, 4 for hard mode.'],
        acceptanceCriteria: ['Passes all TPGP handshake protocols', 'Saves high scores reliably to IndexedDB'],
        revisionNotes: 'Initial improvement cycle to validate TPGP upgrade standard.',
      },
      checklist: [],
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    newProj.checklist = workshopService.generateChecklist('improvement', undefined, newProj.improvementLetter);
    setSelectedProject(newProj);
    setViewMode('improve-letter');
  };

  const handleSaveProject = async () => {
    if (!selectedProject) return;
    await workshopService.saveProject(selectedProject);
    await loadAll();
  };

  const handleDeleteProject = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this development project from the workbench?')) {
      await workshopService.deleteProject(id);
      if (selectedProject?.id === id) {
        setSelectedProject(null);
        setViewMode('dashboard');
      }
      await loadAll();
    }
  };

  const toggleChecklistItem = async (itemId: string) => {
    if (!selectedProject) return;
    const updatedChecklist = selectedProject.checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    const updated = { ...selectedProject, checklist: updatedChecklist };
    setSelectedProject(updated);
    await workshopService.saveProject(updated);
    await loadAll();
  };

  const updateItemState = async (itemId: string, newState: ChecklistItemState) => {
    if (!selectedProject) return;
    const updatedChecklist = selectedProject.checklist.map(item =>
      item.id === itemId ? { ...item, state: newState } : item
    );
    const updated = { ...selectedProject, checklist: updatedChecklist };
    setSelectedProject(updated);
    await workshopService.saveProject(updated);
    await loadAll();
  };

  const addCustomChecklistItem = async () => {
    if (!selectedProject || !newChecklistLabel.trim()) return;
    const newItem: ChecklistItem = {
      id: `chk-custom-${Date.now()}`,
      label: newChecklistLabel.trim(),
      state: newChecklistState,
      completed: false,
    };
    const updated = { ...selectedProject, checklist: [...selectedProject.checklist, newItem] };
    setSelectedProject(updated);
    setNewChecklistLabel('');
    await workshopService.saveProject(updated);
    await loadAll();
  };

  const removeChecklistItem = async (itemId: string) => {
    if (!selectedProject) return;
    const updated = { ...selectedProject, checklist: selectedProject.checklist.filter(i => i.id !== itemId) };
    setSelectedProject(updated);
    await workshopService.saveProject(updated);
    await loadAll();
  };

  const copyBriefToClipboard = () => {
    if (!selectedProject) return;
    const brief = selectedProject.briefMarkdown || workshopService.generateDevelopmentBrief(selectedProject);
    navigator.clipboard.writeText(brief);
    setCopiedBrief(true);
    setTimeout(() => setCopiedBrief(false), 2000);
  };

  const handleSaveBriefEdit = async () => {
    if (!selectedProject) return;
    const updated = { ...selectedProject, briefMarkdown: briefEditText };
    setSelectedProject(updated);
    await workshopService.saveProject(updated);
    setIsEditingBrief(false);
    await loadAll();
  };

  const addDataArchitectureEntity = () => {
    if (!selectedProject?.creationLetter) return;
    const newEntity: CustomEntity = {
      name: 'NewEntity',
      description: 'Custom entity table definition',
      fields: [
        { name: 'id', type: 'string', required: true, description: 'Primary key identifier' }
      ]
    };
    const c = {
      ...selectedProject.creationLetter,
      entities: [...(selectedProject.creationLetter.entities || []), newEntity]
    };
    setSelectedProject({ ...selectedProject, creationLetter: c });
  };

  const filteredProjects = projects.filter(p => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.conceptNote && p.conceptNote.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px 20px 48px 20px' }}>
      <CuttingMat>
        {/* Host vs Player Mode Notification Banner */}
        {userRole === 'player' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#3d2514',
            border: '1px solid #7a461e',
            color: '#fce3b8',
            padding: '10px 16px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
          }}>
            <ShieldAlert size={16} color="#e8c872" />
            <span>
              <strong>Visitor / Player Mode Active:</strong> You have read-only access to browse workshop projects. Switch to <strong>Host Mode</strong> in the workbench header to create projects, modify design letters, or customize development briefs.
            </span>
          </div>
        )}

        {/* Navigation Breadcrumb / Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {viewMode !== 'dashboard' && (
              <button
                onClick={() => {
                  handleSaveProject();
                  setViewMode('dashboard');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#e8c872',
                  fontSize: '13px',
                  padding: '6px 12px',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(232, 200, 114, 0.3)',
                  borderRadius: '6px',
                }}
              >
                <ArrowLeft size={15} />
                <span>Workshop Desk</span>
              </button>
            )}
            <div>
              <h1 style={{
                fontSize: '20px',
                fontFamily: 'var(--font-family-display)',
                color: '#fcf8ee',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Hammer size={20} color="#e8c872" />
                The Workshop
              </h1>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-family-craft)', color: '#a3b899' }}>
                Creative development forge & game specification generator
              </span>
            </div>
          </div>

          {viewMode === 'dashboard' ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              {userRole === 'host' ? (
                <>
                  <button
                    onClick={startNewCreationProject}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#e8c872',
                      color: '#1a1612',
                      fontWeight: 700,
                      fontSize: '12px',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                  >
                    <Plus size={15} />
                    <span>New Game Project</span>
                  </button>

                  <button
                    onClick={() => startNewImprovementProject()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#2b2118',
                      color: '#fcf8ee',
                      fontSize: '12px',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: '1px solid #4a3828',
                    }}
                  >
                    <Sliders size={15} color="#e8c872" />
                    <span>Improve Existing Game</span>
                  </button>
                </>
              ) : (
                <div style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-family-craft)',
                  color: '#c5bcab',
                  alignSelf: 'center'
                }}>
                  Read-Only Mode
                </div>
              )}
            </div>
          ) : selectedProject && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{
                backgroundColor: 'rgba(0,0,0,0.4)',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #2d4533',
                fontSize: '12px',
                color: '#e8c872',
                fontFamily: 'var(--font-family-craft)'
              }}>
                Progress: {workshopService.calculateProgress(selectedProject.checklist)}%
              </div>

              <button
                onClick={() => setViewMode(selectedProject.workflowType === 'creation' ? 'create-letter' : 'improve-letter')}
                style={{
                  fontSize: '12px',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  backgroundColor: (viewMode === 'create-letter' || viewMode === 'improve-letter') ? '#2d6a45' : 'rgba(0,0,0,0.3)',
                  color: '#fcf8ee',
                  border: '1px solid rgba(232, 200, 114, 0.3)',
                }}
              >
                Letter
              </button>

              <button
                onClick={() => setViewMode('checklist')}
                style={{
                  fontSize: '12px',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  backgroundColor: viewMode === 'checklist' ? '#2d6a45' : 'rgba(0,0,0,0.3)',
                  color: '#fcf8ee',
                  border: '1px solid rgba(232, 200, 114, 0.3)',
                }}
              >
                Checklist ({selectedProject.checklist.length})
              </button>

              <button
                onClick={() => setViewMode('brief')}
                style={{
                  fontSize: '12px',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  backgroundColor: viewMode === 'brief' ? '#2d6a45' : 'rgba(0,0,0,0.3)',
                  color: '#fcf8ee',
                  border: '1px solid rgba(232, 200, 114, 0.3)',
                }}
              >
                Brief
              </button>
            </div>
          )}
        </div>

        {/* VIEW 1: WORKSHOP DASHBOARD */}
        {viewMode === 'dashboard' && (
          <div>
            {/* Filter & Search Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              backgroundColor: 'rgba(0,0,0,0.3)',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(232, 200, 114, 0.2)',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['all', 'draft', 'active', 'completed', 'archived'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-family-craft)',
                      textTransform: 'uppercase',
                      backgroundColor: statusFilter === tab ? '#1b4731' : 'transparent',
                      color: statusFilter === tab ? '#e8c872' : '#a3b899',
                      border: statusFilter === tab ? '1px solid #2d6a45' : '1px solid transparent',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search size={14} color="#8fad91" style={{ position: 'absolute', left: '10px', top: '8px' }} />
                <input
                  type="text"
                  placeholder="Search project briefs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    fontSize: '12px',
                    backgroundColor: '#16120e',
                    border: '1px solid #382b1e',
                    borderRadius: '4px',
                    color: '#fcf8ee',
                  }}
                />
              </div>
            </div>

            {/* Project Cards Grid */}
            {filteredProjects.length === 0 ? (
              <div style={{
                backgroundColor: 'var(--color-paper-card)',
                borderRadius: '8px',
                border: '2px dashed #382b1e',
                boxShadow: 'var(--shadow-desk-card)',
                padding: '48px 24px',
                textAlign: 'center',
                maxWidth: '600px',
                margin: '40px auto',
              }}>
                <Hammer size={40} color="#8b7355" style={{ marginBottom: '12px' }} />
                <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-family-display)', marginBottom: '8px' }}>
                  No projects on the bench
                </h3>
                <p style={{ fontSize: '13px', color: '#535c56', marginBottom: '20px' }}>
                  The Workshop is ready for your next creation. Start a New Game Creation Letter to outline mechanics and generate AI briefs, or improve an existing game.
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button
                    onClick={startNewCreationProject}
                    style={{
                      backgroundColor: '#1b4731',
                      color: '#fcf8ee',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    Start Creation Letter
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}>
                {filteredProjects.map(p => {
                  const progress = workshopService.calculateProgress(p.checklist);
                  return (
                    <div
                      key={p.id}
                      style={{
                        backgroundColor: 'var(--color-paper-card)',
                        borderRadius: '8px',
                        border: '1px solid #d4c8b8',
                        boxShadow: 'var(--shadow-desk-card)',
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontFamily: 'var(--font-family-craft)',
                            backgroundColor: p.workflowType === 'creation' ? '#1b4731' : '#3d2d20',
                            color: '#e8c872',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            textTransform: 'uppercase',
                          }}>
                            {p.workflowType === 'creation' ? 'New Game' : 'Improvement'}
                          </span>

                          <span style={{
                            fontSize: '10px',
                            fontFamily: 'var(--font-family-craft)',
                            color: '#706553',
                            border: '1px solid #d4c8b8',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            textTransform: 'uppercase',
                          }}>
                            {p.status}
                          </span>
                        </div>

                        <h3 style={{
                          fontSize: '16px',
                          fontFamily: 'var(--font-family-display)',
                          color: '#1a1612',
                          margin: '0 0 6px 0',
                        }}>
                          {p.title}
                        </h3>

                        <p style={{
                          fontSize: '12px',
                          color: '#535c56',
                          margin: '0 0 14px 0',
                          lineHeight: '1.4',
                        }}>
                          {p.workflowType === 'creation'
                            ? (p.creationLetter?.creativeVision || p.creationLetter?.tagline || 'No concept description specified yet.')
                            : `Improving game: ${p.targetGameId} (Target v${p.improvementLetter?.targetVersion || '1.1.0'})`}
                        </p>
                      </div>

                      <div>
                        {/* Progress Bar */}
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-family-craft)', color: '#706553', marginBottom: '4px' }}>
                            <span>Checklist Progress</span>
                            <span>{progress}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: '#e2dad0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#1b4731', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => {
                                setSelectedProject(p);
                                setViewMode(p.workflowType === 'creation' ? 'create-letter' : 'improve-letter');
                              }}
                              style={{
                                backgroundColor: '#1b4731',
                                color: '#fcf8ee',
                                fontSize: '12px',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              Edit Project
                            </button>

                            <button
                              onClick={() => {
                                setSelectedProject(p);
                                setViewMode('brief');
                              }}
                              title="View Brief"
                              style={{
                                backgroundColor: '#f0ece1',
                                color: '#2b2118',
                                fontSize: '12px',
                                padding: '6px 10px',
                                borderRadius: '4px',
                                border: '1px solid #d4c8b8',
                              }}
                            >
                              <FileText size={14} />
                            </button>
                          </div>

                          <button
                            onClick={() => handleDeleteProject(p.id)}
                            title="Delete Project"
                            style={{
                              color: '#c93b2b',
                              padding: '6px',
                              borderRadius: '4px',
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: NEW GAME CREATION LETTER */}
        {viewMode === 'create-letter' && selectedProject && selectedProject.creationLetter && (
          <div style={{
            backgroundColor: 'var(--color-paper-card)',
            borderRadius: '8px',
            border: '1px solid #d4c8b8',
            boxShadow: 'var(--shadow-desk-card)',
            padding: '24px',
            maxWidth: '960px',
            margin: '0 auto',
          }}>
            <div style={{ borderBottom: '1px solid #e2dad0', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-family-craft)',
                  backgroundColor: '#1b4731',
                  color: '#e8c872',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                }}>
                  New Game Creation Letter
                </span>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', color: '#706553', fontFamily: 'var(--font-family-craft)' }}>Status:</label>
                  <select
                    value={selectedProject.status}
                    onChange={(e) => {
                      const updated = { ...selectedProject, status: e.target.value as any };
                      setSelectedProject(updated);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      borderRadius: '4px',
                      border: '1px solid #d4c8b8',
                      backgroundColor: '#fff',
                    }}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <input
                type="text"
                value={selectedProject.title}
                onChange={(e) => {
                  const updatedTitle = e.target.value;
                  const c = { ...selectedProject.creationLetter!, title: updatedTitle };
                  setSelectedProject({ ...selectedProject, title: updatedTitle, creationLetter: c });
                }}
                placeholder="Game Working Title..."
                style={{
                  width: '100%',
                  fontSize: '22px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-family-display)',
                  color: '#1a1612',
                  border: 'none',
                  borderBottom: '2px solid #e2dad0',
                  padding: '6px 0',
                  outline: 'none',
                }}
              />
            </div>

            {/* Navigation tabs for creation sections */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px', borderBottom: '1px solid #e2dad0', paddingBottom: '10px' }}>
              {[
                { id: 'identity', label: 'A. Game Identity' },
                { id: 'gameplay', label: 'B. Gameplay Design' },
                { id: 'player', label: 'C. Player Config' },
                { id: 'game-config', label: 'D. Game Config' },
                { id: 'data', label: 'E. Data Architecture' },
                { id: 'visuals', label: 'F. Visual Identity' },
                { id: 'tech', label: 'G. Technical & Constraints' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setCreationTab(t.id as any)}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontWeight: creationTab === t.id ? 700 : 500,
                    backgroundColor: creationTab === t.id ? '#1b4731' : '#f0ece1',
                    color: creationTab === t.id ? '#e8c872' : '#2b2118',
                    border: '1px solid #d4c8b8',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENT */}
            {creationTab === 'identity' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Tagline & Creative Hook
                  </label>
                  <input
                    type="text"
                    value={selectedProject.creationLetter.tagline || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, tagline: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="Short evocative hook (e.g. A tiny card duel under candlelight)"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Target Audience & Mood
                  </label>
                  <input
                    type="text"
                    value={selectedProject.creationLetter.targetAudience || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, targetAudience: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="e.g. Friends gathered around a shared laptop, solo puzzle enthusiasts"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Creative Vision
                  </label>
                  <textarea
                    rows={3}
                    value={selectedProject.creationLetter.creativeVision || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, creativeVision: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="Why this game belongs in The Playbench workshop..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Core Objectives
                  </label>
                  <textarea
                    rows={2}
                    value={selectedProject.creationLetter.objectives || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, objectives: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="Primary player goals and victory aspirations..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>
              </div>
            )}

            {creationTab === 'gameplay' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Core Rules
                  </label>
                  <textarea
                    rows={3}
                    value={selectedProject.creationLetter.coreRules || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, coreRules: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="Fundamental mechanical constraints and action grammar..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Turn, Round & Session Structure
                  </label>
                  <textarea
                    rows={3}
                    value={selectedProject.creationLetter.turnStructure || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, turnStructure: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="Step 1: Draw, Step 2: Play, Step 3: Score..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Win, Loss & Scoring Conditions
                  </label>
                  <textarea
                    rows={2}
                    value={selectedProject.creationLetter.winLossConditions || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, winLossConditions: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="Winning conditions, fail states, scoring formulas, tiebreakers..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Edge Cases & Exceptions
                  </label>
                  <textarea
                    rows={2}
                    value={selectedProject.creationLetter.edgeCases || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, edgeCases: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="Empty deck triggers, simultaneously matching conditions..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>
              </div>
            )}

            {creationTab === 'player' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                      Min Players
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={selectedProject.creationLetter.playerCountMin ?? 1}
                      onChange={(e) => {
                        const c = { ...selectedProject.creationLetter!, playerCountMin: parseInt(e.target.value, 10) || 1 };
                        setSelectedProject({ ...selectedProject, creationLetter: c });
                      }}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                      Max Players
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={selectedProject.creationLetter.playerCountMax ?? 2}
                      onChange={(e) => {
                        const c = { ...selectedProject.creationLetter!, playerCountMax: parseInt(e.target.value, 10) || 2 };
                        setSelectedProject({ ...selectedProject, creationLetter: c });
                      }}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Play Style
                  </label>
                  <select
                    value={selectedProject.creationLetter.playStyle || 'pass-and-play'}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, playStyle: e.target.value as any };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  >
                    <option value="solo">Solo Single-Player</option>
                    <option value="pass-and-play">Local Pass-and-Play</option>
                    <option value="shared-screen">Shared Screen Co-op / Versus</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Roles & Team Allocation
                  </label>
                  <input
                    type="text"
                    value={selectedProject.creationLetter.rolesOrTeams || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, rolesOrTeams: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="e.g. Free-for-all, 2v2 teams, or asymmetric detective vs thief"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>
              </div>
            )}

            {creationTab === 'game-config' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                      Round Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={selectedProject.creationLetter.roundDurationMinutes ?? 10}
                      onChange={(e) => {
                        const c = { ...selectedProject.creationLetter!, roundDurationMinutes: parseInt(e.target.value, 10) || 10 };
                        setSelectedProject({ ...selectedProject, creationLetter: c });
                      }}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                      Total Rounds
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={selectedProject.creationLetter.totalRounds ?? 3}
                      onChange={(e) => {
                        const c = { ...selectedProject.creationLetter!, totalRounds: parseInt(e.target.value, 10) || 3 };
                        setSelectedProject({ ...selectedProject, creationLetter: c });
                      }}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Difficulty Levels & Tuning
                  </label>
                  <input
                    type="text"
                    value={selectedProject.creationLetter.difficultyLevels || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, difficultyLevels: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="e.g. Relaxed (no timer), Standard, Blitz (30s turns)"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Configuration Presets
                  </label>
                  <input
                    type="text"
                    value={selectedProject.creationLetter.configPresets || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, configPresets: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="e.g. Quick Match (1 round), Tournament (Best of 5)"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>
              </div>
            )}

            {creationTab === 'data' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#1a1612' }}>Custom Entities & Schemas</h3>
                    <span style={{ fontSize: '11px', color: '#706553' }}>Define structured tables and fields used by the game</span>
                  </div>
                  <button
                    onClick={addDataArchitectureEntity}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#1b4731',
                      color: '#fcf8ee',
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    <Plus size={13} />
                    <span>Add Entity</span>
                  </button>
                </div>

                {selectedProject.creationLetter.entities?.map((entity, idx) => (
                  <div key={idx} style={{ backgroundColor: '#fdfbf7', border: '1px solid #d4c8b8', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        value={entity.name}
                        onChange={(e) => {
                          const updatedEntities = [...selectedProject.creationLetter!.entities];
                          updatedEntities[idx].name = e.target.value;
                          const c = { ...selectedProject.creationLetter!, entities: updatedEntities };
                          setSelectedProject({ ...selectedProject, creationLetter: c });
                        }}
                        placeholder="Entity Name (e.g. Card, PlayerState)"
                        style={{ fontWeight: 700, padding: '4px 8px', fontSize: '12px', border: '1px solid #d4c8b8', borderRadius: '4px' }}
                      />
                      <input
                        type="text"
                        value={entity.description}
                        onChange={(e) => {
                          const updatedEntities = [...selectedProject.creationLetter!.entities];
                          updatedEntities[idx].description = e.target.value;
                          const c = { ...selectedProject.creationLetter!, entities: updatedEntities };
                          setSelectedProject({ ...selectedProject, creationLetter: c });
                        }}
                        placeholder="Description..."
                        style={{ flex: 1, padding: '4px 8px', fontSize: '12px', border: '1px solid #d4c8b8', borderRadius: '4px' }}
                      />
                    </div>

                    <div style={{ fontSize: '11px', color: '#706553', marginBottom: '4px' }}>Fields:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {entity.fields.map((f, fIdx) => (
                        <div key={fIdx} style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
                          <span style={{ fontWeight: 600, color: '#1b4731' }}>{f.name}</span>
                          <span style={{ color: '#706553' }}>({f.type})</span>
                          <span>— {f.description || 'No description'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Storage Strategy & Save Slots
                  </label>
                  <input
                    type="text"
                    value={selectedProject.creationLetter.storageStrategy || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, storageStrategy: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="e.g. IndexedDB via PLAYBENCH_SAVE_REQUEST, max 3 slots, < 256KB"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>
              </div>
            )}

            {creationTab === 'visuals' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Art Style & Metaphor
                  </label>
                  <textarea
                    rows={2}
                    value={selectedProject.creationLetter.artStyle || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, artStyle: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="Tactile craft elements, textures, wooden tokens, paper cards..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Layout Structure & Viewports
                  </label>
                  <textarea
                    rows={2}
                    value={selectedProject.creationLetter.layoutStructure || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, layoutStructure: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="Responsive 16:9 canvas, board dimensions, mobile drawer menus..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Accessibility Guidelines
                  </label>
                  <input
                    type="text"
                    value={selectedProject.creationLetter.accessibilityNotes || ''}
                    onChange={(e) => {
                      const c = { ...selectedProject.creationLetter!, accessibilityNotes: e.target.value };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="Color-blind friendly icons, high contrast text, screen-reader cues"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>
              </div>
            )}

            {creationTab === 'tech' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                      Runtime Type
                    </label>
                    <select
                      value={selectedProject.creationLetter.runtimeType || 'iframe-bundle'}
                      onChange={(e) => {
                        const c = { ...selectedProject.creationLetter!, runtimeType: e.target.value as any };
                        setSelectedProject({ ...selectedProject, creationLetter: c });
                      }}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                    >
                      <option value="iframe-bundle">iframe-bundle (Sandboxed TPGP)</option>
                      <option value="html-standalone">html-standalone (Single file)</option>
                    </select>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                      Offline Support
                    </label>
                    <select
                      value={selectedProject.creationLetter.offlineSupport ? 'true' : 'false'}
                      onChange={(e) => {
                        const c = { ...selectedProject.creationLetter!, offlineSupport: e.target.value === 'true' };
                        setSelectedProject({ ...selectedProject, creationLetter: c });
                      }}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                    >
                      <option value="true">Strict Zero-CDN Offline Execution</option>
                      <option value="false">Standard Web Assets</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Deliberate Constraints (One per line)
                  </label>
                  <textarea
                    rows={3}
                    value={selectedProject.creationLetter.constraints?.join('\n') || ''}
                    onChange={(e) => {
                      const list = e.target.value.split('\n').filter(s => s.trim().length > 0);
                      const c = { ...selectedProject.creationLetter!, constraints: list };
                      setSelectedProject({ ...selectedProject, creationLetter: c });
                    }}
                    placeholder="Zero CDN dependencies&#10;No external API calls&#10;Max 256KB save file"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1a1612', marginBottom: '4px' }}>
                    Notes & References
                  </label>
                  <textarea
                    rows={2}
                    value={selectedProject.notes || ''}
                    onChange={(e) => setSelectedProject({ ...selectedProject, notes: e.target.value })}
                    placeholder="Inspirational games, paper prototypes, physical sketches..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2dad0' }}>
              <button
                onClick={async () => {
                  await handleSaveProject();
                  setViewMode('checklist');
                }}
                style={{
                  backgroundColor: '#1b4731',
                  color: '#fcf8ee',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                Save & Manage Checklist →
              </button>

              <button
                onClick={handleSaveProject}
                style={{
                  backgroundColor: '#f0ece1',
                  color: '#1a1612',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  border: '1px solid #d4c8b8',
                }}
              >
                Save Draft
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: EXISTING GAME IMPROVEMENT LETTER */}
        {viewMode === 'improve-letter' && selectedProject && selectedProject.improvementLetter && (
          <div style={{
            backgroundColor: 'var(--color-paper-card)',
            borderRadius: '8px',
            border: '1px solid #d4c8b8',
            boxShadow: 'var(--shadow-desk-card)',
            padding: '24px',
            maxWidth: '900px',
            margin: '0 auto',
          }}>
            <div style={{ borderBottom: '1px solid #e2dad0', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-family-craft)',
                  backgroundColor: '#3d2d20',
                  color: '#e8c872',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                }}>
                  Existing Game Improvement Letter
                </span>

                <select
                  value={selectedProject.improvementLetter.targetGameId}
                  onChange={(e) => {
                    const targetId = e.target.value;
                    const imp = { ...selectedProject.improvementLetter!, targetGameId: targetId };
                    setSelectedProject({
                      ...selectedProject,
                      title: `Improvement: ${targetId}`,
                      improvementLetter: imp,
                      targetGameId: targetId,
                    });
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: '1px solid #d4c8b8',
                    backgroundColor: '#fff',
                  }}
                >
                  {registeredGames.map(g => (
                    <option key={g.id} value={g.id}>Target Game: {g.title} (v{g.version})</option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                value={selectedProject.title}
                onChange={(e) => setSelectedProject({ ...selectedProject, title: e.target.value })}
                placeholder="Improvement Project Title..."
                style={{
                  width: '100%',
                  fontSize: '22px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-family-display)',
                  color: '#1a1612',
                  border: 'none',
                  borderBottom: '2px solid #e2dad0',
                  padding: '6px 0',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1a1612', marginBottom: '6px' }}>
                  Target Version Release
                </label>
                <input
                  type="text"
                  value={selectedProject.improvementLetter.targetVersion}
                  onChange={(e) => {
                    const imp = { ...selectedProject.improvementLetter!, targetVersion: e.target.value };
                    setSelectedProject({ ...selectedProject, improvementLetter: imp });
                  }}
                  placeholder="e.g. 1.1.0"
                  style={{ width: '200px', padding: '6px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d4c8b8' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1a1612', marginBottom: '6px' }}>
                  Implementation Audit & Deficiencies
                </label>
                <textarea
                  rows={3}
                  value={selectedProject.improvementLetter.implementationAudit}
                  onChange={(e) => {
                    const imp = { ...selectedProject.improvementLetter!, implementationAudit: e.target.value };
                    setSelectedProject({ ...selectedProject, improvementLetter: imp });
                  }}
                  placeholder="Summarize current implementation, code architecture, and what feels incomplete or deficient..."
                  style={{ width: '100%', padding: '10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #d4c8b8', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1a1612', marginBottom: '6px' }}>
                  Bug Reports & Defect Fixes (One per line)
                </label>
                <textarea
                  rows={3}
                  value={selectedProject.improvementLetter.bugReports.join('\n')}
                  onChange={(e) => {
                    const list = e.target.value.split('\n').filter(s => s.trim().length > 0);
                    const imp = { ...selectedProject.improvementLetter!, bugReports: list };
                    setSelectedProject({ ...selectedProject, improvementLetter: imp });
                  }}
                  placeholder="Edge case with 0 guesses remaining&#10;Card flip animation stuttering on mobile"
                  style={{ width: '100%', padding: '10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #d4c8b8', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1a1612', marginBottom: '6px' }}>
                  Feature Requests & Mechanic Expansions (One per line)
                </label>
                <textarea
                  rows={3}
                  value={selectedProject.improvementLetter.featureRequests.join('\n')}
                  onChange={(e) => {
                    const list = e.target.value.split('\n').filter(s => s.trim().length > 0);
                    const imp = { ...selectedProject.improvementLetter!, featureRequests: list };
                    setSelectedProject({ ...selectedProject, improvementLetter: imp });
                  }}
                  placeholder="Add hard mode with 50-number range&#10;Introduce token combo streaks"
                  style={{ width: '100%', padding: '10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #d4c8b8', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                <button
                  onClick={async () => {
                    await handleSaveProject();
                    setViewMode('checklist');
                  }}
                  style={{
                    backgroundColor: '#1b4731',
                    color: '#fcf8ee',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  Save & Manage Checklist →
                </button>

                <button
                  onClick={handleSaveProject}
                  style={{
                    backgroundColor: '#f0ece1',
                    color: '#1a1612',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    border: '1px solid #d4c8b8',
                  }}
                >
                  Save Draft
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: DYNAMIC 4-STATE CHECKLIST */}
        {viewMode === 'checklist' && selectedProject && (
          <div style={{
            backgroundColor: 'var(--color-paper-card)',
            borderRadius: '8px',
            border: '1px solid #d4c8b8',
            boxShadow: 'var(--shadow-desk-card)',
            padding: '24px',
            maxWidth: '900px',
            margin: '0 auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontFamily: 'var(--font-family-display)', margin: '0 0 4px 0' }}>
                  Dynamic Development Checklist
                </h2>
                <span style={{ fontSize: '12px', color: '#535c56' }}>
                  {selectedProject.title} ({workshopService.calculateProgress(selectedProject.checklist)}% completed)
                </span>
              </div>

              <button
                onClick={() => setViewMode('brief')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#1b4731',
                  color: '#fcf8ee',
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                <FileText size={14} />
                <span>Generate Brief</span>
              </button>
            </div>

            {/* Checklist Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {selectedProject.checklist.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    backgroundColor: item.completed ? '#f2f8f3' : '#faf7f0',
                    border: item.completed ? '1px solid #c2e0c6' : '1px solid #e2dad0',
                    borderRadius: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleChecklistItem(item.id)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{
                      fontSize: '13px',
                      color: item.completed ? '#66806a' : '#1a1612',
                      textDecoration: item.completed ? 'line-through' : 'none',
                    }}>
                      {item.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={item.state}
                      onChange={(e) => updateItemState(item.id, e.target.value as ChecklistItemState)}
                      style={{
                        fontSize: '11px',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        border: '1px solid #d4c8b8',
                        backgroundColor:
                          item.state === 'required' ? '#fae6e3' :
                          item.state === 'optional' ? '#eef4ff' :
                          item.state === 'not-needed' ? '#f0f0f0' : '#fff9db',
                        color:
                          item.state === 'required' ? '#a32b2b' :
                          item.state === 'optional' ? '#204ea8' :
                          item.state === 'not-needed' ? '#707070' : '#8f7200',
                        fontWeight: 600,
                      }}
                    >
                      <option value="required">Required</option>
                      <option value="optional">Optional</option>
                      <option value="not-needed">Not Needed</option>
                      <option value="to-be-decided">To Be Decided</option>
                    </select>

                    <button
                      onClick={() => removeChecklistItem(item.id)}
                      title="Remove item"
                      style={{ color: '#a09485', padding: '4px' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Custom Item */}
            <div style={{
              display: 'flex',
              gap: '8px',
              padding: '12px',
              backgroundColor: '#f7f4ec',
              borderRadius: '6px',
              border: '1px dashed #d4c8b8',
            }}>
              <input
                type="text"
                value={newChecklistLabel}
                onChange={(e) => setNewChecklistLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomChecklistItem()}
                placeholder="Add custom task or requirement..."
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid #d4c8b8',
                }}
              />
              <select
                value={newChecklistState}
                onChange={(e) => setNewChecklistState(e.target.value as ChecklistItemState)}
                style={{
                  fontSize: '12px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid #d4c8b8',
                  backgroundColor: '#fff',
                }}
              >
                <option value="required">Required</option>
                <option value="optional">Optional</option>
                <option value="not-needed">Not Needed</option>
                <option value="to-be-decided">To Be Decided</option>
              </select>
              <button
                onClick={addCustomChecklistItem}
                style={{
                  backgroundColor: '#1b4731',
                  color: '#fcf8ee',
                  fontSize: '12px',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                Add Item
              </button>
            </div>
          </div>
        )}

        {/* VIEW 5: STRUCTURED EDITABLE DEVELOPMENT BRIEF (18 SECTIONS) */}
        {viewMode === 'brief' && selectedProject && (
          <div style={{
            backgroundColor: 'var(--color-paper-card)',
            borderRadius: '8px',
            border: '1px solid #d4c8b8',
            boxShadow: 'var(--shadow-desk-card)',
            padding: '24px',
            maxWidth: '960px',
            margin: '0 auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontFamily: 'var(--font-family-display)', margin: '0 0 4px 0' }}>
                  AI Development Brief (18-Section Spec)
                </h2>
                <span style={{ fontSize: '12px', color: '#535c56' }}>
                  Exportable, fully editable markdown specification ready to pass directly to coding agents or developers.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    if (!isEditingBrief) {
                      setBriefEditText(selectedProject.briefMarkdown || workshopService.generateDevelopmentBrief(selectedProject));
                    }
                    setIsEditingBrief(!isEditingBrief);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: isEditingBrief ? '#c89528' : '#f0ece1',
                    color: isEditingBrief ? '#fff' : '#1a1612',
                    fontSize: '12px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d4c8b8',
                    fontWeight: 600,
                  }}
                >
                  {isEditingBrief ? <Eye size={14} /> : <Edit3 size={14} />}
                  <span>{isEditingBrief ? 'Preview Render' : 'Edit Brief'}</span>
                </button>

                {isEditingBrief && (
                  <button
                    onClick={handleSaveBriefEdit}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#1b4731',
                      color: '#fcf8ee',
                      fontSize: '12px',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontWeight: 600,
                    }}
                  >
                    <Check size={14} />
                    <span>Save Edits</span>
                  </button>
                )}

                <button
                  onClick={copyBriefToClipboard}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: copiedBrief ? '#2d6a45' : '#1b4731',
                    color: '#fcf8ee',
                    fontSize: '12px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    transition: 'background-color 0.2s',
                  }}
                >
                  {copiedBrief ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedBrief ? 'Copied to Clipboard!' : 'Copy Markdown'}</span>
                </button>
              </div>
            </div>

            {isEditingBrief ? (
              <div>
                <textarea
                  value={briefEditText}
                  onChange={(e) => setBriefEditText(e.target.value)}
                  style={{
                    width: '100%',
                    height: '520px',
                    backgroundColor: '#16120e',
                    color: '#e0d8cb',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    padding: '16px',
                    borderRadius: '6px',
                    border: '1px solid #382b1e',
                    lineHeight: '1.5',
                    resize: 'vertical',
                  }}
                />
              </div>
            ) : (
              <pre style={{
                backgroundColor: '#16120e',
                color: '#e0d8cb',
                padding: '16px',
                borderRadius: '6px',
                fontSize: '12px',
                lineHeight: '1.5',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                border: '1px solid #382b1e',
                maxHeight: '520px',
              }}>
                {selectedProject.briefMarkdown || workshopService.generateDevelopmentBrief(selectedProject)}
              </pre>
            )}
          </div>
        )}
      </CuttingMat>
    </div>
  );
};
