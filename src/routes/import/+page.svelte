<script lang="ts">
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { _ } from 'svelte-i18n';
  import ProjectPreview from '$lib/components/ProjectPreview.svelte';
  import { DEFAULT_PEGBOARD } from '$lib/config/pegboard';
  import { createStarterPalette } from '$domain/palette';
  import { createProject, MAX_PROJECT_DIMENSION, type BeadProject } from '$domain/project';
  import {
    convertImageToPattern,
    readImageDimensions
  } from '$modules/image-import/image-to-pattern';
  import { workspace } from '$modules/workspace/workspace.svelte';

  const palette = createStarterPalette();
  let fileInput: HTMLInputElement | undefined = $state();
  let sourceFile = $state<File | null>(null);
  let sourceUrl = $state('');
  let sourceDimensions = $state({ width: 0, height: 0 });
  let schemeName = $state('');
  let width = $state(DEFAULT_PEGBOARD.width);
  let height = $state(DEFAULT_PEGBOARD.height);
  let lockAspect = $state(true);
  let previewProject = $state<BeadProject | null>(null);
  let usedColors = $state(0);
  let busy = $state(false);
  let error = $state('');

  function revokeSourceUrl(): void {
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
      sourceUrl = '';
    }
  }

  async function selectSource(event: Event): Promise<void> {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    error = '';
    previewProject = null;
    revokeSourceUrl();
    sourceFile = file;
    sourceUrl = URL.createObjectURL(file);
    schemeName = file.name.replace(/\.[^.]+$/, '') || $_('import.defaultName');

    try {
      sourceDimensions = await readImageDimensions(file);
      height = Math.max(
        1,
        Math.min(
          MAX_PROJECT_DIMENSION,
          Math.round((width * sourceDimensions.height) / sourceDimensions.width)
        )
      );
    } catch {
      error = $_('import.readError');
    }
  }

  function updateWidth(event: Event): void {
    width = Math.max(
      1,
      Math.min(MAX_PROJECT_DIMENSION, Number((event.currentTarget as HTMLInputElement).value))
    );
    if (lockAspect && sourceDimensions.width > 0) {
      height = Math.max(
        1,
        Math.min(
          MAX_PROJECT_DIMENSION,
          Math.round((width * sourceDimensions.height) / sourceDimensions.width)
        )
      );
    }
  }

  function updateHeight(event: Event): void {
    height = Math.max(
      1,
      Math.min(MAX_PROJECT_DIMENSION, Number((event.currentTarget as HTMLInputElement).value))
    );
    if (lockAspect && sourceDimensions.height > 0) {
      width = Math.max(
        1,
        Math.min(
          MAX_PROJECT_DIMENSION,
          Math.round((height * sourceDimensions.width) / sourceDimensions.height)
        )
      );
    }
  }

  async function generatePreview(): Promise<void> {
    if (!sourceFile) {
      error = $_('import.noImage');
      return;
    }

    busy = true;
    error = '';
    try {
      const project = createProject({
        name: schemeName.trim() || $_('import.defaultName'),
        width,
        height,
        palette,
        gameVersion: '3.0'
      });
      const converted = await convertImageToPattern(sourceFile, {
        width: project.width,
        height: project.height,
        palette
      });

      project.cells = converted.cells;
      previewProject = project;
      usedColors = converted.usedColors;
    } catch {
      error = $_('import.convertError');
    } finally {
      busy = false;
    }
  }

  async function saveScheme(): Promise<void> {
    if (!previewProject) {
      return;
    }

    busy = true;
    error = '';
    try {
      await workspace.initialize();
      previewProject.updatedAt = new Date().toISOString();
      await workspace.create($state.snapshot(previewProject));
      await goto('/');
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      busy = false;
    }
  }

  onDestroy(revokeSourceUrl);
</script>

<svelte:head>
  <title>{$_('import.title')} · {$_('app.name')}</title>
</svelte:head>

