export enum ArtbeadTrayTab {
  Scheme = 'scheme',
  Current = 'current',
  Complete = 'complete'
}

export interface ArtbeadColorFamily {
  readonly code: string;
  readonly labelKey: string;
  readonly palettes: readonly (readonly string[])[];
}

export interface GlobalArtbeadColor {
  readonly number: number;
  readonly hex: string;
}

export const ARTBEAD_MAX_COLORS_PER_PALETTE = 8;
export const DEFAULT_ARTBEAD_TRAY_TAB = ArtbeadTrayTab.Complete;
export const DEFAULT_ARTBEAD_FAMILY_CODE = 'A';
export const GLOBAL_ARTBEAD_CATEGORY_ID = 'global';

export const GLOBAL_ARTBEAD_COLORS: readonly GlobalArtbeadColor[] = [
  { number: 1, hex: '#4F4745' },
  { number: 2, hex: '#AACAE1' },
  { number: 3, hex: '#FF9588' },
  { number: 4, hex: '#FFDB8D' },
  { number: 5, hex: '#B8CDA2' },
  { number: 6, hex: '#FEABC9' },
  { number: 7, hex: '#EBEAE8' }
];

export const GLOBAL_ARTBEAD_COLOR_COUNT = GLOBAL_ARTBEAD_COLORS.length;

export const ARTBEAD_COLOR_FAMILIES: readonly ArtbeadColorFamily[] = [
  {
    code: 'A',
    labelKey: 'tray.families.orange',
    palettes: [
      [
        '#CA966B',
        '#DC8463',
        '#FF7E59',
        '#D68147',
        '#C2784F',
        '#DC724D',
        '#9F7B5E',
        '#CA6D56'
      ],
      [
        '#D86F40',
        '#B87050',
        '#A0755A',
        '#B16D59',
        '#B46F48',
        '#CE683E',
        '#B16846',
        '#9D6745'
      ],
      ['#A25A3B', '#81392A', '#913E21', '#603323', '#B18970', '#50251B']
    ]
  },
  {
    code: 'B',
    labelKey: 'tray.families.yellow',
    palettes: [
      [
        '#FFFFA6',
        '#E9F373',
        '#FFD688',
        '#E2DE75',
        '#D6D24F',
        '#FFB66C',
        '#FFB155',
        '#C8BA4C'
      ],
      [
        '#A9BA5B',
        '#E9A840',
        '#E49B50',
        '#9FA449',
        '#9B9B59',
        '#A6864C',
        '#A48644',
        '#7F806B'
      ],
      ['#8C8145', '#89843D', '#7E6D2D', '#5E5E35', '#4F4D28', '#35330E']
    ]
  },
  {
    code: 'C',
    labelKey: 'tray.families.green',
    palettes: [
      [
        '#98D63F',
        '#8CB493',
        '#8CAB98',
        '#96C63F',
        '#8EA46C',
        '#90A856',
        '#75A693',
        '#79A481'
      ],
      [
        '#3AEF83',
        '#5AC85A',
        '#69B83E',
        '#56A993',
        '#799A44',
        '#3AD643',
        '#4EA678',
        '#26DA52'
      ],
      [
        '#4CB14C',
        '#5F9A46',
        '#649157',
        '#34AD51',
        '#708E49',
        '#3E8978',
        '#00A25E',
        '#36785B'
      ]
    ]
  },
  {
    code: 'D',
    labelKey: 'tray.families.blue',
    palettes: [
      [
        '#96F9FF',
        '#B2CCFF',
        '#65DEFF',
        '#68C2C2',
        '#9096A6',
        '#6798E9',
        '#6490B8',
        '#61919A'
      ],
      [
        '#4293E2',
        '#5986BE',
        '#479898',
        '#5781E2',
        '#0DAFD6',
        '#1AABB4',
        '#6D7BB4',
        '#229DD2'
      ],
      [
        '#4C81D6',
        '#5664D6',
        '#018E7E',
        '#15736D',
        '#435A60',
        '#2A59A6',
        '#2B4F5B',
        '#134057'
      ]
    ]
  },
  {
    code: 'E',
    labelKey: 'tray.families.purple',
    palettes: [
      [
        '#A49BCA',
        '#A47F9D',
        '#90819B',
        '#9878D6',
        '#95708E',
        '#866FC2',
        '#B25BAD',
        '#BC50B1'
      ],
      ['#B14FB6', '#9B4FBE', '#634E9D', '#4E3B95', '#573651', '#7614A0']
    ]
  },
  {
    code: 'F',
    labelKey: 'tray.families.pink',
    palettes: [
      [
        '#FF8BA2',
        '#FF69A8',
        '#C270A2',
        '#A27B95',
        '#B46F7E',
        '#D65FA9',
        '#D65FA9',
        '#9F6C81'
      ],
      ['#FF5283', '#C85476', '#D24C86', '#815F6D', '#BE276C', '#7E1448']
    ]
  },
  {
    code: 'G',
    labelKey: 'tray.families.red',
    palettes: [
      [
        '#FF9191',
        '#CE969D',
        '#B68386',
        '#FF6578',
        '#E96369',
        '#FF5768',
        '#B86767',
        '#AB6B72'
      ],
      [
        '#F55663',
        '#C66461',
        '#A86C6F',
        '#DA5A5A',
        '#D25C47',
        '#D6544E',
        '#DC504C',
        '#96635C'
      ],
      ['#A44A4D', '#832B2B', '#982626', '#CE9B96', '#501C1C', '#641616']
    ]
  }
];

export const ARTBEAD_FAMILY_COLOR_COUNT = ARTBEAD_COLOR_FAMILIES.reduce(
  (count, family) =>
    count + family.palettes.reduce((familyCount, palette) => familyCount + palette.length, 0),
  0
);

export const ARTBEAD_COLOR_COUNT =
  GLOBAL_ARTBEAD_COLOR_COUNT + ARTBEAD_FAMILY_COLOR_COUNT;
