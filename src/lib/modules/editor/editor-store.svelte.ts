import type { BeadColor, BeadPalette } from '$model/palette.model';
import type { BeadShape } from '$model/bead-shape.model';
import {
  DEFAULT_SELECTED_PALETTE_INDEX,
  PALETTE_MAX_COLORS
} from '$model/palette.model';
import {
  DEFAULT_EDITOR_TOOL,
  DEFAULT_EDITOR_ZOOM,
  EDITOR_HISTORY_LIMIT,
  ColorPickerMode,
  type BoardViewCenter,
  EditorTool
} from '$model/editor.model';
import {
  EMPTY_CELL_COLOR_INDEX,
  type BeadProject
} from '$model/project.model';
import {
  DEFAULT_PROJECT_PALETTE_SOURCE,
  PaletteSourceType,
  type ProjectPaletteSource
} from '$model/palette-source.model';
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
  DEFAULT_SELECTION_OPERATION,
  DEFAULT_MAGIC_WAND_THRESHOLD,
  MAX_MAGIC_WAND_THRESHOLD,
  MIN_MAGIC_WAND_THRESHOLD,
  type SelectionOperation
} from '$model/selection.model';
import {
  artbeadCodeForHex,
  clonePalette,
  createEmptyBeadColor,
  normalizeHexColor
} from '$domain/palette';
import { fillProjectRegion, touchProject } from '$domain/project';
import { clampBoardZoom } from './board-layout';
import { eraseSelectedCells } from './selection';
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
  selectionOperation = $state<SelectionOperation>(DEFAULT_SELECTION_OPERATION);
  colorPickerMode = $state<ColorPickerMode>(ColorPickerMode.Artbead);
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
      savedEditorState.temporaryLayer &&
      savedEditorState.temporaryLayer.cells.length ===
        savedEditorState.temporaryLayer.width *
          savedEditorState.temporaryLayer.height
        ? cloneSelectionLayer(savedEditorState.temporaryLayer)
        : null;
    const restoredSelection = new Set(
      savedEditorState.selectionCells.filter(
        (index) => index >= 0 && index < project.cells.length
      )
    );

    this.project = {
      ...project,
      palette: clonePalette(project.palette),
      paletteSource: project.paletteSource ?? {
        ...DEFAULT_PROJECT_PALETTE_SOURCE
      },
      editorState: {
        tool: restoredLayer
          ? EditorTool.Move
          : savedEditorState.tool,
        selectionCells: [...restoredSelection],
        temporaryLayer: restoredLayer,
        referenceImages: savedEditorState.referenceImages.map(
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
    this.tool = this.project.editorState.tool;
    this.selectionOperation = DEFAULT_SELECTION_OPERATION;
    this.colorPickerMode = ColorPickerMode.Artbead;
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
    this.selectionOperation = DEFAULT_SELECTION_OPERATION;
    this.colorPickerMode = ColorPickerMode.Artbead;
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

  setBeadShape(beadShape: BeadShape): void {
    if (!this.project || this.project.beadShape === beadShape) {
      return;
    }

    this.project.beadShape = beadShape;
    this.markChanged();
    this.previewRevision += 1;
  }

  setPaletteSource(source: ProjectPaletteSource): void {
    if (!this.project) {
      return;
    }

    const current = this.project.paletteSource;
    if (
      current.type === source.type &&
      (source.type === PaletteSourceType.Complete ||
        source.type === PaletteSourceType.Current ||
        (current.type === PaletteSourceType.Custom &&
          current.paletteId === source.paletteId))
    ) {
      return;
    }

    this.project.paletteSource =
      source.type === PaletteSourceType.Complete
        ? { type: PaletteSourceType.Complete }
        : source.type === PaletteSourceType.Current
          ? { type: PaletteSourceType.Current }
          : {
              type: PaletteSourceType.Custom,
              paletteId: source.paletteId
            };
    this.markChanged();
  }

  setColorPickerMode(mode: ColorPickerMode): void {
    this.colorPickerMode = mode;
    this.setTool(EditorTool.ColorPicker);
  }

  setSelectionOperation(operation: SelectionOperation): void {
    this.selectionOperation = operation;
  }

  get referenceImages(): readonly ReferenceImage[] {
    return this.project ? this.project.editorState.referenceImages : [];
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

    const editorState = this.project.editorState;
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

    const editorState = this.project.editorState;
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

    const editorState = this.project.editorState;
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

    const editorState = this.project.editorState;
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

  selectCatalogColor(hex: string): void {
    if (!this.project) {
      return;
    }

    const normalizedHex = normalizeHexColor(hex);
    let colorIndex = this.project.palette.colors.findIndex(
      (color) => normalizeHexColor(color.hex) === normalizedHex
    );

    if (colorIndex < 0) {
      if (this.project.palette.colors.length >= PALETTE_MAX_COLORS) {
        return;
      }
      this.project.palette.colors = [
        ...this.project.palette.colors,
        {
          id: `${this.project.palette.id}-${normalizedHex.slice(1)}`,
          name: artbeadCodeForHex(normalizedHex),
          hex: normalizedHex
        }
      ];
      colorIndex = this.project.palette.colors.length - 1;
      this.markChanged();
    }

    this.selectedColorIndex = colorIndex + 1;
  }

  toggleProjectPaletteColor(hex: string): void {
    if (!this.project) {
      return;
    }

    const normalizedHex = normalizeHexColor(hex);
    const colorIndex = this.project.palette.colors.findIndex(
      (color) => normalizeHexColor(color.hex) === normalizedHex
    );
    if (colorIndex >= 0) {
      this.removePaletteColor(colorIndex + 1);
      return;
    }
    this.selectCatalogColor(normalizedHex);
  }

  removePaletteColor(index: number): void {
    if (!this.project) {
      return;
    }
    const colors = this.project.palette.colors;
    const removed = colors[index - 1];
    if (!removed) {
      return;
    }

    const snapshot = createEditorSnapshot(this.project);
    const nextColors = colors.filter((_, colorIndex) => colorIndex !== index - 1);
    const nextIndexByColorId = new Map(
      nextColors.map((color, colorIndex) => [color.id, colorIndex + 1])
    );
    const selectedColorId = colors[this.selectedColorIndex - 1]?.id;

    this.project.cells = this.project.cells.map((cell) => {
      if (cell === EMPTY_CELL_COLOR_INDEX) {
        return EMPTY_CELL_COLOR_INDEX;
      }
      const color = colors[cell - 1];
      return color ? (nextIndexByColorId.get(color.id) ?? EMPTY_CELL_COLOR_INDEX) : EMPTY_CELL_COLOR_INDEX;
    });
    this.project.palette.colors = nextColors;
    this.selectedColorIndex =
      selectedColorId === removed.id
        ? Math.min(index, nextColors.length)
        : selectedColorId
          ? (nextIndexByColorId.get(selectedColorId) ?? EMPTY_CELL_COLOR_INDEX)
          : EMPTY_CELL_COLOR_INDEX;

    this.pushUndoSnapshot(snapshot);
    this.redoStack = [];
    this.refreshHistoryState();
    this.markChanged();
    this.previewRevision += 1;
  }

  movePaletteColor(fromIndex: number, toIndex: number): void {
    if (!this.project || fromIndex === toIndex) {
      return;
    }
    const colors = this.project.palette.colors;
    if (
      fromIndex < 1 ||
      fromIndex > colors.length ||
      toIndex < 1 ||
      toIndex > colors.length
    ) {
      return;
    }

    const nextColors = [...colors];
    const [moved] = nextColors.splice(fromIndex - 1, 1);
    nextColors.splice(toIndex - 1, 0, moved);
    const nextIndexByColorId = new Map(
      nextColors.map((color, colorIndex) => [color.id, colorIndex + 1])
    );
    const selectedColorId = colors[this.selectedColorIndex - 1]?.id;

    this.project.cells = this.project.cells.map((cell) => {
      if (cell === EMPTY_CELL_COLOR_INDEX) {
        return EMPTY_CELL_COLOR_INDEX;
      }
      const color = colors[cell - 1];
      return color ? (nextIndexByColorId.get(color.id) ?? EMPTY_CELL_COLOR_INDEX) : EMPTY_CELL_COLOR_INDEX;
    });
    this.project.palette.colors = nextColors;
    this.selectedColorIndex = selectedColorId
      ? (nextIndexByColorId.get(selectedColorId) ?? EMPTY_CELL_COLOR_INDEX)
      : EMPTY_CELL_COLOR_INDEX;
    this.markChanged();
    this.previewRevision += 1;
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

  deleteSelection(): boolean {
    if (!this.project || this.selectedCells.size === 0) {
      return false;
    }

    if (this.activePasteLayer) {
      this.activePasteLayer = null;
      this.selectedCells = new Set();
      this.markChanged();
      this.previewRevision += 1;
      return true;
    }

    const snapshot = createEditorSnapshot(this.project);
    const erased = eraseSelectedCells(this.project.cells, this.selectedCells);
    if (!erased.changed) {
      return false;
    }

    this.pushUndoSnapshot(snapshot);
    this.project.cells = erased.cells;
    this.redoStack = [];
    this.refreshHistoryState();
    this.markChanged();
    return true;
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
      this.tool === EditorTool.ColorPicker ||
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
    const filled = fillProjectRegion(
      this.project,
      this.selectedCells,
      index,
      this.selectedColorIndex
    );
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
