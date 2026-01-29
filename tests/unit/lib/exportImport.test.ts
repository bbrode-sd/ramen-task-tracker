import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock Firebase before importing anything that uses it
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date })),
  },
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
}));

import {
  validateImportData,
  parseImportFile,
  getExportFilename,
  downloadBlob,
  ExportedBoard,
  TrelloBoard,
} from '@/lib/exportImport';

describe('Export/Import Utilities', () => {
  describe('parseImportFile', () => {
    it('should parse valid JSON', () => {
      const json = '{"name": "Test Board"}';
      const result = parseImportFile(json);
      expect(result).toEqual({ name: 'Test Board' });
    });

    it('should throw error for invalid JSON', () => {
      expect(() => parseImportFile('invalid json')).toThrow('Invalid JSON file');
    });

    it('should handle empty JSON object', () => {
      const result = parseImportFile('{}');
      expect(result).toEqual({});
    });

    it('should handle JSON arrays', () => {
      const result = parseImportFile('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('getExportFilename', () => {
    it('should create sanitized filename with date', () => {
      const filename = getExportFilename('My Test Board', 'json');
      expect(filename).toMatch(/^my-test-board-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it('should handle special characters in board name', () => {
      const filename = getExportFilename('Board @#$% Special!', 'csv');
      expect(filename).toMatch(/^board-special-\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it('should handle leading/trailing dashes', () => {
      const filename = getExportFilename('---Test---', 'json');
      expect(filename).toMatch(/^test-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it('should handle empty board name', () => {
      const filename = getExportFilename('', 'json');
      // Empty name results in leading dash which gets removed, leaving just date
      expect(filename).toMatch(/-?\d{4}-\d{2}-\d{2}\.json$/);
    });
  });

  describe('validateImportData', () => {
    describe('Ramen format validation', () => {
      it('should validate correct Ramen format', () => {
        const validData: ExportedBoard = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          board: { name: 'Test Board' },
          columns: [{ id: 'col1', name: 'To Do', order: 0 }],
          cards: [
            {
              id: 'card1',
              columnId: 'col1',
              titleEn: 'Test Card',
              titleJa: 'テストカード',
              descriptionEn: '',
              descriptionJa: '',
              order: 0,
              labels: [],
              createdAt: new Date().toISOString(),
            },
          ],
          comments: [],
        };

        const result = validateImportData(validData);
        expect(result.isValid).toBe(true);
        expect(result.format).toBe('ramen');
        expect(result.errors).toHaveLength(0);
        expect(result.preview).toBeDefined();
        expect(result.preview?.boardName).toBe('Test Board');
        expect(result.preview?.columnCount).toBe(1);
        expect(result.preview?.cardCount).toBe(1);
      });

      it('should reject Ramen format without board name', () => {
        const invalidData = {
          version: '1.0',
          board: {},
          columns: [],
          cards: [],
        };

        const result = validateImportData(invalidData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Board must have a name');
      });

      it('should not recognize as Ramen format when columns is missing', () => {
        const invalidData = {
          version: '1.0',
          board: { name: 'Test' },
          cards: [],
        };

        const result = validateImportData(invalidData);
        // Without columns field, it's not recognized as Ramen format
        expect(result.isValid).toBe(false);
        expect(result.format).toBe('unknown');
      });

      it('should warn about cards without titles', () => {
        const data: ExportedBoard = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          board: { name: 'Test' },
          columns: [{ id: 'col1', name: 'To Do', order: 0 }],
          cards: [
            {
              id: 'card1',
              columnId: 'col1',
              titleEn: '',
              titleJa: '',
              descriptionEn: '',
              descriptionJa: '',
              order: 0,
              labels: [],
              createdAt: new Date().toISOString(),
            },
          ],
          comments: [],
        };

        const result = validateImportData(data);
        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Card at index 0 has no title');
      });

      it('should warn about cards referencing unknown columns', () => {
        const data: ExportedBoard = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          board: { name: 'Test' },
          columns: [{ id: 'col1', name: 'To Do', order: 0 }],
          cards: [
            {
              id: 'card1',
              columnId: 'unknown-column',
              titleEn: 'Orphan Card',
              titleJa: '',
              descriptionEn: '',
              descriptionJa: '',
              order: 0,
              labels: [],
              createdAt: new Date().toISOString(),
            },
          ],
          comments: [],
        };

        const result = validateImportData(data);
        expect(result.warnings.some((w) => w.includes('references unknown column'))).toBe(true);
      });
    });

    describe('Trello format validation', () => {
      it('should validate correct Trello format', () => {
        const validData: TrelloBoard = {
          name: 'Trello Board',
          lists: [
            { id: 'list1', name: 'To Do', pos: 1 },
            { id: 'list2', name: 'Done', pos: 2 },
          ],
          cards: [
            { id: 'card1', name: 'Task 1', idList: 'list1', pos: 1 },
          ],
        };

        const result = validateImportData(validData);
        expect(result.isValid).toBe(true);
        expect(result.format).toBe('trello');
        expect(result.preview).toBeDefined();
        expect(result.preview?.boardName).toBe('Trello Board');
        expect(result.preview?.columnCount).toBe(2);
        expect(result.preview?.cardCount).toBe(1);
      });

      it('should filter out closed lists and cards', () => {
        const data: TrelloBoard = {
          name: 'Trello Board',
          lists: [
            { id: 'list1', name: 'Open', pos: 1 },
            { id: 'list2', name: 'Closed', pos: 2, closed: true },
          ],
          cards: [
            { id: 'card1', name: 'Open Card', idList: 'list1', pos: 1 },
            { id: 'card2', name: 'Closed Card', idList: 'list1', pos: 2, closed: true },
          ],
        };

        const result = validateImportData(data);
        expect(result.preview?.columnCount).toBe(1);
        expect(result.preview?.cardCount).toBe(1);
      });

      it('should warn when no open lists are found', () => {
        const data: TrelloBoard = {
          name: 'Trello Board',
          lists: [
            { id: 'list1', name: 'Closed', pos: 1, closed: true },
          ],
          cards: [],
        };

        const result = validateImportData(data);
        expect(result.warnings).toContain('No open lists found in Trello export');
      });

      it('should reject Trello format without name', () => {
        const invalidData = {
          lists: [],
          cards: [],
        };

        const result = validateImportData(invalidData);
        expect(result.isValid).toBe(false);
      });
    });

    describe('Unknown format handling', () => {
      it('should reject null data', () => {
        const result = validateImportData(null);
        expect(result.isValid).toBe(false);
        expect(result.format).toBe('unknown');
        expect(result.errors).toContain('Invalid data format - expected JSON object');
      });

      it('should reject non-object data', () => {
        const result = validateImportData('string');
        expect(result.isValid).toBe(false);
        expect(result.format).toBe('unknown');
      });

      it('should reject unrecognized format', () => {
        const result = validateImportData({ random: 'data' });
        expect(result.isValid).toBe(false);
        expect(result.format).toBe('unknown');
        expect(result.errors[0]).toContain('Unrecognized file format');
      });
    });
  });

  describe('downloadBlob', () => {
    it('should create and trigger download', () => {
      // Mock DOM methods
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLAnchorElement);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as HTMLAnchorElement);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as HTMLAnchorElement);
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      downloadBlob('content', 'test.json', 'application/json');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('test.json');
      expect(mockLink.click).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();

      // Cleanup
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });
});
