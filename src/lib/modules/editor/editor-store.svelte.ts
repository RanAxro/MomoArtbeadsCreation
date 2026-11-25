import type { BeadColor, BeadPalette } from '$model/palette.model';
import {
  DEFAULT_SELECTED_PALETTE_INDEX
} from '$model/palette.model';
import {
  DEFAULT_EDITOR_TOOL,
  DEFAULT_EDITOR_ZOOM,
  EDITOR_HISTORY_LIMIT,
  type BoardViewCenter,
  EditorTool
} from '$model/editor.model';
import {
  EMPTY_CELL_COLOR_INDEX,
  type BeadProject
} from '$model/project.model';
import type { SelectionClipboard } from '$model/selection-clipboard.model';
import { clonePalette, createEmptyBeadColor } from '$domain/palette';
import { floodFill, touchProject } from '$domain/project';
import { clampBoardZoom } from './board-layout';
import {
  createSelectionClipboard as createClipboardFromSelection,
  pasteSelectionClipboard as buildSelectionPaste
} from './selection-clipboard';

interface EditorSnapshot {
  cells: number[];
  palette: BeadPalette;
}

function createEditorSnapshot(project: BeadProject): EditorSnapshot {
  return {
    cells: [...project.cells],
    palette: clonePalette(project.palette)
  };
}

export class EditorStore {
  project = $state<BeadProject | null>(null);
  selectedColorIndex = $state(DEFAULT_SELECTED_PALETTE_INDEX);
  tool = $state<EditorTool>(DEFAULT_EDITOR_TOOL);
  selectedCells = $state<ReadonlySet<number>>(new Set());
  revision = $state(0);
  savedRevision = $state(0);
  canUndo = $state(false);
  canRedo = $state(false);
  zoom = $state(DEFAULT_EDITOR_ZOOM);
  visibleBoardCenter = $state<BoardViewCenter>({ x: 0, y: 0 });

  private undoStack: EditorSnapshot[] = [];
  private redoStack: EditorSnapshot[] = [];
  private strokeSnapshot: EditorSnapshot | null = null;

  load(project: BeadProject): void {
    this.project = project;
    this.selectedColorIndex =
      project.palette.colors.length > 0
        ? DEFAULT_SELECTED_PALETTE_INDEX
        : EMPTY_CELL_COLOR_INDEX;
    this.undoStack = [];
    this.redoStack = [];
    this.strokeSnapshot = null;
    this.selectedCells = new Set();
    this.zoom = DEFAULT_EDITOR_ZOOM;
    this.visibleBoardCenter = { x: 0, y: 0 };
    this.refreshHistoryState();
    this.revision += 1;
    this.savedRevision = this.revision;
  }

  close(): void {
    this.project = null;
    this.undoStack = [];
    this.redoStack = [];
    this.strokeSnapshot = null;
    this.selectedCells = new Set();
    this.zoom = DEFAULT_EDITOR_ZOOM;
    this.visibleBoardCenter = { x: 0, y: 0 };
    this.canUndo = false;
    this.canRedo = false;
  }

  markSaved(revision: number): void {
    if (this.revision === revision) {
      this.savedRevision = revision;
    }
  }

  beginStroke(): void {
    if (!this.project || this.strokeSnapshot) {
      return;
    }

    this.strokeSnapshot = createEditorSnapshot(this.project);
  }

  endStroke(): void {
    if (!this.project || !this.strokeSnapshot) {
      return;
    }

    const changed = this.strokeSnapshot.cells.some(
      (cell, index) => cell !== this.project?.cells[index]
    );

    if (changed) {
      this.pushUndoSnapshot(this.strokeSnapshot);
      this.redoStack = [];
    }

    this.strokeSnapshot = null;
    this.refreshHistoryState();
  }

  setTool(tool: EditorTool): void {
    this.tool = tool;
  }

  setSelectedColor(index: number): void {
    this.selectedColorIndex = index;
  }

  setZoom(zoom: number): void {
    this.zoom = clampBoardZoom(zoom);
  }

  setVisibleBoardCenter(center: BoardViewCenter): void {
    if (
      Math.abs(this.visibleBoardCenter.x - center.x) < 0.001 &&
      Math.abs(this.visibleBoardCenter.y - center.y) < 0.001
    ) {
      return;
    }
    this.visibleBoardCenter = center;
  }

