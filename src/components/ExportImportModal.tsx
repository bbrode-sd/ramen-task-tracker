'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useRouter } from 'next/navigation';
import {
  exportBoardToJSON,
  exportBoardToCSV,
  downloadBlob,
  validateImportData,
  importBoardFromJSON,
  parseImportFile,
  getExportFilename,
  ValidationResult,
  ExportedBoard,
  TrelloBoard,
} from '@/lib/exportImport';

interface ExportImportModalProps {
  boardId: string;
  boardName: string;
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'export' | 'import';
type ExportFormat = 'json' | 'csv';

export function ExportImportModal({ boardId, boardName, isOpen, onClose }: ExportImportModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>('export');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [isExporting, setIsExporting] = useState(false);
  const [exportPreview, setExportPreview] = useState<{
    columns: number;
    cards: number;
    comments: number;
  } | null>(null);

  // Import state
  const [isDragging, setIsDragging] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<unknown>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState('');

  // Load export preview when modal opens
  useEffect(() => {
    if (isOpen && boardId && activeTab === 'export') {
      loadExportPreview();
    }
  }, [isOpen, boardId, activeTab]);

  const loadExportPreview = async () => {
    try {
      const data = await exportBoardToJSON(boardId);
      setExportPreview({
        columns: data.columns.length,
        cards: data.cards.length,
        comments: data.comments.length,
      });
    } catch (error) {
      console.error('Failed to load export preview:', error);
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isImporting) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, isImporting]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && !isImporting) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, isImporting]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setImportFile(null);
      setImportData(null);
      setValidationResult(null);
      setImportProgress(0);
      setImportMessage('');
    }
  }, [isOpen]);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      if (exportFormat === 'json') {
        const data = await exportBoardToJSON(boardId);
        const content = JSON.stringify(data, null, 2);
        downloadBlob(content, getExportFilename(boardName, 'json'), 'application/json');
        showToast('success', 'Board exported successfully!');
      } else {
        const csvContent = await exportBoardToCSV(boardId);
        downloadBlob(csvContent, getExportFilename(boardName, 'csv'), 'text/csv');
        showToast('success', 'Board exported as CSV!');
      }
    } catch (error) {
      console.error('Export error:', error);
      showToast('error', 'Failed to export board');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = useCallback(async (file: File) => {
    setImportFile(file);
    setValidationResult(null);

    try {
      const content = await file.text();
      const data = parseImportFile(content);
      setImportData(data);

      const validation = validateImportData(data);
      setValidationResult(validation);
    } catch (error) {
      setValidationResult({
        isValid: false,
        format: 'unknown',
        errors: [error instanceof Error ? error.message : 'Failed to read file'],
        warnings: [],
      });
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
      handleFileSelect(file);
    } else {
      showToast('error', 'Please drop a JSON file');
    }
  }, [handleFileSelect, showToast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleImport = async () => {
    if (!user || !importData || !validationResult?.isValid) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportMessage('Starting import...');

    try {
      const newBoardId = await importBoardFromJSON(
        importData as ExportedBoard | TrelloBoard,
        user.uid,
        validationResult.format as 'ramen' | 'trello',
        (progress, message) => {
          setImportProgress(progress);
          setImportMessage(message);
        }
      );

      showToast('success', 'Board imported successfully!');
      onClose();

      // Navigate to the new board
      router.push(`/boards/${newBoardId}`);
    } catch (error) {
      console.error('Import error:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to import board');
    } finally {
      setIsImporting(false);
    }
  };

  const clearImportFile = () => {
    setImportFile(null);
    setImportData(null);
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Export / Import</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Back up or restore your board</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('export')}
            disabled={isImporting}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'export'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </div>
            {activeTab === 'export' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('import')}
            disabled={isImporting}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'import'
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import
            </div>
            {activeTab === 'import' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 dark:bg-green-400" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'export' ? (
            <div className="space-y-5">
              {/* Format selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setExportFormat('json')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      exportFormat === 'json'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        exportFormat === 'json' ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <svg className={`w-4 h-4 ${exportFormat === 'json' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                      </div>
                      <span className={`font-semibold ${exportFormat === 'json' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                        JSON
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Full backup including columns, cards, comments, and checklists
                    </p>
                  </button>

                  <button
                    onClick={() => setExportFormat('csv')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      exportFormat === 'csv'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        exportFormat === 'csv' ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <svg className={`w-4 h-4 ${exportFormat === 'csv' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className={`font-semibold ${exportFormat === 'csv' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                        CSV
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Cards only, compatible with Excel and Google Sheets
                    </p>
                  </button>
                </div>
              </div>

              {/* Preview */}
              {exportPreview && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Export Preview
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{exportPreview.columns}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Columns</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{exportPreview.cards}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Cards</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{exportPreview.comments}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Comments</div>
                    </div>
                  </div>
                  {exportFormat === 'csv' && (
                    <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      CSV export includes cards only. Use JSON for full backup.
                    </p>
                  )}
                </div>
              )}

              {/* Export button */}
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium rounded-xl hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                {isExporting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download {exportFormat.toUpperCase()}
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* File drop zone */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {!importFile ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-green-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4 ${
                    isDragging ? 'bg-green-100 dark:bg-green-800' : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <svg className={`w-6 h-6 ${isDragging ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                    Drop a JSON file here or click to browse
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Supports Ramen Task Tracker and Trello exports
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected file */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{importFile.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {(importFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    {!isImporting && (
                      <button
                        onClick={clearImportFile}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Validation result */}
                  {validationResult && (
                    <div className={`rounded-xl p-4 ${
                      validationResult.isValid
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    }`}>
                      <div className="flex items-start gap-3">
                        {validationResult.isValid ? (
                          <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        <div className="flex-1">
                          <p className={`font-medium ${
                            validationResult.isValid
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-red-700 dark:text-red-300'
                          }`}>
                            {validationResult.isValid
                              ? `Valid ${validationResult.format === 'trello' ? 'Trello' : 'Ramen'} export`
                              : 'Invalid file format'}
                          </p>

                          {/* Errors */}
                          {validationResult.errors.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {validationResult.errors.map((error, i) => (
                                <li key={i} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-1.5">
                                  <span className="text-red-400">•</span>
                                  {error}
                                </li>
                              ))}
                            </ul>
                          )}

                          {/* Warnings */}
                          {validationResult.warnings.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {validationResult.warnings.map((warning, i) => (
                                <li key={i} className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                                  <span className="text-amber-400">•</span>
                                  {warning}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Import preview */}
                  {validationResult?.isValid && validationResult.preview && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                        Will Create
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {validationResult.preview.columnCount}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Columns</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {validationResult.preview.cardCount}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Cards</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {validationResult.preview.commentCount}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Comments</div>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                        A new board named &quot;{validationResult.preview.boardName}&quot; will be created
                      </p>
                    </div>
                  )}

                  {/* Progress indicator */}
                  {isImporting && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{importMessage}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{importProgress}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
                          style={{ width: `${importProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Import button */}
              <button
                onClick={handleImport}
                disabled={!validationResult?.isValid || isImporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-xl hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                {isImporting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import Board
                  </>
                )}
              </button>

              {/* Help text */}
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Importing will create a new board. The original will not be affected.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
