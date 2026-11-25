import type { BeadPalette } from './palette.model';

export interface ProjectSummary {
  id: string;
  name: string;
  gameVersion: string;
  width: number;
  height: number;
  updatedAt: string;
  pixels: number[];
  palette: BeadPalette;
}

export interface SchemeTarget {
  id: string;
  name: string;
}

export interface SchemeMenu {
  target: SchemeTarget;
  x: number;
  y: number;
}

export const ACTIVE_SCHEME_STORAGE_KEY = 'momo-artbeads.active-scheme';
export const SCHEME_MENU_SIZE = {
  width: 176,
  height: 130,
  viewportMargin: 8
} as const;
export const SCHEME_TAB_GAP = 2;
export const SCHEME_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
};
export const WORKSPACE_ERRORS = {
  emptySchemeName: 'Scheme name cannot be empty'
} as const;
