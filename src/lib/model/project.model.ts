import { z } from 'zod';
import { BeadShape } from './bead-shape.model';
import { EditorTool } from './editor.model';
import { paletteSchema, type BeadPalette } from './palette.model';
import { referenceImageSchema } from './reference-image.model';
import { selectionLayerSchema } from './selection-layer.model';

export enum GameVersion {
  V3 = '3.0'
}

export const PROJECT_SCHEMA_VERSION = 1;
export const MAX_PROJECT_DIMENSION = 300;
export const MAX_PROJECT_NAME_LENGTH = 80;
export const MIN_PROJECT_DIMENSION = 1;
export const DEFAULT_GAME_VERSION = GameVersion.V3;
export const DEFAULT_PROJECT_NAME = '未命名拼绘方案';
export const DEFAULT_DUPLICATE_SUFFIX = ' 副本';
export const EMPTY_CELL_COLOR_INDEX = 0;

const projectEditorStateSchema = z.object({
  tool: z.nativeEnum(EditorTool),
  selectionCells: z.array(z.number().int().nonnegative()),
  temporaryLayer: selectionLayerSchema.nullable(),
  referenceImages: z.array(referenceImageSchema)
});

export const beadProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH),
  gameVersion: z.string().min(1).max(30),
  width: z
    .number()
    .int()
    .min(MIN_PROJECT_DIMENSION)
    .max(MAX_PROJECT_DIMENSION),
  height: z
    .number()
    .int()
    .min(MIN_PROJECT_DIMENSION)
    .max(MAX_PROJECT_DIMENSION),
  beadShape: z.nativeEnum(BeadShape),
  cells: z.array(z.number().int().nonnegative()),
  palette: paletteSchema,
  editorState: projectEditorStateSchema,
  schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type BeadProject = z.infer<typeof beadProjectSchema>;

export interface NewProjectOptions {
  name: string;
  width: number;
  height: number;
  beadShape?: BeadShape;
  palette?: BeadPalette;
  gameVersion?: string;
}
