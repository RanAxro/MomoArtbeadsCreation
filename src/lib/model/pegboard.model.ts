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

export function findPegboardPreset(
  width: number,
  height: number
): PegboardPreset | undefined {
  return PEGBOARD_PRESETS.find(
    (preset) => preset.width === width && preset.height === height
  );
}

