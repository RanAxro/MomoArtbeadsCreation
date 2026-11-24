<script lang="ts">
  import { goto } from '$app/navigation';
  import { _ } from 'svelte-i18n';
  import {
    DEFAULT_PEGBOARD,
    PEGBOARD_PRESETS
  } from '$lib/config/pegboard';
  import { createStarterPalette } from '$domain/palette';
  import { createProject } from '$domain/project';
  import { workspace } from '$modules/workspace/workspace.svelte';

  const presetLabels: Record<string, string> = {
    'default-24x18': 'new.preset.default'
  };

  const palette = createStarterPalette();
  let name = $state('');
  let selectedPegboard = $state(DEFAULT_PEGBOARD);
  let creating = $state(false);
  let error = $state('');

  function choosePreset(preset: (typeof PEGBOARD_PRESETS)[number]): void {
    selectedPegboard = preset;
  }

  async function createScheme(): Promise<void> {
    error = '';
    const schemeName = name.trim() || $_('new.defaultName');
    if (!schemeName) {
      error = $_('new.invalidName');
      return;
    }
    creating = true;
    try {
      await workspace.initialize();
      const project = createProject({
        name: schemeName,
        width: selectedPegboard.width,
        height: selectedPegboard.height,
        palette,
        gameVersion: '3.0'
      });
      await workspace.create(project);
      await goto('/');
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      creating = false;
    }
  }
</script>

<svelte:head>
  <title>{$_('new.title')} · {$_('app.name')}</title>
</svelte:head>

<div class="page-screen">
  <div class="page-shell">
    <header class="page-heading">
      <div>
        <p class="eyebrow">01 / New scheme</p>
        <h1>{$_('new.title')}</h1>
        <p>{$_('new.description')}</p>
      </div>
      <a class="button ghost compact" href="/">← {$_('new.back')}</a>
    </header>

    <form class="scheme-form" onsubmit={(event) => { event.preventDefault(); createScheme(); }}>
      <section class="form-section">
        <span class="section-number">01</span>
        <div class="section-content">
          <label class="field-label">
            {$_('new.name')}
            <input
              class="field"
              bind:value={name}
              maxlength="80"
              placeholder={$_('new.defaultName')}
            />
          </label>

          <div class="preset-section">
            <p>{$_('new.sizePreset')}</p>
            <div class="preset-grid">
              {#each PEGBOARD_PRESETS as preset}
                <button
                  class="preset"
                  class:active={selectedPegboard.id === preset.id}
                  type="button"
                  onclick={() => choosePreset(preset)}
                >
                  <span>{$_(presetLabels[preset.id] ?? 'new.preset.default')}</span>
                  <strong>{preset.width} × {preset.height}</strong>
                </button>
              {/each}
            </div>
          </div>

        </div>
      </section>

      <section class="form-section color-section">
        <span class="section-number">02</span>
        <div class="section-content">
          <div class="color-heading">
            <div>
              <h2>{$_('new.colors')}</h2>
              <p>{$_('tray.count', { values: { count: palette.colors.length } })}</p>
            </div>
            <span>{selectedPegboard.width} × {selectedPegboard.height}</span>
          </div>
          <div class="palette-grid">
            {#each palette.colors as color (color.id)}
              <div class="palette-item" title={`${color.code} · ${color.hex}`}>
                <span style:--color={color.hex}></span>
                <small>{color.code}</small>
              </div>
            {/each}
          </div>
        </div>
      </section>

      {#if error}
        <p class="form-error" role="alert">{error}</p>
      {/if}

      <div class="form-actions">
        <a class="button secondary" href="/">{$_('new.back')}</a>
        <button class="button primary" type="submit" disabled={creating}>
          {creating ? $_('new.creating') : $_('new.create')}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .page-screen {
    height: 100%;
    overflow: auto;
  }

  .page-shell {
    width: min(1040px, calc(100% - 40px));
    margin: 0 auto;
    padding: 54px 0 72px;
  }

  .page-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 38px;
  }

  .page-heading h1 {
    margin-bottom: 12px;
    font-size: clamp(2.4rem, 6vw, 5rem);
    font-weight: 500;
    line-height: 0.96;
  }

  .page-heading p:not(.eyebrow) {
    max-width: 650px;
    margin-bottom: 0;
    color: var(--muted);
    line-height: 1.7;
  }

  .scheme-form {
    border-top: 1px solid var(--text);
  }

  .form-section {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 20px;
    padding: 28px 0;
    border-bottom: 1px solid var(--border);
  }

  .section-number {
    padding-top: 4px;
    color: var(--muted);
    font-size: 0.68rem;
    letter-spacing: 0.12em;
  }

  .section-content {
    display: grid;
    gap: 24px;
  }

  .preset-section {
    display: grid;
    gap: 10px;
  }

  .preset-section > p {
    margin: 0;
    color: var(--muted);
    font-size: 0.78rem;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    max-width: 360px;
    border: 1px solid var(--border-strong);
  }

  .preset {
    display: grid;
    gap: 6px;
    min-height: 72px;
    padding: 12px;
    border: 0;
    background: transparent;
    color: var(--muted);
    text-align: left;
    cursor: pointer;
  }

  .preset + .preset {
    border-left: 1px solid var(--border-strong);
  }

  .preset span {
    font-size: 0.68rem;
  }

  .preset strong {
    color: var(--text);
    font-size: 1rem;
    font-weight: 500;
  }

  .preset:hover,
  .preset.active {
    background: var(--hover);
  }

  .preset.active {
    box-shadow: inset 0 -2px var(--text);
  }

  .color-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 20px;
  }

  .color-heading h2 {
    margin-bottom: 5px;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .color-heading p,
  .color-heading > span {
    margin: 0;
    color: var(--muted);
    font-size: 0.74rem;
  }

  .palette-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
    gap: 8px;
  }

  .palette-item {
    display: grid;
    gap: 5px;
  }

  .palette-item > span {
    display: block;
    aspect-ratio: 1;
    border: 1px solid var(--border-strong);
    background: var(--color);
  }

  .palette-item small {
    color: var(--muted);
    font-size: 0.62rem;
    text-align: center;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 24px;
  }

  .form-error {
    margin: 18px 0 0;
    padding: 10px 12px;
    border: 1px solid var(--text);
    font-size: 0.82rem;
  }

  @media (max-width: 700px) {
    .page-shell {
      width: calc(100% - 24px);
      padding-top: 32px;
    }

    .page-heading {
      display: grid;
    }

    .form-section {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .preset-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
