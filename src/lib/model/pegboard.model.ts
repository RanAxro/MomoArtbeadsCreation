import { BLACK_HEX, WHITE_HEX } from './color.model';

export enum PegboardPresetId {
  Default24x18 = 'default-24x18'
}

export enum PegboardPresetLabelKey {
  Default = 'new.preset.default'
}

export interface PegboardPreset {
  id: PegboardPresetId;
  labelKey: PegboardPresetLabelKey;
  width: number;
  height: number;
}

export const DEFAULT_PEGBOARD: PegboardPreset = {
  id: PegboardPresetId.Default24x18,
  labelKey: PegboardPresetLabelKey.Default,
  width: 24,
  height: 18
};

export const PEGBOARD_PRESETS: readonly PegboardPreset[] = [DEFAULT_PEGBOARD];

export const ARTBEAD_COLORS = [
  BLACK_HEX,
  WHITE_HEX,
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

