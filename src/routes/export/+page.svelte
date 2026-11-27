<script lang="ts">
  import { goto } from '$app/navigation';
  import { onDestroy, onMount, tick } from 'svelte';
  import { _, locale } from 'svelte-i18n';
  import Icon from '$lib/components/Icon.svelte';
  import { requiredArtbeadUsage } from '$domain/project';
  import {
    DRAWING_EXPORT_AUTHOR_STORAGE_KEY,
    DRAWING_EXPORT_PREVIEW_MAX_DIMENSION,
    MAX_DRAWING_EXPORT_AUTHOR_LENGTH,
    createDrawingExportFilename,
    type DrawingExportSettings
  } from '$model/drawing-export.model';
  import { IconName } from '$model/icon.model';
  import { findPegboardPreset } from '$model/pegboard.model';
  import {
    BoardBackground,
    MAX_COARSE_GRID_SPACING,
    MIN_COARSE_GRID_SPACING
  } from '$model/view.model';
  import {
    renderDrawingSheet,
    type DrawingSheetLabels
  } from '$modules/export/drawing-export';
  import { viewStore } from '$modules/view/view-store.svelte';
  import { workspace } from '$modules/workspace/workspace.svelte';

  const PREVIEW_RENDER_DELAY_MS = 90;
  const DOWNLOAD_NOTICE_DURATION_MS = 2600;

  function readStoredAuthor(): string {
    if (typeof window === 'undefined') {
      return '';
    }
    return (
      window.localStorage
        .getItem(DRAWING_EXPORT_AUTHOR_STORAGE_KEY)
        ?.slice(0, MAX_DRAWING_EXPORT_AUTHOR_LENGTH) ?? ''
    );
  }

  const editor = workspace.editor;
  let ready = $state(false);
  let previewCanvas: HTMLCanvasElement | undefined = $state();
  let showRulers = $state(viewStore.showRulers);
  let showGrid = $state(viewStore.showGrid);
  let showCoarseGrid = $state(viewStore.showCoarseGrid);
  let coarseGridSpacing = $state(viewStore.coarseGridSpacing);
  let background = $state<BoardBackground>(viewStore.background);
  let author = $state(readStoredAuthor());
  let previewSize = $state('');
  let previewError = $state('');
  let exporting = $state(false);
  let exportMessage = $state('');
  let exportMessageIsError = $state(false);
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let exportMessageTimer: ReturnType<typeof setTimeout> | undefined;
  let previewRenderRequest = 0;

  let colors = $derived.by(() => {
    editor.revision;
    return editor.project ? requiredArtbeadUsage(editor.project) : [];
  });
  let totalBeads = $derived.by(() =>
    colors.reduce((total, color) => total + color.count, 0)
  );

  function currentSettings(): DrawingExportSettings {
    return {
      showRulers,
      showGrid,
      showCoarseGrid,
      coarseGridSpacing,
      background
    };
  }

  function drawingLabels(): DrawingSheetLabels {
    const project = editor.project;
    if (!project) {
      throw new Error('No active scheme.');
    }
    const boardSize = `${project.width}x${project.height}`;
    const preset = findPegboardPreset(project.width, project.height);

    return {
      authorPrefix: $_('drawingExport.authorPrefix'),
      boardSizeValue: preset
        ? $_('drawingExport.boardSizeWithPreset', {
            values: {
              preset: $_(preset.labelKey),
              size: boardSize
            }
          })
        : boardSize,
      legendTitle: $_('drawingExport.legendTitle'),
      emptyLegend: $_('drawingExport.emptyLegend')
    };
  }

  function updateAuthor(value: string): void {
    author = value.slice(0, MAX_DRAWING_EXPORT_AUTHOR_LENGTH);
    try {
      window.localStorage.setItem(
        DRAWING_EXPORT_AUTHOR_STORAGE_KEY,
        author
      );
    } catch {
      // The input remains usable when storage is unavailable.
    }
  }

  function schedulePreviewRender(): void {
    if (previewTimer) {
      clearTimeout(previewTimer);
    }
    previewTimer = setTimeout(() => {
      previewTimer = undefined;
      void renderPreview();
    }, PREVIEW_RENDER_DELAY_MS);
  }

  async function renderPreview(): Promise<void> {
    await tick();
    const canvas = previewCanvas;
    const project = editor.project;
    if (!canvas || !project) {
      return;
    }

    const request = ++previewRenderRequest;
    try {
      const info = renderDrawingSheet(canvas, project, currentSettings(), {
        labels: drawingLabels(),
        author,
        maxDimension: DRAWING_EXPORT_PREVIEW_MAX_DIMENSION
      });
      if (request !== previewRenderRequest) {
        return;
      }
      previewSize = `${info.width} × ${info.height}`;
      previewError = '';
    } catch {
      if (request === previewRenderRequest) {
        previewSize = '';
        previewError = $_('drawingExport.previewError');
      }
    }
  }

  async function returnToWorkspace(): Promise<void> {
    await goto('/');
  }

  function restoreCurrentView(): void {
    showRulers = viewStore.showRulers;
    showGrid = viewStore.showGrid;
    showCoarseGrid = viewStore.showCoarseGrid;
    coarseGridSpacing = viewStore.coarseGridSpacing;
    background = viewStore.background;
  }

  function updateCoarseGridSpacing(value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }
    coarseGridSpacing = Math.max(
      MIN_COARSE_GRID_SPACING,
      Math.min(MAX_COARSE_GRID_SPACING, Math.round(value))
    );
  }

  function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('PNG encoding failed.'));
        }
      }, 'image/png');
    });
  }

  function showExportMessage(message: string, isError: boolean): void {
    if (exportMessageTimer) {
      clearTimeout(exportMessageTimer);
    }
    exportMessage = message;
    exportMessageIsError = isError;
    exportMessageTimer = setTimeout(() => {
      exportMessage = '';
      exportMessageIsError = false;
      exportMessageTimer = undefined;
    }, DOWNLOAD_NOTICE_DURATION_MS);
  }

  async function downloadDrawing(): Promise<void> {
    const project = editor.project;
    if (!project || exporting) {
      return;
    }

    exporting = true;
    exportMessage = '';
    try {
      await document.fonts.ready;
      const canvas = document.createElement('canvas');
      renderDrawingSheet(canvas, project, currentSettings(), {
        labels: drawingLabels(),
        author
      });
      const blob = await canvasToBlob(canvas);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = createDrawingExportFilename(
        project.name,
        $_('drawingExport.filenameSuffix')
      );
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showExportMessage($_('drawingExport.exportSuccess'), false);
    } catch {
      showExportMessage($_('drawingExport.exportError'), true);
    } finally {
      exporting = false;
    }
  }

  $effect(() => {
    editor.revision;
    showRulers;
    showGrid;
    showCoarseGrid;
    coarseGridSpacing;
    background;
    author;
    $locale;
    if (ready && previewCanvas && editor.project) {
      schedulePreviewRender();
    }
  });

  onMount(() => {
    void (async () => {
      await workspace.initialize();
      if (!editor.project) {
        await goto('/');
        return;
      }
      ready = true;
      await tick();
      void renderPreview();
    })();
    return () => {
      if (previewTimer) {
        clearTimeout(previewTimer);
      }
      if (exportMessageTimer) {
        clearTimeout(exportMessageTimer);
      }
    };
  });

  onDestroy(() => {
    previewRenderRequest += 1;
  });
