import type { BeadColor, BeadProject } from '$domain/project';
import { createEmptyBeadColor } from '$domain/palette';
import { floodFill, touchProject } from '$domain/project';

export type EditorTool = 'pencil' | 'eraser' | 'fill';

export class EditorStore {
  project = $state<BeadProject | null>(null);
  selectedColorIndex = $state(1);
  tool = $state<EditorTool>('pencil');
  revision = $state(0);
  savedRevision = $state(0);
  canUndo = $state(false);
  canRedo = $state(false);

  private undoStack: number[][] = [];
  private redoStack: number[][] = [];
  private strokeSnapshot: number[] | null = null;

  load(project: BeadProject): void {
    this.project = project;
    this.selectedColorIndex = project.palette.colors.length > 0 ? 1 : 0;
    this.undoStack = [];
    this.redoStack = [];
    this.strokeSnapshot = null;
    this.refreshHistoryState();
    this.revision += 1;
    this.savedRevision = this.revision;
  }

  close(): void {
    this.project = null;
    this.undoStack = [];
    this.redoStack = [];
    this.strokeSnapshot = null;
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

    this.strokeSnapshot = [...this.project.cells];
  }

  endStroke(): void {
    if (!this.project || !this.strokeSnapshot) {
      return;
    }

    const changed = this.strokeSnapshot.some(
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

  paint(index: number): void {
    if (!this.project || index < 0 || index >= this.project.cells.length) {
      return;
    }

    const nextColor = this.tool === 'eraser' ? 0 : this.selectedColorIndex;
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

    const snapshot = [...this.project.cells];
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

    this.redoStack.push([...this.project.cells]);
    this.project.cells = [...previous];
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

    this.undoStack.push([...this.project.cells]);
    this.project.cells = [...next];
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

    const snapshot = [...this.project.cells];
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

  private pushUndoSnapshot(snapshot: number[]): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 80) {
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
