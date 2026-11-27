<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Icon from '$lib/components/Icon.svelte';
  import { IconName } from '$model/icon.model';

  interface CatalogColor {
    code: string;
    hex: string;
  }

  interface Props {
    open: boolean;
    colors: readonly CatalogColor[];
    selectedCodes: readonly string[];
    ontoggle: (code: string) => void;
    onclose: () => void;
  }

  let { open, colors, selectedCodes, ontoggle, onclose }: Props = $props();
  let selected = $derived(new Set(selectedCodes));
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

    <div class="catalog-grid">
      {#each colors as color (color.code)}
        <button
          class="catalog-color"
          class:selected={selected.has(color.code)}
          type="button"
          aria-label={`${color.code} ${color.hex}`}
          aria-pressed={selected.has(color.code)}
          title={`${color.code} · ${color.hex}`}
          onclick={() => ontoggle(color.code)}
        >
          <span
            class="catalog-swatch"
            style:--color={color.hex}
          >
            {#if selected.has(color.code)}
              <span class="selected-mark" aria-hidden="true">✓</span>
            {/if}
          </span>
          <small>{color.code}</small>
        </button>
      {/each}
    </div>

    <footer class="dialog-footer">
      <span>
        {$_('tray.selectedColorCount', {
          values: { count: selectedCodes.length }
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

  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(54px, 1fr));
    align-content: start;
    gap: 8px;
    min-height: 0;
    overflow-y: auto;
    padding: 2px 4px 2px 2px;
  }

  .catalog-color {
    display: grid;
    gap: 4px;
    min-width: 0;
    padding: 4px;
    border: 1px solid transparent;
    border-radius: 2px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .catalog-color:hover {
    border-color: var(--border-strong);
    color: var(--text);
  }

  .catalog-color.selected {
    border-color: var(--text);
    background: var(--hover);
    color: var(--text);
  }

  .catalog-swatch {
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

  .catalog-color small {
    overflow: hidden;
    font-size: 0.58rem;
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

    .catalog-grid {
      grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));
      gap: 6px;
    }
  }
</style>