</script>

<svelte:head>
  <title>
    {$_('drawingExport.title')} · {editor.project?.name ?? $_('app.name')}
  </title>
</svelte:head>

<div class="export-page">
  {#if ready && editor.project}
    <header class="export-header">
      <div class="export-heading">
        <p class="eyebrow">{$_('drawingExport.eyebrow')}</p>
        <h1>{$_('drawingExport.title')}</h1>
      </div>
      <div class="export-summary">
        <strong>{editor.project.name}</strong>
        <span>
          {$_('board.size', {
            values: {
              width: editor.project.width,
              height: editor.project.height
            }
          })}
          ·
          {$_('drawingExport.colorCount', {
            values: { count: colors.length }
          })}
          ·
          {$_('drawingExport.totalBeads', {
            values: { count: totalBeads }
          })}
        </span>
      </div>
      <button
        class="button ghost compact"
        type="button"
        onclick={() => void returnToWorkspace()}
      >
        <Icon name={IconName.ArrowLeft} size={16} />
        {$_('drawingExport.back')}
      </button>
    </header>

    <main class="export-layout">
      <section class="preview-panel" aria-labelledby="drawing-preview-title">
        <div class="panel-heading">
          <div>
            <span class="panel-index">01</span>
            <h2 id="drawing-preview-title">
              {$_('drawingExport.preview')}
            </h2>
          </div>
          {#if previewSize}
            <span class="preview-size">{previewSize} px</span>
          {/if}
        </div>

        <div class="preview-stage">
          <canvas
            class:invisible={Boolean(previewError)}
            bind:this={previewCanvas}
            aria-label={$_('drawingExport.preview')}
          ></canvas>
          {#if !previewSize && !previewError}
            <p class="preview-status">{$_('drawingExport.previewLoading')}</p>
          {:else if previewError}
            <p class="preview-status error" role="alert">{previewError}</p>
          {/if}
        </div>
      </section>

      <aside class="settings-panel" aria-labelledby="drawing-settings-title">
        <div class="settings-intro">
          <span class="panel-index">02</span>
          <h2 id="drawing-settings-title">
            {$_('drawingExport.settings')}
          </h2>
          <p>{$_('drawingExport.description')}</p>
        </div>

        <form
          class="drawing-settings"
          onsubmit={(event) => {
            event.preventDefault();
            void downloadDrawing();
          }}
        >
          <label class="field-label author-field" for="drawing-export-author">
            <span>{$_('drawingExport.author')}</span>
            <input
              id="drawing-export-author"
              class="field"
              type="text"
              maxlength={MAX_DRAWING_EXPORT_AUTHOR_LENGTH}
              autocomplete="name"
              value={author}
              placeholder={$_('drawingExport.author')}
              oninput={(event) => updateAuthor(event.currentTarget.value)}
            />
            <small>{$_('drawingExport.authorHint')}</small>
          </label>

          <div class="setting-stack">
            <label class="view-switch">
              <span>
                <strong>{$_('drawingExport.showRulers')}</strong>
                <small>{$_('view.rulersHint')}</small>
              </span>
              <span class="switch-control">
                <input
                  type="checkbox"
                  checked={showRulers}
                  onchange={(event) => {
                    showRulers = event.currentTarget.checked;
                  }}
                />
                <span class="switch-track" aria-hidden="true"></span>
              </span>
            </label>

            <label class="view-switch">
              <span>
                <strong>{$_('drawingExport.showGrid')}</strong>
                <small>{$_('view.gridHint')}</small>
              </span>
              <span class="switch-control">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onchange={(event) => {
                    showGrid = event.currentTarget.checked;
                  }}
                />
                <span class="switch-track" aria-hidden="true"></span>
              </span>
            </label>

            <label class="view-switch">
              <span>
                <strong>{$_('drawingExport.showCoarseGrid')}</strong>
                <small>{$_('view.coarseGridHint')}</small>
              </span>
              <span class="switch-control">
                <input
                  type="checkbox"
                  checked={showCoarseGrid}
                  onchange={(event) => {
                    showCoarseGrid = event.currentTarget.checked;
                  }}
                />
                <span class="switch-track" aria-hidden="true"></span>
              </span>
            </label>
          </div>

          {#if showCoarseGrid}
            <label class="field-label">
              <span>{$_('view.coarseGridSpacing')}</span>
              <input
                class="field"
                type="number"
                min={MIN_COARSE_GRID_SPACING}
                max={MAX_COARSE_GRID_SPACING}
                step="1"
                value={coarseGridSpacing}
                onchange={(event) =>
                  updateCoarseGridSpacing(
                    Number(event.currentTarget.value)
                  )}
              />
            </label>
          {/if}

          <label class="field-label">
            <span>{$_('drawingExport.background')}</span>
            <select
              class="field"
              value={background}
              onchange={(event) => {
                background = event.currentTarget.value as BoardBackground;
              }}
            >
              <option value={BoardBackground.Solid}>
                {$_('view.solid')}
              </option>
              <option value={BoardBackground.Checker}>
                {$_('view.checker')}
              </option>
              <option value={BoardBackground.CheckerDense}>
                {$_('view.checkerDense')}
              </option>
            </select>
          </label>

          <p class="local-note">{$_('drawingExport.settingsHint')}</p>

          <div class="settings-actions">
            <button
              class="button secondary"
              type="button"
              disabled={exporting}
              onclick={restoreCurrentView}
            >
              <Icon name={IconName.Reset} size={16} />
              {$_('drawingExport.reset')}
            </button>
            <button
              class="button primary export-button"
              type="submit"
              disabled={exporting}
              aria-busy={exporting}
            >
              <Icon name={IconName.Download} size={17} />
              {exporting
                ? $_('drawingExport.exporting')
                : $_('drawingExport.exportPng')}
            </button>
          </div>

          {#if exportMessage}
            <p
              class="export-message"
              class:error={exportMessageIsError}
              role={exportMessageIsError ? 'alert' : 'status'}
            >
              {exportMessage}
            </p>
          {/if}
        </form>
      </aside>
    </main>
  {:else}
    <div class="loading-state">{$_('common.loading')}</div>
  {/if}
</div>

<style>
  .export-page {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
    min-height: 0;
    background: var(--page);
  }

  .export-header {
    display: flex;
    align-items: center;
    gap: 24px;
    min-height: 68px;
    padding: 10px 22px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .export-heading {
    display: flex;
    align-items: baseline;
    gap: 14px;
    flex: 0 0 auto;
  }

  .export-heading .eyebrow {
    margin: 0;
  }

  .export-heading h1 {
    margin: 0;
    font-size: 1.28rem;
    font-weight: 600;
  }

  .export-summary {
    display: grid;
    gap: 3px;
    min-width: 0;
    color: var(--muted);
    font-size: 0.68rem;
    line-height: 1.4;
  }

  .export-summary strong {
    overflow: hidden;
    color: var(--text);
    font-size: 0.8rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .export-summary span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .export-header .button {
    margin-left: auto;
    flex: 0 0 auto;
  }

  .export-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 344px;
    min-width: 0;
    min-height: 0;
  }

  .preview-panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    border-right: 1px solid var(--border);
  }

  .panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    min-height: 54px;
    padding: 9px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .panel-heading > div {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .panel-index {
    color: var(--muted);
    font-size: 0.62rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.1em;
  }

  .panel-heading h2,
  .settings-intro h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .preview-size {
    color: var(--muted);
    font-size: 0.64rem;
    font-variant-numeric: tabular-nums;
  }

  .preview-stage {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
    padding: 18px;
    overflow: hidden;
    background: var(--stage);
  }

  .preview-stage canvas {
    display: block;
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 100%;
    min-width: 0;
    min-height: 0;
    flex: 0 0 auto;
    background: #ffffff;
    box-shadow: var(--shadow);
  }

  .preview-stage canvas.invisible {
    visibility: hidden;
  }

  .preview-status {
    position: absolute;
    top: 50%;
    left: 50%;
    max-width: min(420px, calc(100% - 48px));
    margin: 0;
    color: var(--muted);
    font-size: 0.78rem;
    line-height: 1.6;
    text-align: center;
    transform: translate(-50%, -50%);
  }

  .preview-status.error {
    color: var(--danger);
    font-weight: 700;
  }

  .settings-panel {
    min-width: 0;
    min-height: 0;
    padding: 24px 22px 30px;
    overflow-y: auto;
    background: var(--surface);
  }

  .settings-intro {
    display: grid;
    gap: 8px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }

  .settings-intro .panel-index {
    margin-bottom: -2px;
  }

  .settings-intro p {
    margin: 0;
    color: var(--muted);
    font-size: 0.76rem;
    line-height: 1.65;
  }

  .drawing-settings {
    display: grid;
    gap: 20px;
    padding-top: 20px;
  }

  .setting-stack {
    display: grid;
    border-top: 1px solid var(--border);
  }

  .view-switch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 13px 0;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
  }

  .view-switch > span:first-child {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .view-switch strong {
    color: var(--text);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .view-switch small {
    color: var(--muted);
    font-size: 0.68rem;
    font-weight: 400;
    line-height: 1.45;
  }

  .switch-control {
    position: relative;
    width: 36px;
    height: 20px;
    flex: 0 0 auto;
  }

  .switch-control input {
    position: absolute;
    z-index: 1;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .switch-track {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: var(--border-strong);
    transition: background 140ms ease;
  }

  .switch-track::after {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--surface);
    content: "";
    transition: transform 140ms ease;
  }

  .switch-control input:checked + .switch-track {
    background: var(--text);
  }

  .switch-control input:checked + .switch-track::after {
    transform: translateX(16px);
  }

  .switch-control input:focus-visible + .switch-track {
    outline: 2px solid var(--text);
    outline-offset: 2px;
  }

  .drawing-settings .field {
    cursor: pointer;
  }

  .drawing-settings input[type="number"].field,
  .drawing-settings input[type="text"].field {
    cursor: text;
  }

  .author-field small {
    color: var(--muted);
    font-size: 0.66rem;
    font-weight: 400;
    line-height: 1.5;
  }

  .local-note {
    margin: 0;
    padding: 12px;
    border-left: 2px solid var(--text);
    background: var(--hover);
    color: var(--muted);
    font-size: 0.7rem;
    line-height: 1.6;
  }

  .settings-actions {
    display: grid;
    gap: 8px;
  }

  .settings-actions .button {
    width: 100%;
  }

  .export-button {
    min-height: 46px;
  }

  .export-message {
    margin: 0;
    color: var(--muted);
    font-size: 0.72rem;
    line-height: 1.5;
  }

  .export-message.error {
    color: var(--danger);
    font-weight: 700;
  }

  .loading-state {
    grid-row: 1 / -1;
    display: grid;
    place-items: center;
    color: var(--muted);
    font-size: 0.82rem;
  }

  @media (max-width: 980px) {
    .export-layout {
      grid-template-columns: minmax(0, 1fr) 310px;
    }

    .export-summary {
      display: none;
    }
  }

  @media (max-width: 760px) {
    .export-page {
      display: block;
      overflow-y: auto;
    }

    .export-header {
      flex-wrap: wrap;
      gap: 10px;
      padding: 10px 12px;
    }

    .export-heading {
      flex: 1 1 auto;
    }

    .export-heading .eyebrow {
      display: none;
    }

    .export-layout {
      display: block;
    }

    .preview-panel {
      min-height: 560px;
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }

    .panel-heading {
      padding: 9px 12px;
    }

    .preview-stage {
      min-height: 500px;
      padding: 10px;
    }

    .settings-panel {
      padding: 20px 12px 28px;
      overflow: visible;
    }
  }
</style>
