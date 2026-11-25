export interface PegboardPreset {
  id: string;
  width: number;
  height: number;
}

export const DEFAULT_PEGBOARD: PegboardPreset = {
  id: 'default-24x18',
  width: 24,
  height: 18
};

/**
 * Pegboard size choices for scheme creation and image import.
 * Add presets here instead of exposing free-form dimensions in the UI.
 */
export const PEGBOARD_PRESETS: PegboardPreset[] = [DEFAULT_PEGBOARD];

/**
 * Available Artbead colors are deliberately stored as hexadecimal strings.
 * Add or remove entries here to update the Artbead tray for every new scheme.
 */
export const ARTBEAD_COLORS = [
  '#000000',
  '#FFFFFF',
  '#4A4A4A',
  '#8A8A8A',
  '#C9C9C9',
  '#F2E8D8',
  '#E7B89B',
  '#C98770',
  '#E7A4B3',
  '#C94C68',
  '#8E263F',
  '#F3C85B',
  '#E9934B',
  '#A7C982',
  '#4F875F',
  '#255649',
  '#8AC7D3',
  '#4E89B8',
  '#344F91',
  '#A997D9',
  '#73538D',
  '#5B3A2E'
] as const;

export const DEFAULT_ARTBEAD_COLOR = ARTBEAD_COLORS[0];
