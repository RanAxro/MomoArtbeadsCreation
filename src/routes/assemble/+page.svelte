<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import BeadCanvas from '$lib/components/BeadCanvas.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import {
    countBeads,
    requiredArtbeadUsage
  } from '$domain/project';
  import {
    MAX_BOARD_ZOOM,
    MIN_BOARD_ZOOM
  } from '$model/editor.model';
  import { IconName } from '$model/icon.model';
  import { workspace } from '$modules/workspace/workspace.svelte';

  const editor = workspace.editor;

  let ready = $state(false);
  let selectedColorIndex = $state<number | null>(null);
  let selectionProjectId = $state<string | null>(null);
  let requiredColors = $derived.by(() => {
    editor.revision;
    return editor.project ? requiredArtbeadUsage(editor.project) : [];
  });
  let beadCount = $derived.by(() => {
    editor.revision;
    return editor.project ? countBeads(editor.project) : 0;
  });

  async function returnToWorkspace(): Promise<void> {
    await goto('/');
  }

  function toggleArtbeadSelection(colorIndex: number): void {
    selectedColorIndex =
      selectedColorIndex === colorIndex ? null : colorIndex;
  }

  $effect(() => {
    const projectId = editor.project?.id ?? null;
    if (projectId !== selectionProjectId) {
      selectionProjectId = projectId;
      selectedColorIndex = null;
    }
    if (
      selectedColorIndex !== null &&
      !requiredColors.some((color) => color.colorIndex === selectedColorIndex)
    ) {
      selectedColorIndex = null;
    }
    if (ready && !editor.project) {
      void goto('/');
    }
  });

  onMount(() => {
    void (async () => {
      await workspace.initialize();
      ready = true;
      if (!editor.project) {
        await goto('/');
      }
    })();
  });
</script>

<svelte:head>
  <title>
    {editor.project?.name ?? $_('assembly.title')} · {$_('app.name')}
  </title>
</svelte:head>

