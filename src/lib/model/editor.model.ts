import { IconName } from './icon.model';

export enum EditorTool {
  ColorSelect = 'color-select',
  MagicWand = 'magic-wand',
  Select = 'select',
  Move = 'move',
  ColorPicker = 'color-picker',
  Pencil = 'pencil',
  Eraser = 'eraser',
  Fill = 'fill'
}

export enum EditorToolShortcut {
  ColorSelect = 'C',
  MagicWand = 'W',
  Select = 'M',
  Move = 'V',
  ColorPicker = 'I',
  Pencil = 'B',
  Eraser = 'E',
  Fill = 'G'
}

export enum EditorToolLabelKey {
  ColorSelect = 'board.colorSelect',
  MagicWand = 'board.magicWand',
  Select = 'board.select',
  Move = 'board.move',
  ColorPicker = 'board.colorPicker',
  Pencil = 'board.pencil',
  Eraser = 'board.eraser',
  Fill = 'board.fill'
}

export enum ColorPickerMode {
  Artbead = 'artbead',
  Reference = 'reference'
}

export enum EditorCommandKey {
  Copy = 'c',
  Paste = 'v',
  Undo = 'z',
  Redo = 'y',
  Save = 's'
}

export interface BoardLayout {
  edgeInset: number;
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
  originX: number;
  originY: number;
  boardWidth: number;
  boardHeight: number;
  cellSize: number;
  rulerThickness: number;
  rulerGap: number;
}

export interface BoardCell {
  x: number;
  y: number;
  index: number;
}

export interface BoardViewCenter {
  x: number;
  y: number;
}

export interface EditorToolDefinition {
  id: EditorTool;
  icon: IconName;
  labelKey: EditorToolLabelKey;
  shortcut: EditorToolShortcut;
}

export const EDITOR_TOOL_DEFINITIONS: readonly EditorToolDefinition[] = [
  {
    id: EditorTool.ColorSelect,
    icon: IconName.ColorSelect,
    labelKey: EditorToolLabelKey.ColorSelect,
    shortcut: EditorToolShortcut.ColorSelect
  },
  {
    id: EditorTool.MagicWand,
    icon: IconName.MagicWand,
    labelKey: EditorToolLabelKey.MagicWand,
    shortcut: EditorToolShortcut.MagicWand
  },
  {
    id: EditorTool.Select,
    icon: IconName.Select,
    labelKey: EditorToolLabelKey.Select,
    shortcut: EditorToolShortcut.Select
  },
  {
    id: EditorTool.Move,
    icon: IconName.Move,
    labelKey: EditorToolLabelKey.Move,
    shortcut: EditorToolShortcut.Move
  },
  {
    id: EditorTool.ColorPicker,
    icon: IconName.ColorPicker,
    labelKey: EditorToolLabelKey.ColorPicker,
    shortcut: EditorToolShortcut.ColorPicker
  },
  {
    id: EditorTool.Pencil,
    icon: IconName.Pencil,
    labelKey: EditorToolLabelKey.Pencil,
    shortcut: EditorToolShortcut.Pencil
  },
  {
    id: EditorTool.Eraser,
    icon: IconName.Eraser,
    labelKey: EditorToolLabelKey.Eraser,
    shortcut: EditorToolShortcut.Eraser
  },
  {
    id: EditorTool.Fill,
    icon: IconName.Fill,
    labelKey: EditorToolLabelKey.Fill,
    shortcut: EditorToolShortcut.Fill
  }
];

export const DEFAULT_EDITOR_TOOL = EditorTool.Pencil;
export const DEFAULT_EDITOR_ZOOM = 1;
export const MIN_BOARD_ZOOM = 0.5;
export const MAX_BOARD_ZOOM = 4;
export const EDITOR_HISTORY_LIMIT = 80;
export const AUTO_SAVE_DELAY_MS = 550;

export const BOARD_LAYOUT = {
  minRulerThickness: 18,
  maxRulerThickness: 24,
  rulerThicknessRatio: 0.045,
  rulerGap: 4,
  minEdgeInset: 8,
  maxEdgeInset: 16,
  edgeInsetRatio: 0.025,
  minCanvasSize: 1
} as const;

export const DEFAULT_BOARD_LAYOUT: BoardLayout = {
  edgeInset: BOARD_LAYOUT.minEdgeInset,
  contentX: 0,
  contentY: 0,
  contentWidth: BOARD_LAYOUT.minCanvasSize,
  contentHeight: BOARD_LAYOUT.minCanvasSize,
  originX: 0,
  originY: 0,
  boardWidth: 0,
  boardHeight: 0,
  cellSize: BOARD_LAYOUT.maxRulerThickness,
  rulerThickness: BOARD_LAYOUT.minRulerThickness,
  rulerGap: BOARD_LAYOUT.rulerGap
};
