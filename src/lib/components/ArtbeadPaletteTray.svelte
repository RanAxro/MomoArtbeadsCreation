<script lang="ts">
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import CustomPaletteColorDialog from '$lib/components/CustomPaletteColorDialog.svelte';
  import CustomPaletteSchemeSelect from '$lib/components/CustomPaletteSchemeSelect.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { ARTBEAD_CATALOG, createArtbeadCode } from '$domain/palette';
  import { hexToRgb } from '$domain/color';
  import { customPaletteRepository } from '$data/custom-palette-repository';
  import {
    ARTBEAD_COLOR_COUNT,
    ARTBEAD_COLOR_FAMILIES,
    DEFAULT_ARTBEAD_FAMILY_CODE,
    DEFAULT_ARTBEAD_TRAY_TAB,
    GLOBAL_ARTBEAD_CATEGORY_ID,
    GLOBAL_ARTBEAD_COLORS,
    ArtbeadTrayTab,
    type ArtbeadColorFamily
  } from '$model/artbead-palette.model';
  import type { CustomPaletteScheme } from '$model/custom-palette.model';
  import { IconName } from '$model/icon.model';
  import type { BeadPalette } from '$model/palette.model';

  interface Props {
    palette: BeadPalette;
    selectedColorIndex: number;
    usage: readonly number[];
    onselect: (code: string, hex: string) => void;
  }

  let {
    palette,
    selectedColorIndex,
    usage,
    onselect
  }: Props = $props();
  const catalogByCode = new Map(
    ARTBEAD_CATALOG.map((color) => [color.code, color])
  );
  let activeTab = $state<ArtbeadTrayTab>(DEFAULT_ARTBEAD_TRAY_TAB);
  let activeCategoryId = $state(DEFAULT_ARTBEAD_FAMILY_CODE);
  let customPalettes = $state<CustomPaletteScheme[]>([]);
  let activeCustomPaletteId = $state<string | null>(null);
  let customPalettesLoading = $state(true);
  let creatingCustomPalette = $state(false);
  let customPaletteDialogOpen = $state(false);
  let customPaletteError = $state('');
  let customPaletteSaveQueue = Promise.resolve();

  let selectedColor = $derived(palette.colors[selectedColorIndex - 1]);
  let selectedCode = $derived(
    ARTBEAD_CATALOG.find((color) => color.code === selectedColor?.code)?.code ??
      ARTBEAD_CATALOG.find(
        (color) => color.hex === selectedColor?.hex.toUpperCase()
      )?.code ??
      selectedColor?.code
  );
  let activeFamily = $derived(
    ARTBEAD_COLOR_FAMILIES.find(
      (family) => family.code === activeCategoryId
    ) ?? ARTBEAD_COLOR_FAMILIES[0]
  );
  let globalActive = $derived(
    activeCategoryId === GLOBAL_ARTBEAD_CATEGORY_ID
  );
  let activePalettes = $derived.by(() => {
    if (globalActive) {
      return [
        {
          number: 1,
          colors: GLOBAL_ARTBEAD_COLORS.map((color) => ({
            code: String(color.number),
            hex: color.hex
          }))
        }
      ];
    }

    return activeFamily.palettes.map((colors, paletteIndex) => ({
      number: paletteIndex + 1,
      colors: colors.map((hex, cellIndex) => ({
        code: createArtbeadCode(
          activeFamily.code,
          paletteIndex + 1,
          cellIndex + 1
        ),
        hex
      }))
    }));
  });
  let activeCustomPalette = $derived(
    customPalettes.find((scheme) => scheme.id === activeCustomPaletteId)
  );
  let activeCustomPaletteColors = $derived.by(() =>
    (activeCustomPalette?.colorCodes ?? []).flatMap((code) => {
      const color = catalogByCode.get(code);
      return color ? [color] : [];
    })
  );

  function relativeLuminance(hex: string): number {
    const { r, g, b } = hexToRgb(hex);
    const channels = [r, g, b].map((channel) => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }

  function familyLabelColor(family: ArtbeadColorFamily): string {
    const background = family.palettes[0][0];
    const backgroundLuminance = relativeLuminance(background);
    const colors = family.palettes.flat();
    return colors.reduce((best, candidate) => {
      const luminance = relativeLuminance(candidate);
      const bestLuminance = relativeLuminance(best);
      const contrast =
        (Math.max(luminance, backgroundLuminance) + 0.05) /
        (Math.min(luminance, backgroundLuminance) + 0.05);
      const bestContrast =
        (Math.max(bestLuminance, backgroundLuminance) + 0.05) /
        (Math.min(bestLuminance, backgroundLuminance) + 0.05);
      return contrast > bestContrast ? candidate : best;
    }, colors[0]);
  }

  async function loadCustomPalettes(): Promise<void> {
    customPalettesLoading = true;
    customPaletteError = '';
    try {
      customPalettes = await customPaletteRepository.list();
      if (customPalettes.length === 0) {
        const defaultPalette = await customPaletteRepository.create(
          $_('tray.defaultPaletteName')
        );
        customPalettes = [defaultPalette];
      }
      if (
        !activeCustomPaletteId ||
        !customPalettes.some(
          (scheme) => scheme.id === activeCustomPaletteId
        )
      ) {
        activeCustomPaletteId = customPalettes[0]?.id ?? null;
      }
    } catch {
      customPaletteError = $_('tray.paletteSchemeLoadError');
    } finally {
      customPalettesLoading = false;
    }
  }

  async function createBlankCustomPalette(): Promise<void> {
    if (creatingCustomPalette) {
      return;
    }

    creatingCustomPalette = true;
    customPaletteError = '';
    try {
      const name = $_('tray.unnamedPalette', {
        values: { number: customPalettes.length + 1 }
      });
      const scheme = await customPaletteRepository.create(name);
      customPalettes = [scheme, ...customPalettes];
      activeCustomPaletteId = scheme.id;
    } catch {
      customPaletteError = $_('tray.paletteSchemeCreateError');
    } finally {
      creatingCustomPalette = false;
    }
  }

  async function renameCustomPalette(id: string, name: string): Promise<void> {
    await customPaletteSaveQueue.catch(() => undefined);
    await customPaletteRepository.rename(id, name);
    const renamedAt = new Date().toISOString();
    customPalettes = customPalettes
      .map((scheme) =>
        scheme.id === id
          ? { ...scheme, name, updatedAt: renamedAt }
          : scheme
      )
      .sort((first, second) =>
        second.updatedAt.localeCompare(first.updatedAt)
      );
  }

  async function deleteCustomPalette(id: string): Promise<void> {
    await customPaletteSaveQueue.catch(() => undefined);
    await customPaletteRepository.remove(id);
    let remaining = await customPaletteRepository.list();
    if (remaining.length === 0) {
      remaining = [
        await customPaletteRepository.create($_('tray.defaultPaletteName'))
      ];
    }

    customPalettes = remaining;
    if (activeCustomPaletteId === id) {
      activeCustomPaletteId = remaining[0]?.id ?? null;
      customPaletteDialogOpen = false;
    }
  }

  function queueCustomPaletteSave(scheme: CustomPaletteScheme): void {
    const snapshot: CustomPaletteScheme = {
      ...scheme,
      colorCodes: [...scheme.colorCodes]
    };
    customPaletteSaveQueue = customPaletteSaveQueue
      .then(() => customPaletteRepository.save(snapshot))
      .catch(() => {
        customPaletteError = $_('tray.paletteSchemeSaveError');
      });
  }

  function toggleCustomPaletteColor(code: string): void {
    const scheme = activeCustomPalette;
    if (!scheme) {
      return;
    }

    const selected = scheme.colorCodes.includes(code);
    const colorCodes = selected
      ? scheme.colorCodes.filter((candidate) => candidate !== code)
      : [...scheme.colorCodes, code];
    const updated: CustomPaletteScheme = {
      ...scheme,
      colorCodes,
      updatedAt: new Date().toISOString()
    };

    customPalettes = [
      updated,
      ...customPalettes.filter((candidate) => candidate.id !== updated.id)
    ].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
    customPaletteError = '';
    queueCustomPaletteSave(updated);
  }

  onMount(() => {
    void loadCustomPalettes();
  });
</script>

<aside class="artbead-tray" aria-label={$_('tray.title')}>
  <div class="tray-heading">
    <div>
      <p class="eyebrow">{$_('tray.english')}</p>
      <h2>{$_('tray.title')}</h2>
    </div>
    <span class="tray-count">
      {$_('tray.count', { values: { count: ARTBEAD_COLOR_COUNT } })}
    </span>
  </div>

  <div class="tray-navigation">
    <div class="tray-tabs" role="tablist" aria-label={$_('tray.tabsLabel')}>
      <button
        class:active={activeTab === ArtbeadTrayTab.Scheme}
        type="button"
        role="tab"
        id="artbead-tray-tab-scheme"
        aria-controls="artbead-tray-panel-scheme"
        aria-selected={activeTab === ArtbeadTrayTab.Scheme}
        onclick={() => (activeTab = ArtbeadTrayTab.Scheme)}
      >
        {$_('tray.schemeTab')}
      </button>
      <button
        class:active={activeTab === ArtbeadTrayTab.Complete}
        type="button"
        role="tab"
        id="artbead-tray-tab-complete"
        aria-controls="artbead-tray-panel-complete"
        aria-selected={activeTab === ArtbeadTrayTab.Complete}
        onclick={() => (activeTab = ArtbeadTrayTab.Complete)}
      >
        {$_('tray.completeTab')}
      </button>
    </div>

    {#if activeTab === ArtbeadTrayTab.Scheme}
      <CustomPaletteSchemeSelect
        schemes={customPalettes}
        selectedId={activeCustomPaletteId}
        disabled={customPalettesLoading || creatingCustomPalette}
        onadd={createBlankCustomPalette}
        onselect={(id) => (activeCustomPaletteId = id)}
        onrename={renameCustomPalette}
        ondelete={deleteCustomPalette}
      />
    {/if}
  </div>

  {#if activeTab === ArtbeadTrayTab.Scheme}
    <div
      class="tray-panel custom-palette-panel"
      id="artbead-tray-panel-scheme"
      role="tabpanel"
      aria-labelledby="artbead-tray-tab-scheme"
    >
      {#if customPaletteError}
        <p class="custom-palette-error" role="alert">
          {customPaletteError}
        </p>
      {/if}

      {#if activeCustomPalette}
        <div class="custom-palette-grid">
          {#each activeCustomPaletteColors as color (color.code)}
            <button
              class="custom-palette-color"
              type="button"
              aria-label={`${color.code} ${color.hex}`}
              title={`${color.code} · ${color.hex}`}
              onclick={() => onselect(color.code, color.hex)}
            >
              <span style:--color={color.hex}></span>
            </button>
          {/each}
          <button
            class="custom-palette-add"
            type="button"
            aria-label={$_('tray.addColor')}
            title={$_('tray.addColor')}
            onclick={() => {
              customPaletteError = '';
              customPaletteDialogOpen = true;
            }}
          >
            <Icon name={IconName.Plus} size={18} />
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div
      class="tray-panel palette-browser"
      id="artbead-tray-panel-complete"
      role="tabpanel"
      aria-labelledby="artbead-tray-tab-complete"
    >
      <nav class="family-list" aria-label={$_('tray.familiesLabel')}>
        <button
          class="family-button global-family-button"
          class:active={globalActive}
          type="button"
          aria-label={$_('tray.globalColors')}
          aria-pressed={globalActive}
          title={$_('tray.globalColors')}
          onclick={() => (activeCategoryId = GLOBAL_ARTBEAD_CATEGORY_ID)}
        >
          <span
            class="family-swatch global-family-swatch"
            aria-hidden="true"
          ></span>
        </button>
        {#each ARTBEAD_COLOR_FAMILIES as family (family.code)}
          <button
            class="family-button"
            class:active={family.code === activeCategoryId}
            type="button"
            aria-label={`${family.code} ${$_(family.labelKey)}`}
            aria-pressed={family.code === activeCategoryId}
            title={family.code}
            onclick={() => (activeCategoryId = family.code)}
          >
            <span
              class="family-swatch"
              style:--color={family.palettes[0][0]}
              style:--label-color={familyLabelColor(family)}
              aria-hidden="true"
            >
              {family.code}
            </span>
          </button>
        {/each}
      </nav>

      <div class="family-palettes">
        {#each activePalettes as paletteGroup (paletteGroup.number)}
          <section class="palette-group">
            <div class="palette-grid">
              {#each paletteGroup.colors as color (color.code)}
                <button
                  class="palette-color"
                  class:active={selectedCode === color.code}
                  type="button"
                  aria-label={`${color.code} ${color.hex}`}
                  aria-pressed={selectedCode === color.code}
                  title={`${color.code} · ${color.hex}`}
                  onclick={() => onselect(color.code, color.hex)}
                >
                  <span
                    class="palette-swatch"
                    style:--color={color.hex}
                  ></span>
                  <small>{color.code}</small>
                </button>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    </div>
  {/if}

  {#if selectedColor}
    <div class="selected-color">
      <span
        class="selected-swatch"
        style:--color={selectedColor.hex}
      ></span>
      <div class="selected-color-info">
        <small>{$_('tray.selected')}</small>
        <strong>{selectedColor.code} · {selectedColor.hex}</strong>
      </div>
      <span class="selected-usage">{usage[selectedColorIndex] ?? 0}</span>
    </div>
  {/if}
</aside>

<CustomPaletteColorDialog
  open={customPaletteDialogOpen}
  colors={ARTBEAD_CATALOG}
  selectedCodes={activeCustomPalette?.colorCodes ?? []}
  ontoggle={toggleCustomPaletteColor}
  onclose={() => (customPaletteDialogOpen = false)}
/>

<style>
  .artbead-tray {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    gap: 14px;
    min-height: 0;
    padding: 18px 14px;
    overflow: hidden;
    border-right: 1px solid var(--border);
    background: var(--surface);
  }

  .tray-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 12px;
  }

  .tray-heading .eyebrow {
    margin-bottom: 5px;
    font-size: 0.58rem;
  }

  .tray-heading h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .tray-count {
    max-width: 86px;
    color: var(--muted);
    font-size: 0.62rem;
    line-height: 1.35;
    text-align: right;
  }

  .tray-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid var(--border);
  }

  .tray-navigation {
    display: grid;
    gap: 9px;
  }

  .tray-tabs button {
    position: relative;
    padding: 8px 4px 9px;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 0.76rem;
    cursor: pointer;
  }

  .tray-tabs button::after {
    position: absolute;
    right: 9px;
    bottom: -1px;
    left: 9px;
    height: 2px;
    background: transparent;
    content: '';
  }

  .tray-tabs button:hover {
    color: var(--text);
  }

  .tray-tabs button.active {
    color: var(--text);
    font-weight: 600;
  }

  .tray-tabs button.active::after {
    background: var(--text);
  }

  .tray-panel {
    min-height: 0;
    overflow: hidden;
  }

  .custom-palette-panel {
    display: grid;
    align-content: start;
    gap: 8px;
    overflow-y: auto;
    padding: 2px;
  }

  .custom-palette-error {
    margin: 0;
    color: var(--danger, #b42318);
    font-size: 0.68rem;
    line-height: 1.45;
  }

  .custom-palette-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-content: start;
    gap: 8px;
  }

  .custom-palette-color,
  .custom-palette-add {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    padding: 4px;
    border: 1px solid transparent;
    border-radius: 2px;
    background: transparent;
    cursor: pointer;
  }

  .custom-palette-color {
    border-color: var(--border);
  }

  .custom-palette-color:hover,
  .custom-palette-add:hover {
    border-color: var(--border-strong);
  }

  .custom-palette-color > span {
    display: block;
    width: 100%;
    height: 100%;
    border: 1px solid rgba(0, 0, 0, 0.13);
    background: var(--color);
  }

  .custom-palette-add {
    border-color: var(--border-strong);
    background: var(--surface);
    color: var(--text);
  }

  .palette-browser {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 9px;
  }

  .family-list {
    display: grid;
    align-content: start;
    gap: 4px;
    min-height: 0;
    overflow-y: auto;
    padding-right: 1px;
  }

  .family-button {
    display: grid;
    place-items: center;
    min-height: 38px;
    padding: 4px;
    border: 1px solid transparent;
    border-radius: 2px;
    background: transparent;
    cursor: pointer;
  }

  .family-button:hover {
    border-color: var(--border);
    color: var(--text);
  }

  .family-button.active {
    border-color: var(--border-strong);
    background: var(--surface-raised, var(--surface));
  }

  .family-swatch {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 1px solid rgba(0, 0, 0, 0.18);
    border-radius: 50%;
    background: var(--color);
    color: var(--label-color);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
  }

  .global-family-swatch {
    border-color: var(--border-strong);
    background: var(--text);
  }

  .family-palettes {
    display: grid;
    align-content: start;
    gap: 9px;
    min-height: 0;
    overflow-y: auto;
    padding: 0 2px 4px 0;
  }

  .palette-group {
    display: grid;
    gap: 6px;
    padding: 7px;
    border: 1px solid var(--border);
    border-radius: 2px;
  }

  .palette-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 5px;
  }

  .palette-color {
    display: grid;
    gap: 3px;
    min-width: 0;
    padding: 3px;
    border: 1px solid transparent;
    border-radius: 2px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .palette-color:hover {
    border-color: var(--border-strong);
    color: var(--text);
  }

  .palette-color.active {
    border-color: var(--text);
    color: var(--text);
  }

  .palette-swatch {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    border: 1px solid rgba(0, 0, 0, 0.13);
    background: var(--color);
  }

  .palette-color small {
    overflow: hidden;
    font-size: 0.52rem;
    line-height: 1;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selected-color {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }

  .selected-swatch {
    width: 42px;
    height: 42px;
    border: 1px solid var(--border-strong);
    background: var(--color);
  }

  .selected-color-info {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .selected-color small {
    color: var(--muted);
    font-size: 0.62rem;
  }

  .selected-color strong {
    overflow: hidden;
    font-size: 0.72rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selected-usage {
    color: var(--muted);
    font-size: 0.72rem;
  }

  @media (max-width: 680px) {
    .artbead-tray {
      grid-template-rows: auto minmax(0, 1fr);
      max-height: 250px;
      padding: 8px 10px;
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }

    .tray-heading,
    .selected-color {
      display: none;
    }

    .tray-tabs {
      align-self: start;
    }

    .custom-palette-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .palette-browser {
      grid-template-columns: 42px minmax(0, 1fr);
    }

    .family-button {
      min-height: 36px;
    }
  }
</style>
