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
import {
  MAX_REFERENCE_IMAGE_SIZE,
  MIN_REFERENCE_IMAGE_SIZE,
  reorderReferenceImages,
  type ReferenceImage,
  type ReferenceImagePatch
} from '$model/reference-image.model';
import type { SelectionClipboard } from '$model/selection-clipboard.model';
import type { SelectionLayer } from '$model/selection-layer.model';
import {
  DEFAULT_MAGIC_WAND_THRESHOLD,
  MAX_MAGIC_WAND_THRESHOLD,
  MIN_MAGIC_WAND_THRESHOLD
} from '$model/selection.model';
import { clonePalette, createEmptyBeadColor } from '$domain/palette';
import { floodFill, touchProject } from '$domain/project';
import { clampBoardZoom } from './board-layout';
import {
  cloneSelectionLayer,
  createSelectionClipboard as createClipboardFromSelection,
  createLiftedSelectionLayer,
  createSelectionLayer,
  getVisibleLayerSelection,
  mergeSelectionLayer,
  moveSelectionLayer
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
  magicWandThreshold = $state(DEFAULT_MAGIC_WAND_THRESHOLD);
  tool = $state<EditorTool>(DEFAULT_EDITOR_TOOL);
  selectedCells = $state<ReadonlySet<number>>(new Set());
  revision = $state(0);
  savedRevision = $state(0);
  canUndo = $state(false);
  canRedo = $state(false);
  zoom = $state(DEFAULT_EDITOR_ZOOM);
  visibleBoardCenter = $state<BoardViewCenter>({ x: 0, y: 0 });
  activePasteLayer = $state<SelectionLayer | null>(null);
  selectedReferenceImageId = $state<string | null>(null);
  previewRevision = $state(0);

  private undoStack: EditorSnapshot[] = [];
  private redoStack: EditorSnapshot[] = [];
  private strokeSnapshot: EditorSnapshot | null = null;

  load(project: BeadProject): void {
    const savedEditorState = project.editorState;
    const restoredLayer =
      savedEditorState?.temporaryLayer &&
      savedEditorState.temporaryLayer.cells.length ===
        savedEditorState.temporaryLayer.width *
          savedEditorState.temporaryLayer.height
        ? cloneSelectionLayer(savedEditorState.temporaryLayer)
        : null;
    const restoredSelection = new Set(
      (savedEditorState?.selectionCells ?? []).filter(
        (index) => index >= 0 && index < project.cells.length
      )
    );

    this.project = {
      ...project,
      editorState: {
        tool: restoredLayer
          ? EditorTool.Move
          : (savedEditorState?.tool ?? DEFAULT_EDITOR_TOOL),
        selectionCells: [...restoredSelection],
        temporaryLayer: restoredLayer,
        referenceImages: (savedEditorState?.referenceImages ?? []).map(
          (reference) => ({ ...reference })
        )
      }
    };
    this.selectedColorIndex =
      project.palette.colors.length > 0
        ? DEFAULT_SELECTED_PALETTE_INDEX
        : EMPTY_CELL_COLOR_INDEX;
    this.undoStack = [];
    this.redoStack = [];
    this.strokeSnapshot = null;
    this.selectedCells = restoredLayer
      ? new Set(
          getVisibleLayerSelection(
            restoredLayer,
            project.width,
            project.height
          )
        )
      : restoredSelection;
    this.zoom = DEFAULT_EDITOR_ZOOM;
    this.visibleBoardCenter = { x: 0, y: 0 };
    this.activePasteLayer = restoredLayer;
    this.tool = this.project.editorState?.tool ?? DEFAULT_EDITOR_TOOL;
    this.selectedReferenceImageId = null;
    this.previewRevision += 1;
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
    this.activePasteLayer = null;
    this.selectedReferenceImageId = null;
    this.previewRevision += 1;
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
    if (
      tool === EditorTool.Move &&
      this.selectedCells.size === 0 &&
      !this.activePasteLayer
    ) {
      return;
    }

    const previousTool = this.tool;
    if (this.activePasteLayer && tool !== EditorTool.Move) {
      this.mergePasteLayer();
    }
    this.tool = tool;
    this.selectedReferenceImageId = null;
    if (previousTool !== tool) {
      this.markChanged();
    }
  }

  get referenceImages(): readonly ReferenceImage[] {
    return this.project?.editorState?.referenceImages ?? [];
  }

  get selectedReferenceImage(): ReferenceImage | null {
    return (
      this.referenceImages.find(
        (reference) => reference.id === this.selectedReferenceImageId
      ) ?? null
    );
  }

  selectReferenceImage(id: string): boolean {
    if (!this.referenceImages.some((reference) => reference.id === id)) {
      return false;
    }

    this.selectedReferenceImageId = id;
    return true;
  }

  clearReferenceImageSelection(): void {
    this.selectedReferenceImageId = null;
  }

  addReferenceImage(reference: ReferenceImage): void {
    if (!this.project) {
      return;
    }

    const editorState = this.ensureEditorState();
    editorState.referenceImages = [
      { ...reference },
      ...editorState.referenceImages
    ];
    this.selectedReferenceImageId = reference.id;
    this.markChanged();
  }

  updateReferenceImage(
    id: string,
    patch: Partial<ReferenceImagePatch>
  ): void {
    if (!this.project) {
      return;
    }

    const editorState = this.ensureEditorState();
    const index = editorState.referenceImages.findIndex(
      (reference) => reference.id === id
    );
    const reference = editorState.referenceImages[index];
    if (!reference) {
      return;
    }

    const maxSize = Math.min(
      MAX_REFERENCE_IMAGE_SIZE,
      Math.max(this.project.width, this.project.height) * 4
    );
    const width = Math.max(
      MIN_REFERENCE_IMAGE_SIZE,
      Math.min(maxSize, patch.width ?? reference.width)
    );
    const height = Math.max(
      MIN_REFERENCE_IMAGE_SIZE,
      Math.min(maxSize, patch.height ?? reference.height)
    );
    const next: ReferenceImage = {
      ...reference,
      ...patch,
      width,
      height,
      rotation:
        patch.rotation === undefined
          ? reference.rotation
          : ((patch.rotation % 360) + 360) % 360
    };
    if (
      next.centerX === reference.centerX &&
      next.centerY === reference.centerY &&
      next.width === reference.width &&
      next.height === reference.height &&
      next.rotation === reference.rotation
    ) {
      return;
    }

    editorState.referenceImages = editorState.referenceImages.map(
      (candidate) => (candidate.id === id ? next : candidate)
    );
    this.markChanged();
  }

  removeReferenceImage(id: string): void {
    if (!this.project) {
      return;
    }

    const editorState = this.ensureEditorState();
    if (!editorState.referenceImages.some((reference) => reference.id === id)) {
      return;
    }

    editorState.referenceImages = editorState.referenceImages.filter(
      (reference) => reference.id !== id
    );
    if (this.selectedReferenceImageId === id) {
      this.selectedReferenceImageId = null;
    }
    this.markChanged();
  }

  moveReferenceImage(id: string, targetIndex: number): boolean {
    if (!this.project) {
      return false;
    }

    const editorState = this.ensureEditorState();
    const currentIndex = editorState.referenceImages.findIndex(
      (reference) => reference.id === id
    );
    if (currentIndex < 0) {
      return false;
    }

    const nextIndex = Math.max(
      0,
      Math.min(editorState.referenceImages.length - 1, Math.round(targetIndex))
    );
    if (currentIndex === nextIndex) {
      return false;
    }

    editorState.referenceImages = reorderReferenceImages(
      editorState.referenceImages,
      id,
      nextIndex
    );
    this.markChanged();
    return true;
  }

  setSelectedColor(index: number): void {
    this.selectedColorIndex = index;
  }

  setMagicWandThreshold(threshold: number): void {
    this.magicWandThreshold = Math.max(
      MIN_MAGIC_WAND_THRESHOLD,
      Math.min(MAX_MAGIC_WAND_THRESHOLD, Math.round(threshold))
    );
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
    this.markChanged();
  }

  clearSelection(): void {
    if (this.activePasteLayer) {
      this.mergePasteLayer();
    }
    if (this.selectedCells.size > 0) {
      this.selectedCells = new Set();
      this.markChanged();
    }
  }

  createSelectionClipboard(): SelectionClipboard | null {
    if (!this.project || this.selectedCells.size === 0) {
      return null;
    }

    const project = $state.snapshot(this.project) as BeadProject;
    if (this.activePasteLayer) {
      const composite = mergeSelectionLayer(project, this.activePasteLayer);
      if (composite) {
        project.cells = composite.cells;
        project.palette = composite.palette;
        return createClipboardFromSelection(
          project,
          composite.selection
        );
      }
    }

    return createClipboardFromSelection(
      project,
      this.selectedCells
    );
  }

  pasteSelectionClipboard(clipboard: SelectionClipboard): boolean {
    if (!this.project) {
      return false;
    }

    if (this.activePasteLayer) {
      this.mergePasteLayer();
    }

    const createdLayer = createSelectionLayer(
      clipboard,
      this.visibleBoardCenter
    );
    if (!createdLayer) {
      return false;
    }

    const layer = moveSelectionLayer(
      createdLayer,
      createdLayer.x,
      createdLayer.y,
      this.project.width,
      this.project.height
    );
    this.activePasteLayer = layer;
    this.tool = EditorTool.Move;
    this.selectedCells = new Set(
      getVisibleLayerSelection(
        layer,
        this.project.width,
        this.project.height
      )
    );
    this.markChanged();
    this.previewRevision += 1;
    return true;
  }

  movePasteLayer(x: number, y: number): void {
    if (!this.project || !this.activePasteLayer) {
      return;
    }

    this.activePasteLayer = moveSelectionLayer(
      this.activePasteLayer,
      x,
      y,
      this.project.width,
      this.project.height
    );
    this.selectedCells = new Set(
      getVisibleLayerSelection(
        this.activePasteLayer,
        this.project.width,
        this.project.height
      )
    );
    this.markChanged();
    this.previewRevision += 1;
  }

  mergePasteLayer(): void {
    if (!this.project || !this.activePasteLayer) {
      return;
    }

    const result = mergeSelectionLayer(this.project, this.activePasteLayer);
    if (result?.changed) {
      this.pushUndoSnapshot(createEditorSnapshot(this.project));
      this.project.cells = result.cells;
      this.project.palette = result.palette;
      this.redoStack = [];
      this.refreshHistoryState();
      this.markChanged();
    }

    this.selectedCells = result ? new Set(result.selection) : new Set();
    this.activePasteLayer = null;
    this.markChanged();
    this.previewRevision += 1;
  }

  beginSelectionMove(): boolean {
    if (
      !this.project ||
      this.activePasteLayer ||
      this.selectedCells.size === 0
    ) {
      return false;
    }

    const layer = createLiftedSelectionLayer(
      this.project,
      this.selectedCells
    );
    if (!layer) {
      return false;
    }

    this.activePasteLayer = layer;
    this.selectedCells = new Set(
      getVisibleLayerSelection(
        layer,
        this.project.width,
        this.project.height
      )
    );
    this.markChanged();
    this.previewRevision += 1;
    return true;
  }

  paint(index: number): void {
    if (
      !this.project ||
      this.tool === EditorTool.ColorSelect ||
      this.tool === EditorTool.MagicWand ||
      this.tool === EditorTool.Select ||
      this.tool === EditorTool.Move ||
      this.activePasteLayer ||
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
    if (!this.project) {
      return null;
    }

    const snapshot = $state.snapshot(this.project) as BeadProject;
    snapshot.editorState = {
      tool: this.tool,
      selectionCells: [...this.selectedCells].sort(
        (first, second) => first - second
      ),
      temporaryLayer: this.activePasteLayer
        ? cloneSelectionLayer(this.activePasteLayer)
        : null,
      referenceImages: this.referenceImages.map((reference) => ({
        ...reference
      }))
    };
    return touchProject(snapshot);
  }

  private ensureEditorState(): NonNullable<BeadProject['editorState']> {
    if (!this.project) {
      throw new Error('Editor project is not open.');
    }
    if (!this.project.editorState) {
      this.project.editorState = {
        tool: this.tool,
        selectionCells: [...this.selectedCells],
        temporaryLayer: null,
        referenceImages: []
      };
    }
    if (!this.project.editorState.referenceImages) {
      this.project.editorState.referenceImages = [];
    }

    return this.project.editorState;
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
