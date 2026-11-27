<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { ARTBEAD_CATALOG, createArtbeadCode } from '$domain/palette';
  import {
    ARTBEAD_COLOR_COUNT,
    ARTBEAD_COLOR_FAMILIES,
    DEFAULT_ARTBEAD_FAMILY_CODE,
    DEFAULT_ARTBEAD_TRAY_TAB,
    ArtbeadTrayTab
  } from '$model/artbead-palette.model';
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
  let activeTab = $state<ArtbeadTrayTab>(DEFAULT_ARTBEAD_TRAY_TAB);
  let activeFamilyCode = $state(DEFAULT_ARTBEAD_FAMILY_CODE);

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
      (family) => family.code === activeFamilyCode
    ) ?? ARTBEAD_COLOR_FAMILIES[0]
  );
  let activePalettes = $derived(
    activeFamily.palettes.map((colors, paletteIndex) => ({
      number: paletteIndex + 1,
      colors: colors.map((hex, cellIndex) => ({
        code: createArtbeadCode(
          activeFamily.code,
          paletteIndex + 1,
          cellIndex + 1
        ),
        hex
      }))
    }))
  );
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
    <div
      class="tray-panel tray-panel-empty"
      id="artbead-tray-panel-scheme"
      role="tabpanel"
      aria-labelledby="artbead-tray-tab-scheme"
    ></div>
  {:else}
    <div
      class="tray-panel palette-browser"
      id="artbead-tray-panel-complete"
      role="tabpanel"
      aria-labelledby="artbead-tray-tab-complete"
    >
      <nav class="family-list" aria-label={$_('tray.familiesLabel')}>
        {#each ARTBEAD_COLOR_FAMILIES as family (family.code)}
          <button
            class="family-button"
            class:active={family.code === activeFamily.code}
            type="button"
            aria-label={`${family.code} ${$_(family.labelKey)}`}
            aria-pressed={family.code === activeFamily.code}
            title={family.code}
            onclick={() => (activeFamilyCode = family.code)}
          >
            <span
              class="family-swatch"
              style:--color={family.palettes[0][0]}
              aria-hidden="true"
            ></span>
          </button>
        {/each}
      </nav>

      <div class="family-palettes">
        <div class="family-heading">
          <strong>{activeFamily.code} · {$_ (activeFamily.labelKey)}</strong>
          <small>
            {$_('tray.paletteCount', {
              values: { count: activeFamily.palettes.length }
            })}
          </small>
        </div>

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
    display: block;
    width: 28px;
    height: 28px;
    border: 1px solid rgba(0, 0, 0, 0.18);
    border-radius: 50%;
    background: var(--color);
  }

  .family-palettes {
    display: grid;
    align-content: start;
    gap: 9px;
    min-height: 0;
    overflow-y: auto;
    padding: 0 2px 4px 0;
  }

  .family-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    min-height: 24px;
    padding-bottom: 7px;
    border-bottom: 1px solid var(--border);
  }

  .family-heading strong {
    font-size: 0.73rem;
  }

  .family-heading small {
    color: var(--muted);
    font-size: 0.58rem;
    white-space: nowrap;
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

    .palette-browser {
      grid-template-columns: 42px minmax(0, 1fr);
    }

    .family-button {
      min-height: 36px;
    }
  }
</style>