<div class="assembly-page">
  {#if ready && editor.project}
    <aside class="required-tray" aria-label={$_('assembly.required')}>
      <div class="tray-heading">
        <div>
          <p class="eyebrow">{$_('assembly.english')}</p>
          <h2>{$_('assembly.required')}</h2>
        </div>
        <span class="tray-count">
          {$_('assembly.colorCount', {
            values: { count: requiredColors.length }
          })}
        </span>
      </div>

      <div class="usage-list">
        {#if requiredColors.length === 0}
          <p class="usage-empty">{$_('assembly.empty')}</p>
        {:else}
          {#each requiredColors as color (color.id)}
            <button
              class="usage-item"
              class:active={selectedColorIndex === color.colorIndex}
              type="button"
              aria-pressed={selectedColorIndex === color.colorIndex}
              onclick={() => toggleArtbeadSelection(color.colorIndex)}
            >
              <span class="usage-swatch" style:--color={color.hex}></span>
              <span class="usage-details">
                <strong>{color.code}</strong>
              </span>
              <strong class="usage-count">
                {$_('assembly.usage', {
                  values: { count: color.count }
                })}
              </strong>
            </button>
          {/each}
        {/if}
      </div>

      <div class="usage-total">
        <span>{$_('assembly.total', { values: { count: beadCount } })}</span>
        <span>{$_('board.size', {
          values: {
            width: editor.project.width,
            height: editor.project.height
          }
        })}</span>
      </div>
    </aside>

    <main class="assembly-board-area">
      <header class="assembly-header">
        <div class="assembly-title">
          <h1>{editor.project.name}</h1>
        </div>
        <div class="assembly-meta">
          <span>
            {$_('board.size', {
              values: {
                width: editor.project.width,
                height: editor.project.height
              }
            })}
          </span>
          <span>
            {$_('board.artbeads', { values: { count: beadCount } })}
          </span>
        </div>
        <button
          class="button ghost compact"
          type="button"
          onclick={() => void returnToWorkspace()}
        >
          <Icon name={IconName.ArrowLeft} size={16} />
          {$_('assembly.back')}
        </button>
      </header>

      <div class="board-surface">
        <BeadCanvas
          {editor}
          mode="assembly"
          highlightColorIndex={selectedColorIndex}
        />
      </div>

      <footer class="assembly-footer">
        <span>{$_('assembly.hint')}</span>
        <div class="zoom-control">
          <label for="assembly-zoom">{$_('board.zoom')}</label>
          <input
            id="assembly-zoom"
            type="range"
            min={MIN_BOARD_ZOOM}
            max={MAX_BOARD_ZOOM}
            step="0.05"
            value={editor.zoom}
            aria-label={$_('board.zoom')}
            oninput={(event) =>
              editor.setZoom(
                Number((event.currentTarget as HTMLInputElement).value)
              )}
          />
          <output for="assembly-zoom">
            {Math.round(editor.zoom * 100)}%
          </output>
          <button
            class="zoom-reset"
            type="button"
            title={$_('board.zoomReset')}
            aria-label={$_('board.zoomReset')}
            onclick={() => editor.setZoom(1)}
          >
            <Icon name={IconName.Reset} size={16} />
          </button>
        </div>
      </footer>
    </main>
  {:else}
    <div class="loading-state">{$_('common.loading')}</div>
  {/if}
</div>

<style>
  .assembly-page {
    display: grid;
    grid-template-columns: 288px minmax(0, 1fr);
    height: 100%;
  }

  .required-tray {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 18px;
    min-height: 0;
    padding: 20px 16px;
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
    font-size: 1.35rem;
    font-weight: 600;
  }

  .tray-count {
    color: var(--muted);
    font-size: 0.65rem;
    white-space: nowrap;
  }

  .usage-list {
    display: grid;
    align-content: start;
    gap: 6px;
    min-height: 0;
    padding: 2px;
    overflow-y: auto;
  }

  .usage-item {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 58px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 2px;
    background: var(--surface);
    color: var(--text);
    text-align: left;
    cursor: pointer;
    transition:
      border-color 120ms ease,
      background-color 120ms ease,
      box-shadow 120ms ease;
  }

  .usage-item:hover {
    border-color: var(--border-strong);
    background: var(--hover);
  }

  .usage-item.active {
    border-color: var(--text);
    background: var(--hover);
    box-shadow: inset 0 0 0 1px var(--text);
  }

  .usage-item.active .usage-swatch {
    outline: 2px solid var(--text);
    outline-offset: 2px;
  }

  .usage-swatch {
    display: block;
    width: 42px;
    height: 42px;
    border: 1px solid var(--border-strong);
    background: var(--color);
  }

  .usage-details {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .usage-details strong {
    overflow: hidden;
    font-size: 0.8rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .usage-count {
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .usage-empty {
    margin: 0;
    padding: 14px 8px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 0.78rem;
    line-height: 1.65;
  }

  .usage-total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 0.68rem;
  }

  .usage-total span:first-child {
    color: var(--text);
    font-weight: 600;
  }

  .assembly-board-area {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 0;
  }

  .assembly-header {
    display: flex;
    align-items: center;
    gap: 22px;
    min-height: 54px;
    padding: 8px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .assembly-title {
    min-width: 0;
  }

  .assembly-title h1 {
    max-width: 430px;
    margin: 0;
    overflow: hidden;
    font-size: 1.2rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .assembly-meta {
    display: flex;
    gap: 14px;
    color: var(--muted);
    font-size: 0.7rem;
    white-space: nowrap;
  }

  .assembly-header .button {
    margin-left: auto;
    flex: 0 0 auto;
  }

  .board-surface {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--stage);
  }

  .assembly-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 8px 18px;
    border-top: 1px solid var(--border);
    background: var(--surface);
    color: var(--muted);
    font-size: 0.64rem;
  }

  .assembly-footer > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .zoom-control {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
  }

  .zoom-control label {
    color: var(--muted);
  }

  .zoom-control input {
    width: 132px;
    height: 18px;
    margin: 0;
    accent-color: var(--text);
    cursor: pointer;
  }

  .zoom-control output {
    width: 34px;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .zoom-reset {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 2px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .zoom-reset:hover {
    border-color: var(--border-strong);
    background: var(--hover);
    color: var(--text);
  }

  .loading-state {
    grid-column: 1 / -1;
    display: grid;
    place-items: center;
    color: var(--muted);
    font-size: 0.82rem;
  }

  @media (max-width: 900px) {
    .assembly-page {
      grid-template-columns: 232px minmax(0, 1fr);
    }

    .assembly-meta {
      display: none;
    }
  }

  @media (max-width: 680px) {
    .assembly-page {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
      overflow: auto;
    }

    .required-tray {
      display: block;
      padding: 10px;
      overflow: visible;
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }

    .tray-heading,
    .usage-total {
      display: none;
    }

    .usage-list {
      display: flex;
      gap: 6px;
      overflow-x: auto;
    }

    .usage-item {
      grid-template-columns: 34px auto;
      flex: 0 0 auto;
      min-height: 46px;
      padding: 5px 8px 5px 5px;
    }

    .usage-swatch {
      grid-row: 1 / 3;
      width: 34px;
      height: 34px;
    }

    .usage-count {
      font-size: 0.68rem;
    }

    .usage-empty {
      border: 0;
    }

    .assembly-board-area {
      min-height: 560px;
    }

    .assembly-header {
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
    }

    .assembly-title {
      flex: 1 1 160px;
    }

    .assembly-title h1 {
      max-width: 220px;
    }

    .assembly-header .button {
      min-height: 32px;
      padding: 0 8px;
    }

    .assembly-footer {
      padding: 8px 10px;
    }

    .assembly-footer > span {
      display: none;
    }

    .zoom-control {
      width: 100%;
      justify-content: flex-end;
    }

    .zoom-control input {
      width: min(160px, 48vw);
    }
  }
</style>