<div class="page-screen">
  <div class="page-shell">
    <header class="page-heading">
      <div>
        <p class="eyebrow">02 / Image to Pegboard</p>
        <h1>{$_('import.title')}</h1>
        <p>{$_('import.description')}</p>
      </div>
      <a class="button ghost compact" href="/">← {$_('import.back')}</a>
    </header>

    <div class="import-grid">
      <section class="import-settings">
        <div class="settings-section">
          <span class="section-number">01</span>
          <div class="settings-content">
            <button class="drop-zone" type="button" onclick={() => fileInput?.click()}>
              {#if sourceUrl}
                <img src={sourceUrl} alt={$_('import.preview')} />
                <span class="replace-label">{$_('import.replace')}</span>
              {:else}
                <strong>{$_('import.noFile')}</strong>
                <small>{$_('import.localHint')}</small>
              {/if}
            </button>
            <input
              bind:this={fileInput}
              class="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onchange={selectSource}
            />
            {#if sourceFile}
              <div class="file-meta">
                <span>{sourceFile.name}</span>
                <span>{sourceDimensions.width} × {sourceDimensions.height}px</span>
              </div>
            {/if}
          </div>
        </div>

        <div class="settings-section">
          <span class="section-number">02</span>
          <div class="settings-content">
            <label class="field-label">
              {$_('import.name')}
              <input
                class="field"
                bind:value={schemeName}
                maxlength="80"
                placeholder={$_('import.defaultName')}
              />
            </label>

            <div class="dimension-row">
              <label class="field-label">
                {$_('import.width')}
                <input
                  class="field"
                  type="number"
                  min="1"
                  max={MAX_PROJECT_DIMENSION}
                  value={width}
                  oninput={updateWidth}
                />
              </label>
              <button
                class="ratio-button"
                class:active={lockAspect}
                type="button"
                title={lockAspect ? $_('import.unlockRatio') : $_('import.lockRatio')}
                aria-label={lockAspect ? $_('import.unlockRatio') : $_('import.lockRatio')}
                onclick={() => { lockAspect = !lockAspect; }}
              >
                {lockAspect ? '锁' : '开'}
              </button>
              <label class="field-label">
                {$_('import.height')}
                <input
                  class="field"
                  type="number"
                  min="1"
                  max={MAX_PROJECT_DIMENSION}
                  value={height}
                  oninput={updateHeight}
                />
              </label>
            </div>

            <p class="dimension-note">
              {$_('import.dimensions', {
                values: { width, height, count: width * height }
              })}
            </p>
          </div>
        </div>

        <div class="settings-section">
          <span class="section-number">03</span>
          <div class="settings-content">
            <div class="color-strip">
              {#each palette.colors as color (color.id)}
                <span style:--color={color.hex} title={`${color.code} · ${color.hex}`}></span>
              {/each}
            </div>
            <p class="dimension-note">
              {$_('tray.count', { values: { count: palette.colors.length } })}
            </p>
          </div>
        </div>
      </section>

      <aside class="preview-panel">
        <div class="preview-heading">
          <div>
            <h2>{$_('import.preview')}</h2>
            <p>
              {#if previewProject}
                {$_('import.usedColors', { values: { count: usedColors } })}
              {:else}
                {$_('import.previewHint')}
              {/if}
            </p>
          </div>
          <span>{width} × {height}</span>
        </div>

        {#if previewProject}
          <ProjectPreview project={previewProject} label={$_('import.preview')} />
        {:else}
          <div class="preview-empty">
            <span>24 / 18</span>
            <p>{$_('import.emptyPreview')}</p>
          </div>
        {/if}

        {#if error}
          <p class="form-error" role="alert">{error}</p>
        {/if}

        <div class="preview-actions">
          <button
            class="button secondary"
            type="button"
            disabled={!sourceFile || busy}
            onclick={generatePreview}
          >
            {busy
              ? $_('import.processing')
              : previewProject
                ? $_('import.regenerate')
                : $_('import.generate')}
          </button>
          <button
            class="button primary"
            type="button"
            disabled={!previewProject || busy}
            onclick={saveScheme}
          >
            {$_('import.save')}
          </button>
        </div>
      </aside>
    </div>
  </div>
</div>

<style>
  .page-screen {
    height: 100%;
    overflow: auto;
  }

  .page-shell {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
    padding: 48px 0 72px;
  }

  .page-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 34px;
  }

  .page-heading h1 {
    margin-bottom: 12px;
    font-size: clamp(2.4rem, 6vw, 4.8rem);
    font-weight: 500;
    line-height: 0.96;
  }

  .page-heading p:not(.eyebrow) {
    max-width: 650px;
    margin-bottom: 0;
    color: var(--muted);
    line-height: 1.7;
  }

  .import-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(340px, 0.82fr);
    align-items: start;
    gap: 28px;
    border-top: 1px solid var(--text);
  }

  .import-settings {
    border-right: 1px solid var(--border);
  }

  .settings-section {
    display: grid;
    grid-template-columns: 54px minmax(0, 1fr);
    gap: 16px;
    padding: 24px 28px 24px 0;
    border-bottom: 1px solid var(--border);
  }

  .section-number {
    padding-top: 4px;
    color: var(--muted);
    font-size: 0.66rem;
    letter-spacing: 0.1em;
  }

  .settings-content {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .drop-zone {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 230px;
    padding: 20px;
    overflow: hidden;
    border: 1px dashed var(--border-strong);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
  }

  .drop-zone:hover {
    border-color: var(--text);
  }

  .drop-zone img {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .drop-zone strong {
    margin-top: 20px;
    font-weight: 600;
  }

  .drop-zone small {
    margin-top: 65px;
    color: var(--muted);
    font-size: 0.72rem;
  }

  .replace-label {
    position: absolute;
    right: 10px;
    bottom: 10px;
    padding: 6px 9px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    font-size: 0.7rem;
  }

  .file-meta {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    color: var(--muted);
    font-size: 0.7rem;
  }

  .file-meta span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dimension-row {
    display: grid;
    grid-template-columns: 1fr 42px 1fr;
    align-items: end;
    gap: 8px;
  }

  .ratio-button {
    width: 42px;
    height: 42px;
    border: 1px solid var(--border-strong);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .ratio-button.active {
    border-color: var(--text);
    background: var(--text);
    color: var(--surface);
  }

  .dimension-note {
    margin: 0;
    color: var(--muted);
    font-size: 0.72rem;
  }

  .color-strip {
    display: flex;
    flex-wrap: wrap;
    border: 1px solid var(--border-strong);
  }

  .color-strip span {
    width: 32px;
    height: 32px;
    background: var(--color);
  }

  .preview-panel {
    position: sticky;
    top: 24px;
    display: grid;
    gap: 18px;
    padding-top: 24px;
  }

  .preview-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 16px;
  }

  .preview-heading h2 {
    margin-bottom: 5px;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .preview-heading p,
  .preview-heading > span {
    margin: 0;
    color: var(--muted);
    font-size: 0.7rem;
  }

  .preview-empty {
    display: grid;
    place-items: center;
    min-height: 360px;
    border: 1px solid var(--border-strong);
    background: var(--stage);
  }

  .preview-empty span {
    color: var(--faint);
    font-size: 4rem;
    letter-spacing: -0.06em;
  }

  .preview-empty p {
    margin: -100px 0 0;
    color: var(--muted);
    font-size: 0.78rem;
  }

  .preview-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .form-error {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid var(--text);
    font-size: 0.78rem;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (max-width: 920px) {
    .import-grid {
      grid-template-columns: 1fr;
    }

    .import-settings {
      border-right: 0;
    }

    .preview-panel {
      position: static;
      border-top: 1px solid var(--border);
    }
  }

  @media (max-width: 600px) {
    .page-shell {
      width: calc(100% - 24px);
      padding-top: 30px;
    }

    .page-heading {
      display: grid;
    }

    .settings-section {
      grid-template-columns: 1fr;
      padding-right: 0;
    }

    .dimension-row {
      grid-template-columns: 1fr 42px 1fr;
    }
  }
</style>
