import { BLACK_HEX, WHITE_HEX } from './color.model';

export enum PegboardPresetId {
  Small24x18 = 'small-24x18',
  Medium48x36 = 'medium-48x36',
  Large84x63 = 'large-84x63'
}

export enum PegboardPresetLabelKey {
  Small = 'new.preset.small',
  Medium = 'new.preset.medium',
  Large = 'new.preset.large'
}

export interface PegboardPreset {
  id: PegboardPresetId;
  labelKey: PegboardPresetLabelKey;
  width: number;
  height: number;
}

export const DEFAULT_PEGBOARD: PegboardPreset = {
  id: PegboardPresetId.Small24x18,
  labelKey: PegboardPresetLabelKey.Small,
  width: 24,
  height: 18
};

export const PEGBOARD_PRESETS: readonly PegboardPreset[] = [
  DEFAULT_PEGBOARD,
  {
    id: PegboardPresetId.Medium48x36,
    labelKey: PegboardPresetLabelKey.Medium,
    width: 48,
    height: 36
  },
  {
    id: PegboardPresetId.Large84x63,
    labelKey: PegboardPresetLabelKey.Large,
    width: 84,
    height: 63
  }
];

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

