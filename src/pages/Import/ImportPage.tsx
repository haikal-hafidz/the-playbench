import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileCode,
  FileArchive,
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Play,
  Trash2,
  HelpCircle,
  FolderOpen,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { importService, ImportCandidate, ConflictResolution } from '../../services/import/importService';
import { ImportMethod, ImportRecord } from '../../types';

export const ImportPage: React.FC = () => {
  const navigate = useNavigate();

  // Mode: Host Mode vs Player Mode
  const [isHostMode, setIsHostMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('playbench_user_role');
      return stored ? stored === 'host' : true;
    } catch {
      return true;
    }
  });

  // Active Tab
  const [activeTab, setActiveTab] = useState<ImportMethod | 'history'>('json');

  // JSON Tab State
  const [jsonInput, setJsonInput] = useState<string>('');
  const [jsonFileName, setJsonFileName] = useState<string>('custom-manifest.json');
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  // ZIP Tab State
  const [zipFile, setZipFile] = useState<File | null>(null);
  const zipFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingZip, setIsDraggingZip] = useState<boolean>(false);

  // URL Tab State
  const [urlInput, setUrlInput] = useState<string>('');

  // Processing & Candidate state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<ImportCandidate | null>(null);

  // Conflict Resolution Modal
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);

  // Execution Result
  const [importResult, setImportResult] = useState<ImportRecord | null>(null);

  // History State
  const [historyRecords, setHistoryRecords] = useState<ImportRecord[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Sample Templates
  const sampleManifest = JSON.stringify(
    {
      tpgpVersion: '1.0.0',
      id: 'puzzle-peg-solitaire',
      title: 'Peg Solitaire',
      version: '1.0.0',
      tagline: 'Classic English board puzzle of jumps and eliminations',
      description: 'Clear the board until only one peg remains in the center slot.',
      genre: ['Puzzle', 'Strategy'],
      author: {
        name: 'Workshop Artisan',
        url: 'https://github.com/haikal-hafidz/the-playbench',
      },
      players: {
        min: 1,
        max: 1,
        type: 'solo',
      },
      runtime: {
        type: 'html-standalone',
        entrypoint: 'index.html',
        aspectRatio: '1:1',
      },
      tags: ['board-game', 'classic', 'tpgp-v1'],
    },
    null,
    2
  );

  const sampleQuestionBank = JSON.stringify(
    {
      title: 'Workshop Trivia Pack',
      version: '1.0.0',
      description: 'Pack of 10 trivia questions on game mechanics and tabletop design.',
      questions: [
        {
          id: 'q1',
          question: 'What is the standard grid material of The Playbench?',
          options: ['Wood veneer', 'Green self-healing cutting mat', 'Marble slate'],
          answerIndex: 1,
        },
        {
          id: 'q2',
          question: 'What does TPGP stand for?',
          options: ['The Playbench Game Package', 'Total Player Grid Protocol'],
          answerIndex: 0,
        },
      ],
    },
    null,
    2
  );

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const records = await importService.getHistory();
      // Sort newest first
      setHistoryRecords(records.sort((a, b) => b.importedAt - a.importedAt));
    } catch (err) {
      console.warn('Could not read import history from IndexedDB:', err);
    }
  };

  const toggleHostMode = () => {
    const nextMode = !isHostMode;
    setIsHostMode(nextMode);
    try {
      localStorage.setItem('playbench_user_role', nextMode ? 'host' : 'player');
    } catch (e) {
      // Ignore localStorage errors
    }
  };

  // Inspect JSON
  const handleInspectJson = async (contentToInspect?: string, filename?: string) => {
    const content = contentToInspect !== undefined ? contentToInspect : jsonInput;
    const name = filename || jsonFileName;

    if (!content.trim()) {
      setProcessError('Please paste JSON text or select a JSON file.');
      return;
    }

    setIsProcessing(true);
    setProcessError(null);
    setCandidate(null);
    setImportResult(null);

    try {
      const result = await importService.inspectJson(content, name);
      setCandidate(result);
      if (result.isConflict) {
        setShowConflictModal(true);
      }
    } catch (err: any) {
      setProcessError(err.message || 'Failed to inspect JSON file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setJsonFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
      handleInspectJson(content, file.name);
    };
    reader.onerror = () => {
      setProcessError('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  // Inspect ZIP
  const handleInspectZipFile = async (fileToInspect?: File) => {
    const file = fileToInspect || zipFile;
    if (!file) {
      setProcessError('Please choose or drop a .zip file.');
      return;
    }

    setIsProcessing(true);
    setProcessError(null);
    setCandidate(null);
    setImportResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const result = await importService.inspectZip(buffer, file.name);
      setCandidate(result);
      if (result.isConflict) {
        setShowConflictModal(true);
      }
    } catch (err: any) {
      setProcessError(err.message || 'Failed to unpack or inspect ZIP package.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleZipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setZipFile(file);
      handleInspectZipFile(file);
    }
  };

  const handleZipDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingZip(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.zip')) {
      setZipFile(file);
      handleInspectZipFile(file);
    } else {
      setProcessError('Dropped file must be a .zip package.');
    }
  };

  // Inspect URL
  const handleInspectUrl = async () => {
    const url = urlInput.trim();
    if (!url) {
      setProcessError('Please enter a complete HTTPS URL pointing to a manifest or ZIP package.');
      return;
    }

    setIsProcessing(true);
    setProcessError(null);
    setCandidate(null);
    setImportResult(null);

    try {
      const result = await importService.inspectUrl(url);
      setCandidate(result);
      if (result.isConflict) {
        setShowConflictModal(true);
      }
    } catch (err: any) {
      setProcessError(err.message || 'Failed to fetch package from remote URL.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Import
  const handleExecuteImport = async (resolution: ConflictResolution = 'replace') => {
    if (!candidate) return;

    setShowConflictModal(false);
    setIsProcessing(true);

    try {
      const record = await importService.executeImport(candidate, resolution);
      setImportResult(record);
      await loadHistory();
    } catch (err: any) {
      setProcessError(err.message || 'Import operation encountered an unexpected error.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteHistoryEntry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await importService.deleteHistoryEntry(id);
      await loadHistory();
    } catch (err) {
      console.warn('Could not delete history record:', err);
    }
  };

  const filteredHistory = historyRecords.filter((rec) => {
    if (historyFilter === 'all') return true;
    return rec.status === historyFilter;
  });

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px 48px 20px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-family-craft)',
                fontSize: '11px',
                color: '#e8c872',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              Platform Intake • Stage 4
            </span>
            <span
              style={{
                fontSize: '10px',
                backgroundColor: isHostMode ? '#3a4d2c' : '#42372c',
                color: isHostMode ? '#c8f5a6' : '#f5e4b7',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 600,
              }}
            >
              {isHostMode ? 'Workbench Host Mode' : 'Player View'}
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-family-display)',
              fontSize: '28px',
              color: '#fcf8ee',
              fontWeight: 700,
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Upload size={28} color="#e8c872" />
            <span>The Import Center</span>
          </h1>

          <p style={{ color: '#c9d1cc', fontSize: '13px', marginTop: '4px', maxWidth: '640px' }}>
            Bring small games, manifests, question banks, and custom datasets onto your cutting mat.
            Supports direct JSON evaluation, verified ZIP unpacking into local storage, and remote HTTPS fetching.
          </p>
        </div>

        {/* Role Toggle Switch & Quick Links */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={toggleHostMode}
            title="Toggle between Host Admin mode and Guest Player view"
            style={{
              backgroundColor: isHostMode ? '#2d3e23' : '#332921',
              color: '#fcf8ee',
              fontSize: '11px',
              fontWeight: 600,
              padding: '7px 12px',
              borderRadius: '6px',
              border: `1px solid ${isHostMode ? '#587a3d' : '#574230'}`,
              cursor: 'pointer',
            }}
          >
            Role: {isHostMode ? 'Host (Full Access)' : 'Player (Restricted)'}
          </button>

          <button
            onClick={() => navigate('/protocol')}
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              color: '#fcf8ee',
              fontSize: '11px',
              fontWeight: 500,
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <HelpCircle size={13} />
            <span>TPGP Specs</span>
          </button>
        </div>
      </div>

      {/* Guest Mode Restriction Warning if not in Host Mode */}
      {!isHostMode && (
        <div
          style={{
            backgroundColor: '#2b2118',
            border: '1px solid #734e2c',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#fce3be',
            fontSize: '12px',
          }}
        >
          <Info size={18} color="#e8c872" />
          <span>
            <strong>Player Mode Active:</strong> You are browsing as a friend/player. You can review import history
            and launch imported games, but package registration is limited to preserve host storage integrity.
          </span>
        </div>
      )}

      {/* Main Tab Bar */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '2px solid #36291e',
          marginBottom: '20px',
        }}
      >
        <button
          onClick={() => {
            setActiveTab('json');
            setCandidate(null);
            setProcessError(null);
            setImportResult(null);
          }}
          style={{
            backgroundColor: activeTab === 'json' ? '#27201a' : 'transparent',
            color: activeTab === 'json' ? '#e8c872' : '#9e9180',
            border: 'none',
            borderBottom: activeTab === 'json' ? '3px solid #e8c872' : '3px solid transparent',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FileCode size={15} />
          <span>JSON Import</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('zip');
            setCandidate(null);
            setProcessError(null);
            setImportResult(null);
          }}
          style={{
            backgroundColor: activeTab === 'zip' ? '#27201a' : 'transparent',
            color: activeTab === 'zip' ? '#e8c872' : '#9e9180',
            border: 'none',
            borderBottom: activeTab === 'zip' ? '3px solid #e8c872' : '3px solid transparent',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FileArchive size={15} />
          <span>ZIP Package</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('url');
            setCandidate(null);
            setProcessError(null);
            setImportResult(null);
          }}
          style={{
            backgroundColor: activeTab === 'url' ? '#27201a' : 'transparent',
            color: activeTab === 'url' ? '#e8c872' : '#9e9180',
            border: 'none',
            borderBottom: activeTab === 'url' ? '3px solid #e8c872' : '3px solid transparent',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Globe size={15} />
          <span>Remote URL</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('history');
            setCandidate(null);
            setProcessError(null);
            setImportResult(null);
            loadHistory();
          }}
          style={{
            backgroundColor: activeTab === 'history' ? '#27201a' : 'transparent',
            color: activeTab === 'history' ? '#e8c872' : '#9e9180',
            border: 'none',
            borderBottom: activeTab === 'history' ? '3px solid #e8c872' : '3px solid transparent',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: 'auto',
          }}
        >
          <Clock size={15} />
          <span>Import History ({historyRecords.length})</span>
        </button>
      </div>

      {/* TAB CONTENT 1: JSON IMPORT */}
      {activeTab === 'json' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }} className="import-grid">
          <div>
            <div
              style={{
                backgroundColor: '#1b1612',
                border: '1px solid #36291e',
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fcf8ee' }}>
                  Paste Manifest, Question Bank, or Entities JSON
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setJsonInput(sampleManifest)}
                    style={{
                      fontSize: '11px',
                      backgroundColor: '#27201a',
                      color: '#e8c872',
                      border: '1px solid #473727',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Load Sample TPGP
                  </button>
                  <button
                    onClick={() => setJsonInput(sampleQuestionBank)}
                    style={{
                      fontSize: '11px',
                      backgroundColor: '#27201a',
                      color: '#e8c872',
                      border: '1px solid #473727',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Load Trivia Bank
                  </button>
                  <button
                    onClick={() => jsonFileInputRef.current?.click()}
                    style={{
                      fontSize: '11px',
                      backgroundColor: '#3b2f24',
                      color: '#fcf8ee',
                      border: '1px solid #574433',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <FolderOpen size={12} />
                    <span>Browse .json</span>
                  </button>
                  <input
                    ref={jsonFileInputRef}
                    type="file"
                    accept=".json,application/json"
                    style={{ display: 'none' }}
                    onChange={handleJsonFileUpload}
                  />
                </div>
              </div>

              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste { &quot;tpgpVersion&quot;: &quot;1.0.0&quot;, &quot;id&quot;: &quot;...&quot; } or questions/entities JSON here..."
                rows={16}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  backgroundColor: '#120f0d',
                  color: '#e0d8cb',
                  border: '1px solid #2e2319',
                  borderRadius: '6px',
                  padding: '12px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />

              <div
                style={{
                  marginTop: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '12px', color: '#8a7d6d' }}>
                  {jsonInput ? `${new Blob([jsonInput]).size} bytes` : 'Ready to inspect'}
                </span>
                <button
                  onClick={() => handleInspectJson()}
                  disabled={isProcessing || !jsonInput.trim()}
                  style={{
                    backgroundColor: isProcessing || !jsonInput.trim() ? '#473d32' : '#e8c872',
                    color: '#1b1612',
                    fontWeight: 700,
                    fontSize: '13px',
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: isProcessing || !jsonInput.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <FileCode size={16} />
                  <span>{isProcessing ? 'Validating...' : 'Validate & Inspect'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Guide */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                backgroundColor: '#1f1914',
                border: '1px solid #36291e',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-family-display)',
                  fontSize: '14px',
                  color: '#e8c872',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Info size={15} />
                <span>JSON Import Rules</span>
              </h3>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#b5a999', lineHeight: 1.6 }}>
                <li>
                  <strong>TPGP Manifest:</strong> Must include <code>id</code>, <code>title</code>, <code>version</code>, and <code>runtime</code>.
                </li>
                <li>
                  <strong>Question/Answer Banks:</strong> Identified via <code>questions</code> or <code>answers</code> arrays and routed to custom datasets.
                </li>
                <li>
                  <strong>Safety Boundary:</strong> JSON manifests provide structure and config, not runnable game code. Standalone playable games require a ZIP package or bundled assets.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      )}

      {/* TAB CONTENT 2: ZIP PACKAGE IMPORT */}
      {activeTab === 'zip' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }} className="import-grid">
          <div>
            <div
              style={{
                backgroundColor: '#1b1612',
                border: '1px solid #36291e',
                borderRadius: '8px',
                padding: '24px',
              }}
            >
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingZip(true);
                }}
                onDragLeave={() => setIsDraggingZip(false)}
                onDrop={handleZipDrop}
                onClick={() => zipFileInputRef.current?.click()}
                style={{
                  border: isDraggingZip ? '2px dashed #e8c872' : '2px dashed #4d3a2b',
                  backgroundColor: isDraggingZip ? 'rgba(232, 200, 114, 0.08)' : '#16120e',
                  borderRadius: '8px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                }}
              >
                <FileArchive
                  size={44}
                  color={isDraggingZip ? '#e8c872' : '#8c7760'}
                  style={{ margin: '0 auto 12px auto' }}
                />
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#fcf8ee' }}>
                  {zipFile ? zipFile.name : 'Click to select or drag and drop a TPGP .zip package'}
                </div>
                <div style={{ fontSize: '12px', color: '#8c7a67', marginTop: '6px' }}>
                  Maximum compressed size 15MB • Max decompressed 30MB • Up to 150 files
                </div>
                <input
                  ref={zipFileInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  style={{ display: 'none' }}
                  onChange={handleZipFileChange}
                />
              </div>

              {zipFile && (
                <div
                  style={{
                    marginTop: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '12px', color: '#e8c872' }}>
                    Selected: <strong>{zipFile.name}</strong> ({(zipFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                  <button
                    onClick={() => handleInspectZipFile()}
                    disabled={isProcessing}
                    style={{
                      backgroundColor: '#e8c872',
                      color: '#1b1612',
                      fontWeight: 700,
                      fontSize: '13px',
                      padding: '8px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <FileArchive size={16} />
                    <span>{isProcessing ? 'Unpacking & Verifying...' : 'Inspect ZIP Archive'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                backgroundColor: '#1f1914',
                border: '1px solid #36291e',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-family-display)',
                  fontSize: '14px',
                  color: '#e8c872',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ShieldAlert size={15} />
                <span>Package Security Checks</span>
              </h3>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#b5a999', lineHeight: 1.6 }}>
                <li>
                  <strong>Archive Linter:</strong> Prohibits <code>../</code> directory breakouts and absolute paths.
                </li>
                <li>
                  <strong>Manifest Inspection:</strong> Expects <code>tpgp.json</code> in archive root.
                </li>
                <li>
                  <strong>Isolated Storage:</strong> Files are stored in IndexedDB under the game's unique package ID.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      )}

      {/* TAB CONTENT 3: REMOTE URL IMPORT */}
      {activeTab === 'url' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }} className="import-grid">
          <div>
            <div
              style={{
                backgroundColor: '#1b1612',
                border: '1px solid #36291e',
                borderRadius: '8px',
                padding: '24px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fcf8ee', marginBottom: '8px' }}>
                Remote Package or Manifest URL
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/.../tpgp.json or package.zip"
                  style={{
                    flex: 1,
                    backgroundColor: '#120f0d',
                    color: '#e0d8cb',
                    border: '1px solid #2e2319',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: '13px',
                  }}
                />
                <button
                  onClick={handleInspectUrl}
                  disabled={isProcessing || !urlInput.trim()}
                  style={{
                    backgroundColor: isProcessing || !urlInput.trim() ? '#473d32' : '#e8c872',
                    color: '#1b1612',
                    fontWeight: 700,
                    fontSize: '13px',
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: isProcessing || !urlInput.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Globe size={16} />
                  <span>{isProcessing ? 'Fetching...' : 'Fetch & Inspect'}</span>
                </button>
              </div>

              <div style={{ marginTop: '12px', fontSize: '11px', color: '#8a7d6d' }}>
                Must be an HTTPS endpoint. Downloads are subject to a 10-second timeout and 15MB limit.
              </div>
            </div>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                backgroundColor: '#1f1914',
                border: '1px solid #36291e',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-family-display)',
                  fontSize: '14px',
                  color: '#e8c872',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Globe size={15} />
                <span>CORS & Untrusted URLs</span>
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#b5a999', lineHeight: 1.6 }}>
                Browsers enforce Cross-Origin Resource Sharing (CORS). If a remote host disallows direct browser downloads,
                download the file locally and import it via the JSON or ZIP tab.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* TAB CONTENT 4: IMPORT HISTORY */}
      {activeTab === 'history' && (
        <div>
          {/* Filter Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['all', 'success', 'failed'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setHistoryFilter(filter)}
                  style={{
                    backgroundColor: historyFilter === filter ? '#e8c872' : '#27201a',
                    color: historyFilter === filter ? '#1b1612' : '#c9bfb1',
                    border: '1px solid #3d2f24',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '12px', color: '#9e9180' }}>
              Showing {filteredHistory.length} of {historyRecords.length} records
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div
              style={{
                backgroundColor: '#1b1612',
                border: '1px dashed #36291e',
                borderRadius: '8px',
                padding: '40px 20px',
                textAlign: 'center',
                color: '#8c7a67',
                fontSize: '13px',
              }}
            >
              No import history records found matching filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredHistory.map((rec) => {
                const isExpanded = expandedHistoryId === rec.id;
                const isSuccess = rec.status === 'success';

                return (
                  <div
                    key={rec.id}
                    onClick={() => setExpandedHistoryId(isExpanded ? null : rec.id)}
                    style={{
                      backgroundColor: '#1b1612',
                      border: `1px solid ${isSuccess ? '#2e3d23' : '#3d2525'}`,
                      borderRadius: '8px',
                      padding: '14px 18px',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isSuccess ? (
                          <CheckCircle2 size={18} color="#85d154" />
                        ) : rec.status === 'cancelled' ? (
                          <AlertTriangle size={18} color="#e8c872" />
                        ) : (
                          <XCircle size={18} color="#d95d5d" />
                        )}

                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#fcf8ee' }}>
                            {rec.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#8a7d6d', marginTop: '2px' }}>
                            Method: <code>{rec.importMethod.toUpperCase()}</code> • Source: {rec.source} •{' '}
                            {new Date(rec.importedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: isSuccess ? '#24331b' : '#3d1b1b',
                            color: isSuccess ? '#a3e878' : '#f08989',
                          }}
                        >
                          {rec.status.toUpperCase()}
                        </span>

                        {isSuccess && rec.registeredGameId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/gamespace/${rec.registeredGameId}`);
                            }}
                            style={{
                              backgroundColor: '#e8c872',
                              color: '#1b1612',
                              border: 'none',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Play size={12} />
                            <span>Play</span>
                          </button>
                        )}

                        <button
                          onClick={(e) => handleDeleteHistoryEntry(rec.id, e)}
                          title="Delete entry"
                          style={{
                            backgroundColor: 'transparent',
                            color: '#8a7d6d',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>

                        {isExpanded ? <ChevronDown size={16} color="#8a7d6d" /> : <ChevronRight size={16} color="#8a7d6d" />}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: '12px',
                          paddingTop: '12px',
                          borderTop: '1px solid #292017',
                          fontSize: '12px',
                        }}
                      >
                        {rec.failureReason && (
                          <div style={{ color: '#f08989', marginBottom: '8px' }}>
                            <strong>Reason:</strong> {rec.failureReason}
                          </div>
                        )}

                        <div style={{ color: '#b0a495' }}>
                          <strong>Content Type:</strong> {rec.contentType}
                        </div>
                        {rec.version && (
                          <div style={{ color: '#b0a495' }}>
                            <strong>Version:</strong> {rec.version}
                          </div>
                        )}
                        {rec.validationResult.warnings.length > 0 && (
                          <div style={{ marginTop: '6px', color: '#e8c872' }}>
                            <strong>Warnings ({rec.validationResult.warnings.length}):</strong>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                              {rec.validationResult.warnings.map((w, idx) => (
                                <li key={idx}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Global Processing / Error Notice */}
      {processError && (
        <div
          style={{
            marginTop: '20px',
            backgroundColor: '#2e1414',
            border: '1px solid #702e2e',
            borderRadius: '8px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            color: '#f7bcbc',
            fontSize: '13px',
          }}
        >
          <AlertTriangle size={18} color="#f06262" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <strong>Validation or Download Error:</strong>
            <p style={{ margin: '4px 0 0 0', lineHeight: 1.5 }}>{processError}</p>
          </div>
        </div>
      )}

      {/* INSPECTION PREVIEW CARD */}
      {candidate && (
        <div
          style={{
            marginTop: '24px',
            backgroundColor: '#1b1612',
            border: `2px solid ${
              candidate.validation.status === 'valid'
                ? '#415e31'
                : candidate.validation.status === 'valid-with-warnings'
                ? '#735c28'
                : '#702e2e'
            }`,
            borderRadius: '10px',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor:
                      candidate.validation.status === 'valid'
                        ? '#2f4a21'
                        : candidate.validation.status === 'valid-with-warnings'
                        ? '#574218'
                        : '#521d1d',
                    color:
                      candidate.validation.status === 'valid'
                        ? '#b9f598'
                        : candidate.validation.status === 'valid-with-warnings'
                        ? '#fce085'
                        : '#ff9c9c',
                  }}
                >
                  {candidate.validation.status.replace('-', ' ')}
                </span>
                <span style={{ fontSize: '12px', color: '#8a7d6d' }}>
                  Target Destination: <code>{candidate.validation.destination}</code>
                </span>
              </div>

              <h2
                style={{
                  fontFamily: 'var(--font-family-display)',
                  fontSize: '22px',
                  color: '#fcf8ee',
                  fontWeight: 700,
                  marginTop: '8px',
                }}
              >
                {candidate.validation.name || candidate.sourceName}
              </h2>

              {candidate.validation.description && (
                <p style={{ color: '#b8aba0', fontSize: '13px', marginTop: '4px', maxWidth: '640px' }}>
                  {candidate.validation.description}
                </p>
              )}
            </div>

            {/* Import Execution Button */}
            <div>
              {candidate.validation.status !== 'invalid' && candidate.validation.status !== 'unsupported' ? (
                <button
                  onClick={() => {
                    if (candidate.isConflict) {
                      setShowConflictModal(true);
                    } else {
                      handleExecuteImport('replace');
                    }
                  }}
                  disabled={isProcessing}
                  style={{
                    backgroundColor: '#e8c872',
                    color: '#1b1612',
                    fontWeight: 700,
                    fontSize: '14px',
                    padding: '10px 24px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  <Upload size={17} />
                  <span>{isProcessing ? 'Installing...' : 'Register to Playbench'}</span>
                </button>
              ) : (
                <button
                  disabled
                  style={{
                    backgroundColor: '#3b2f2f',
                    color: '#a88f8f',
                    fontSize: '13px',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'not-allowed',
                  }}
                >
                  Cannot Import (Invalid)
                </button>
              )}
            </div>
          </div>

          {/* Inspection Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              backgroundColor: '#14100c',
              padding: '14px 18px',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          >
            <div>
              <div style={{ color: '#7a6f62' }}>Content Type</div>
              <div style={{ color: '#fcf8ee', fontWeight: 600, marginTop: '2px' }}>
                {candidate.validation.contentType}
              </div>
            </div>
            <div>
              <div style={{ color: '#7a6f62' }}>Version</div>
              <div style={{ color: '#fcf8ee', fontWeight: 600, marginTop: '2px' }}>
                {candidate.validation.version || 'Unspecified'}
              </div>
            </div>
            <div>
              <div style={{ color: '#7a6f62' }}>Author</div>
              <div style={{ color: '#fcf8ee', fontWeight: 600, marginTop: '2px' }}>
                {candidate.validation.author?.name || 'Anonymous'}
              </div>
            </div>
            <div>
              <div style={{ color: '#7a6f62' }}>Playable Engine</div>
              <div style={{ color: candidate.validation.isPlayable ? '#85d154' : '#e8c872', fontWeight: 600, marginTop: '2px' }}>
                {candidate.validation.isPlayable ? `Yes (${candidate.validation.runtimeEntrypoint})` : 'Data/Metadata Only'}
              </div>
            </div>
            {candidate.extractedFiles && (
              <div>
                <div style={{ color: '#7a6f62' }}>Archive Files</div>
                <div style={{ color: '#fcf8ee', fontWeight: 600, marginTop: '2px' }}>
                  {candidate.extractedFiles.size} extracted files
                </div>
              </div>
            )}
          </div>

          {/* Validation Warnings */}
          {candidate.validation.warnings.length > 0 && (
            <div style={{ marginTop: '14px', fontSize: '12px', color: '#f5d687' }}>
              <strong>Notices & Warnings ({candidate.validation.warnings.length}):</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {candidate.validation.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Validation Errors */}
          {candidate.validation.errors.length > 0 && (
            <div style={{ marginTop: '14px', fontSize: '12px', color: '#f79797' }}>
              <strong>Schema Violations & Errors ({candidate.validation.errors.length}):</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {candidate.validation.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* IMPORT RESULT SUCCESS BANNER */}
      {importResult && (
        <div
          style={{
            marginTop: '24px',
            backgroundColor: importResult.status === 'success' ? '#182e14' : '#2b1b1b',
            border: `1px solid ${importResult.status === 'success' ? '#467536' : '#703333'}`,
            borderRadius: '8px',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {importResult.status === 'success' ? (
              <CheckCircle2 size={24} color="#85d154" />
            ) : (
              <XCircle size={24} color="#d95d5d" />
            )}
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fcf8ee' }}>
                {importResult.status === 'success' ? 'Import Completed Successfully' : 'Import Unsuccessful'}
              </div>
              <div style={{ fontSize: '12px', color: '#c9d1cc', marginTop: '2px' }}>
                {importResult.failureReason || `Installed "${importResult.name}" into Playbench storage.`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {importResult.status === 'success' && importResult.registeredGameId && (
              <button
                onClick={() => navigate(`/gamespace/${importResult.registeredGameId}`)}
                style={{
                  backgroundColor: '#e8c872',
                  color: '#1b1612',
                  fontWeight: 700,
                  fontSize: '13px',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Play size={15} />
                <span>Launch in GameSpace</span>
              </button>
            )}

            <button
              onClick={() => navigate('/collection')}
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#fcf8ee',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer',
              }}
            >
              View in Collection
            </button>
          </div>
        </div>
      )}

      {/* CONFLICT RESOLUTION MODAL */}
      {showConflictModal && candidate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#1f1914',
              border: '2px solid #e8c872',
              borderRadius: '10px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e8c872', marginBottom: '12px' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Game ID Conflict Detected</h3>
            </div>

            <p style={{ color: '#d9cfbe', fontSize: '13px', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              A game with ID <code>{candidate.id}</code> is already registered on this workbench:
              <br />
              <strong>Existing:</strong> "{candidate.existingGame?.title}" (v{candidate.existingGame?.version})
              <br />
              <strong>Incoming:</strong> "{candidate.validation.name}" (v{candidate.validation.version})
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => handleExecuteImport('replace')}
                style={{
                  backgroundColor: '#e8c872',
                  color: '#1b1612',
                  fontWeight: 700,
                  fontSize: '13px',
                  padding: '10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                1. Replace Existing Game
                <div style={{ fontSize: '11px', fontWeight: 400, color: '#473d09' }}>
                  Overwrite the registered game and its package files with the incoming version.
                </div>
              </button>

              <button
                onClick={() => handleExecuteImport('skip')}
                style={{
                  backgroundColor: '#2b231c',
                  color: '#fcf8ee',
                  fontWeight: 600,
                  fontSize: '13px',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #4a3b2f',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                2. Skip Incoming Game
                <div style={{ fontSize: '11px', fontWeight: 400, color: '#9e9180' }}>
                  Keep the current installed game intact and log this import as skipped.
                </div>
              </button>

              <button
                onClick={() => {
                  setShowConflictModal(false);
                  handleExecuteImport('cancel');
                }}
                style={{
                  backgroundColor: 'transparent',
                  color: '#b89d8f',
                  fontSize: '12px',
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Cancel Import Operation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsive adjustments */}
      <style>{`
        @media (max-width: 900px) {
          .import-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