  setSelection(cells: ReadonlySet<number>): void {
    this.selectedCells = new Set(cells);
  }

  clearSelection(): void {
    if (this.selectedCells.size > 0) {
      this.selectedCells = new Set();
    }
  }

  createSelectionClipboard(): SelectionClipboard | null {
    if (!this.project || this.selectedCells.size === 0) {
      return null;
    }

    return createClipboardFromSelection(
      $state.snapshot(this.project) as BeadProject,
      this.selectedCells
    );
  }

  pasteSelectionClipboard(clipboard: SelectionClipboard): boolean {
    if (!this.project) {
      return false;
    }

    const result = buildSelectionPaste(
      this.project,
      clipboard,
      this.visibleBoardCenter
    );
    if (!result) {
      return false;
    }

    if (result.changed) {
      this.pushUndoSnapshot(createEditorSnapshot(this.project));
      this.project.cells = result.cells;
      this.project.palette = result.palette;
      this.redoStack = [];
      this.refreshHistoryState();
      this.markChanged();
    }

    this.setSelection(result.selection);
    return true;
  }

  paint(index: number): void {
    if (
      !this.project ||
      this.tool === EditorTool.Select ||
      index < 0 ||
      index >= this.project.cells.length
    ) {
      return;
    }

    const nextColor =
      this.tool === EditorTool.Eraser
        ? EMPTY_CELL_COLOR_INDEX
        : this.selectedColorIndex;
    if (this.project.cells[index] === nextColor) {
      return;
    }

    this.beginStroke();
    this.project.cells[index] = nextColor;
    this.markChanged();
  }

  fill(index: number): void {
    if (!this.project) {
      return;
    }

    const snapshot = createEditorSnapshot(this.project);
    const filled = floodFill(this.project, index, this.selectedColorIndex);
    if (filled === this.project) {
      return;
    }

    this.project.cells = filled.cells;
    this.pushUndoSnapshot(snapshot);
    this.redoStack = [];
    this.refreshHistoryState();
    this.markChanged();
  }

  undo(): void {
    if (!this.project) {
      return;
    }

    const previous = this.undoStack.pop();
    if (!previous) {
      return;
    }

    this.redoStack.push(createEditorSnapshot(this.project));
    this.project.cells = [...previous.cells];
    this.project.palette = clonePalette(previous.palette);
    this.refreshHistoryState();
    this.markChanged();
  }

  redo(): void {
    if (!this.project) {
      return;
    }

    const next = this.redoStack.pop();
    if (!next) {
      return;
    }

    this.undoStack.push(createEditorSnapshot(this.project));
    this.project.cells = [...next.cells];
    this.project.palette = clonePalette(next.palette);
    this.refreshHistoryState();
    this.markChanged();
  }

  addColor(): BeadColor | undefined {
    if (!this.project) {
      return undefined;
    }

    const color = createEmptyBeadColor(
      this.project.palette.id,
      this.project.palette.colors.length + 1
    );
    this.project.palette.colors = [...this.project.palette.colors, color];
    this.selectedColorIndex = this.project.palette.colors.length;
    this.markChanged();
    return color;
  }

  updateColor(index: number, patch: Partial<BeadColor>): void {
    if (!this.project) {
      return;
    }

    const color = this.project.palette.colors[index - 1];
    if (!color) {
      return;
    }

    this.project.palette.colors[index - 1] = { ...color, ...patch };
    this.project.palette.colors = [...this.project.palette.colors];
    this.markChanged();
  }

  replaceColor(fromIndex: number, toIndex: number): void {
    if (!this.project || fromIndex === toIndex) {
      return;
    }

    const snapshot = createEditorSnapshot(this.project);
    this.project.cells = this.project.cells.map((cell) =>
      cell === fromIndex ? toIndex : cell
    );
    this.pushUndoSnapshot(snapshot);
    this.redoStack = [];
    this.refreshHistoryState();
    this.markChanged();
  }

  toSnapshot(): BeadProject | null {
    return this.project ? touchProject($state.snapshot(this.project)) : null;
  }

  private pushUndoSnapshot(snapshot: EditorSnapshot): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > EDITOR_HISTORY_LIMIT) {
      this.undoStack.shift();
    }
  }

  private refreshHistoryState(): void {
    this.canUndo = this.undoStack.length > 0;
    this.canRedo = this.redoStack.length > 0;
  }

  private markChanged(): void {
    this.revision += 1;
  }
}
