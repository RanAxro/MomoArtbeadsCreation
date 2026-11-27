import { describe, expect, it, vi } from 'vitest';
import { selectionClipboardSchema } from '$model/selection-clipboard.model';
import { PROJECT_DATABASE_VERSION } from '$model/data.model';

describe('database backup', () => {
  it('uses database version 3 without stored color codes', () => {
    expect(PROJECT_DATABASE_VERSION).toBe(3);
  });

  it('creates a stable timestamped export filename', async () => {
    vi.stubGlobal('self', globalThis);
    const { createBackupFilename } = await import('./database-backup');
    expect(
      createBackupFilename(new Date('2026-11-26T12:34:56.789Z'))
    ).toBe('MomoArtbeadsCreation-20261126T123456Z.json');
    vi.unstubAllGlobals();
  });

  it('accepts a structurally valid clipboard record', () => {
    const clipboard = {
      id: 'clipboard-1',
      version: 1,
      copiedAt: '2026-11-26T12:00:00.000Z',
      lastUsedAt: '2026-11-26T12:05:00.000Z',
      sourceProjectId: 'project-1',
      sourceBounds: {
        minX: 2,
        minY: 3,
        maxX: 3,
        maxY: 4,
        width: 2,
        height: 2
      },
      board: {
        width: 2,
        height: 2,
        cells: [0, 1, 2, 0],
        palette: {
          id: 'palette-1',
          name: 'Test palette',
          colors: [
            {
              id: 'color-1',
              name: 'A01',
              hex: '#FFFFFF'
            },
            {
              id: 'color-2',
              name: 'A02',
              hex: '#000000'
            }
          ]
        }
      },
      selectionCells: [1, 2]
    };
    const result = selectionClipboardSchema.safeParse(clipboard);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.board.palette.colors[0]).not.toHaveProperty(
        'code'
      );
    }
    expect(
      selectionClipboardSchema.safeParse({
        ...clipboard,
        lastUsedAt: undefined
      }).success
    ).toBe(false);
  });

  it('rejects clipboard data with inconsistent dimensions', () => {
    const result = selectionClipboardSchema.safeParse({
      id: 'clipboard-1',
      version: 1,
      copiedAt: '2026-11-26T12:00:00.000Z',
      sourceProjectId: 'project-1',
      sourceBounds: {
        minX: 0,
        minY: 0,
        maxX: 2,
        maxY: 1,
        width: 2,
        height: 2
      },
      board: {
        width: 2,
        height: 2,
        cells: [0],
        palette: {
          id: 'palette-1',
          name: 'Test palette',
          colors: [
            {
              id: 'color-1',
              name: 'A01',
              hex: '#FFFFFF'
            }
          ]
        }
      },
      selectionCells: [0]
    });

    expect(result.success).toBe(false);
  });
});
