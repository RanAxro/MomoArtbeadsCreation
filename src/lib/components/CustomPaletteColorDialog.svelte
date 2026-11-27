<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Icon from '$lib/components/Icon.svelte';
  import {
    createArtbeadCode,
    normalizeHexColor
  } from '$domain/palette';
  import { hexToRgb } from '$domain/color';
  import {
    ARTBEAD_COLOR_FAMILIES,
    DEFAULT_ARTBEAD_FAMILY_CODE,
    GLOBAL_ARTBEAD_CATEGORY_ID,
    GLOBAL_ARTBEAD_COLORS,
    type ArtbeadColorFamily
  } from '$model/artbead-palette.model';
  import { IconName } from '$model/icon.model';

  interface Props {
    open: boolean;
    selectedHexes: readonly string[];
    ontoggle: (hex: string) => void;
    onclose: () => void;
  }

  let { open, selectedHexes, ontoggle, onclose }: Props = $props();
  let activeCategoryId = $state(DEFAULT_ARTBEAD_FAMILY_CODE);
  let selected = $derived(
    new Set(selectedHexes.map((hex) => normalizeHexColor(hex)))
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
        GLOBAL_ARTBEAD_COLORS.map((color) => ({
          code: String(color.number),
          hex: color.hex
        }))
      ];
    }

    return activeFamily.palettes.map((colors, paletteIndex) =>
      colors.map((hex, cellIndex) => ({
        code: createArtbeadCode(
          activeFamily.code,
          paletteIndex + 1,
          cellIndex + 1
        ),
        hex
      }))
    );
  });

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
    return family.palettes.flat().reduce((best, candidate) => {
      const luminance = relativeLuminance(candidate);
      const bestLuminance = relativeLuminance(best);
      const contrast =
        (Math.max(luminance, backgroundLuminance) + 0.05) /
        (Math.min(luminance, backgroundLuminance) + 0.05);
      const bestContrast =
        (Math.max(bestLuminance, backgroundLuminance) + 0.05) /
        (Math.min(bestLuminance, backgroundLuminance) + 0.05);
      return contrast > bestContrast ? candidate : best;
    }, family.palettes[0][0]);
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (open && event.key === 'Escape') {
      event.preventDefault();
      onclose();
    }
  }}
/>

{#if open}
  <button
    class="dialog-backdrop"
    type="button"
    aria-label={$_('tray.closeColorPicker')}
    onclick={onclose}
  ></button>
  <div
    class="custom-palette-dialog"
    role="dialog"
    aria-modal="true"
    aria-label={$_('tray.fullPalette')}
  >
    <header class="dialog-heading">
      <div>
        <span class="dialog-index">PALETTE</span>
        <h2>{$_('tray.fullPalette')}</h2>
        <p>{$_('tray.togglePaletteColorHint')}</p>
      </div>
      <button
        class="dialog-close"
        type="button"
        aria-label={$_('tray.closeColorPicker')}
        onclick={onclose}
      >
        <Icon name={IconName.Close} size={18} />
      </button>
    </header>

    <div class="palette-browser">
      <nav class="family-list" aria-label={$_('tray.familiesLabel')}>
        <button
          class="family-button"
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

      <div class="palette-list">
        {#each activePalettes as palette, paletteIndex (paletteIndex)}
          <section class="palette-group">
            <div class="palette-grid">
              {#each palette as color (color.code)}
                <button
                  class="palette-color"
                  class:selected={selected.has(normalizeHexColor(color.hex))}
                  type="button"
                  aria-label={color.code}
                  aria-pressed={selected.has(normalizeHexColor(color.hex))}
                  title={color.code}
                  onclick={() => ontoggle(color.hex)}
                >
                  <span
                    class="palette-swatch"
                    style:--color={color.hex}
                  >
                    {#if selected.has(normalizeHexColor(color.hex))}
                      <span class="selected-mark" aria-hidden="true">✓</span>
                    {/if}
                  </span>
                  <small>{color.code}</small>
                </button>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    </div>

    <footer class="dialog-footer">
      <span>
        {$_('tray.selectedColorCount', {
          values: { count: selectedHexes.length }
        })}
      </span>
      <button class="button primary" type="button" onclick={onclose}>
        {$_('tray.done')}
      </button>
    </footer>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    z-index: 70;
    inset: 0;
    border: 0;
    background: rgba(0, 0, 0, 0.38);
    cursor: default;
  }

  .custom-palette-dialog {
    --dialog-padding: 22px;
    position: fixed;
    z-index: 71;
    top: 50%;
    left: 50%;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 16px;
    width: min(860px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    padding: var(--dialog-padding);
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
    transform: translate(-50%, -50%);
  }

  .dialog-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 20px;
  }

  .dialog-heading > div {
    display: grid;
    gap: 6px;
  }

  .dialog-index {
    color: var(--muted);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
  }

  .dialog-heading h2 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 600;
  }

  .dialog-heading p {
    margin: 0;
    color: var(--muted);
    font-size: 0.74rem;
  }

  .dialog-close {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    cursor: pointer;
  }

  .dialog-close:hover {
    border-color: var(--border-strong);
    background: var(--hover);
  }

  .palette-browser {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 12px;
    min-height: 0;
    overflow: hidden;
  }

  .family-list {
    display: grid;
    align-content: start;
    gap: 5px;
    min-height: 0;
    overflow-y: auto;
    padding-right: 2px;
  }

  .family-button {
    display: grid;
    place-items: center;
    min-height: 42px;
    padding: 4px;
    border: 1px solid transparent;
    border-radius: 2px;
    background: transparent;
    cursor: pointer;
  }

  .family-button:hover {
    border-color: var(--border);
  }

  .family-button.active {
    border-color: var(--border-strong);
    background: var(--hover);
  }

  .family-swatch {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid rgba(0, 0, 0, 0.18);
    border-radius: 50%;
    background: var(--color);
    color: var(--label-color);
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1;
  }

  .global-family-swatch {
    border-color: var(--border-strong);
    background: var(--text);
  }

  .palette-list {
    display: grid;
    align-content: start;
    gap: 10px;
    min-height: 0;
    overflow-y: auto;
    padding: 2px 4px 2px 2px;
  }

  .palette-group {
    padding: 9px;
    border: 1px solid var(--border);
    border-radius: 2px;
  }

  .palette-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 50px));
    justify-content: start;
    gap: 7px;
  }

  .palette-color {
    display: grid;
    gap: 4px;
    width: 100%;
    max-width: 50px;
    min-width: 0;
    padding: 4px;
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

  .palette-color.selected {
    border-color: var(--text);
    background: var(--hover);
    color: var(--text);
  }

  .palette-swatch {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 1;
    border: 1px solid rgba(0, 0, 0, 0.13);
    background: var(--color);
  }

  .selected-mark {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    color: #111;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .palette-color small {
    overflow: hidden;
    font-size: 0.56rem;
    line-height: 1;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dialog-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }

  .dialog-footer > span {
    color: var(--muted);
    font-size: 0.72rem;
  }

  @media (max-width: 560px) {
    .custom-palette-dialog {
      --dialog-padding: 16px;
      width: calc(100vw - 20px);
      max-height: calc(100vh - 20px);
    }

    .palette-browser {
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 8px;
    }

    .family-button {
      min-height: 36px;
    }

    .family-swatch {
      width: 28px;
      height: 28px;
    }

    .palette-grid {
      gap: 5px;
    }
  }
</style>
