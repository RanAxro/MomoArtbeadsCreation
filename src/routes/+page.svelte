<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import BeadCanvas from '$lib/components/BeadCanvas.svelte';
  import { ARTBEAD_COLORS } from '$lib/config/pegboard';
  import { countBeads, countColorUsage } from '$domain/project';
  import { projectRepository } from '$data/project-repository';
  import type { EditorTool } from '$modules/editor/editor-store.svelte';
  import { workspace } from '$modules/workspace/workspace.svelte';

  const editor = workspace.editor;
  const tools: { id: EditorTool; icon: string; labelKey: string; shortcut: string }[] = [
    { id: 'pencil', icon: '✎', labelKey: 'board.pencil', shortcut: 'B' },
    { id: 'eraser', icon: '⌫', labelKey: 'board.eraser', shortcut: 'E' },
    { id: 'fill', icon: '◩', labelKey: 'board.fill', shortcut: 'G' }
  ];

  let saving = $state(false);
  let saveFailed = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  let beadCount = $derived.by(() => {
    editor.revision;
    return editor.project ? countBeads(editor.project) : 0;
  });

  let usage = $derived.by(() => {
    editor.revision;
    return editor.project ? countColorUsage(editor.project) : [];
  });

  let trayColors = $derived.by(() => {
    editor.revision;
    if (editor.project) {
      return editor.project.palette.colors.map((color) => ({
        id: color.id,
        hex: color.hex,
        code: color.code
      }));
    }

    return ARTBEAD_COLORS.map((hex, index) => ({
      id: `${hex}-${index}`,
      hex,
      code: String(index + 1).padStart(2, '0')
    }));
  });

  let selectedTrayColor = $derived(
    editor.project
      ? editor.project.palette.colors[editor.selectedColorIndex - 1]
      : undefined
  );

  let isDirty = $derived(editor.revision !== editor.savedRevision);

  async function persist(): Promise<void> {
    if (!editor.project || !isDirty) {
      return;
    }

    const revision = editor.revision;
    const snapshot = editor.toSnapshot();
    if (!snapshot) {
      return;
    }

    saving = true;
    saveFailed = false;
    try {
      await projectRepository.save(snapshot);
      editor.markSaved(revision);
    } catch {
      saveFailed = true;
    } finally {
      saving = false;
    }
  }

  function scheduleSave(): void {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      void persist();
    }, 550);
  }

  function saveNow(): void {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    void persist();
  }

  function onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, select') || target?.isContentEditable) {
      return;
    }

    const command = event.ctrlKey || event.metaKey;
    if (command && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? editor.redo() : editor.undo();
      return;
    }
    if (command && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      editor.redo();
      return;
    }
    if (command && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveNow();
      return;
    }

    const tool = tools.find(
      (candidate) => candidate.shortcut.toLowerCase() === event.key.toLowerCase()
    );
    if (tool) {
      editor.setTool(tool.id);
    }
  }

  $effect(() => {
    editor.revision;
    editor.savedRevision;
    if (editor.project && editor.revision !== editor.savedRevision) {
      scheduleSave();
    }
  });

  onMount(() => {
    void workspace.initialize();
    window.addEventListener('keydown', onKeydown);
    return () => {
      window.removeEventListener('keydown', onKeydown);
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
    };
  });

  onDestroy(() => {
    if (editor.project && editor.revision !== editor.savedRevision) {
      void workspace.saveActiveScheme();
    }
  });
</script>

<div class="workspace" class:home-only={!editor.project}>
  {#if editor.project}
    <aside class="artbead-tray" aria-label={$_('tray.title')}>
    <div class="tray-heading">
      <div>
        <p class="eyebrow">{$_('tray.english')}</p>
        <h2>{$_('tray.title')}</h2>
      </div>
      <span class="tray-count">
        {$_('tray.count', { values: { count: trayColors.length } })}
      </span>
    </div>

    <div class="color-grid" class:disabled={!editor.project}>
      {#each trayColors as color, index (color.id)}
        <button
          class="artbead"
          class:active={editor.project && editor.selectedColorIndex === index + 1}
          type="button"
          disabled={!editor.project}
          aria-label={`${color.code} ${color.hex}`}
          aria-pressed={editor.project && editor.selectedColorIndex === index + 1}
          title={`${color.code} · ${color.hex}`}
          onclick={() => editor.setSelectedColor(index + 1)}
        >
          <span class="swatch" style:--color={color.hex}></span>
        </button>
      {/each}
    </div>

    {#if selectedTrayColor}
      <div class="selected-color">
        <span class="selected-swatch" style:--color={selectedTrayColor.hex}></span>
        <div>
          <small>{$_('tray.selected')}</small>
          <strong>{selectedTrayColor.code} · {selectedTrayColor.hex}</strong>
        </div>
        <span>{usage[editor.selectedColorIndex] ?? 0}</span>
      </div>
    {:else}
      <p class="tray-empty">{$_('tray.empty')}</p>
    {/if}
    </aside>
  {/if}

  <main class="board-area">
    {#if editor.project}
      <header class="board-header">
        <div class="board-title">
          <h1>{editor.project.name}</h1>
          <div class="board-meta">
            <span>
              {$_('board.size', {
                values: { width: editor.project.width, height: editor.project.height }
              })}
            </span>
            <span>{$_('board.artbeads', { values: { count: beadCount } })}</span>
          </div>
        </div>

        <div class="board-actions">
          <div class="tools">
            {#each tools as tool}
              <button
                class="tool"
                class:active={editor.tool === tool.id}
                type="button"
                title={`${$_(tool.labelKey)} (${tool.shortcut})`}
                aria-label={$_(tool.labelKey)}
                aria-pressed={editor.tool === tool.id}
                onclick={() => editor.setTool(tool.id)}
              >
                {tool.icon}
              </button>
            {/each}
            <span class="tool-divider"></span>
            <button
              class="tool"
              type="button"
              title={$_('board.undo')}
              aria-label={$_('board.undo')}
              disabled={!editor.canUndo}
              onclick={() => editor.undo()}
            >
              ↶
            </button>
            <button
              class="tool"
              type="button"
              title={$_('board.redo')}
              aria-label={$_('board.redo')}
              disabled={!editor.canRedo}
              onclick={() => editor.redo()}
            >
              ↷
            </button>
          </div>

          <div class="save-state">
            <span class:error={saveFailed}>
              {#if saving}
                {$_('board.saving')}
              {:else if saveFailed}
                {$_('board.error')}
              {:else if isDirty}
                {$_('board.dirty')}
              {:else}
                {$_('board.saved')}
              {/if}
            </span>
            <button class="button compact secondary" type="button" onclick={saveNow}>
              {$_('board.save')}
            </button>
          </div>
        </div>
      </header>

      <div class="board-surface">
        <BeadCanvas {editor} />
      </div>

      <footer class="board-footer">
        <span>{$_('board.hint')}</span>
        <span>{editor.project.width} × {editor.project.height}</span>
      </footer>
    {:else}
      <section class="workspace-home">
        <div class="home-index" aria-hidden="true">00 / Pegboard</div>
        <h1 class="home-image">
          <img src="/home.webp" alt={$_('app.name')} width="37" height="37" />
        </h1>
        <p class="eyebrow">{$_('home.eyebrow')}</p>
        <p>{$_('home.description')}</p>
        <div class="quick-actions">
          <a class="button primary" href="/new">＋ {$_('home.new')}</a>
          <a class="button secondary" href="/import">▧ {$_('home.import')}</a>
        </div>
      </section>
    {/if}
  </main>
</div>

<style>
  .workspace {
    display: grid;
    grid-template-columns: 244px minmax(0, 1fr);
    height: 100%;
  }

  .workspace.home-only {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
  }

  .artbead-tray {
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
    margin-bottom: 0;
    font-size: 1.35rem;
    font-weight: 600;
  }

  .tray-count {
    color: var(--muted);
    font-size: 0.65rem;
    text-align: right;
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-content: start;
    gap: 8px;
    min-height: 0;
    overflow: auto;
    padding: 2px;
  }

  .color-grid.disabled {
    opacity: 0.38;
  }

  .artbead {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    padding: 4px;
    border: 1px solid transparent;
    border-radius: 2px;
    background: transparent;
    cursor: pointer;
  }

  .artbead:hover:not(:disabled) {
    border-color: var(--border-strong);
  }

  .artbead.active {
    border-color: var(--text);
  }

  .artbead:disabled {
    cursor: default;
  }

  .swatch {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 48px;
    border: 1px solid rgba(0, 0, 0, 0.13);
    background: var(--color);
  }

  .selected-color {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .selected-swatch {
    width: 42px;
    height: 42px;
    border: 1px solid var(--border-strong);
    background: var(--color);
  }

  .selected-color div {
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

  .selected-color > span:last-child {
    color: var(--muted);
    font-size: 0.72rem;
  }

  .tray-empty {
    margin: 0;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 0.75rem;
    line-height: 1.6;
  }

  .board-area {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 0;
  }

  .board-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    min-height: 54px;
    padding: 8px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .board-title {
    display: flex;
    align-items: center;
    gap: 24px;
    min-width: 0;
  }

  .board-title h1 {
    max-width: 420px;
    margin: 0;
    overflow: hidden;
    font-size: 1.2rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .board-meta {
    display: flex;
    gap: 14px;
    color: var(--muted);
    font-size: 0.72rem;
    white-space: nowrap;
  }

  .board-actions,
  .tools,
  .save-state {
    display: flex;
    align-items: center;
  }

  .board-actions {
    gap: 20px;
  }

  .tools {
    gap: 2px;
  }

  .tool {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid transparent;
    border-radius: 2px;
    background: transparent;
    color: var(--muted);
    font-size: 1rem;
    cursor: pointer;
  }

  .tool:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }

  .tool.active {
    border-color: var(--text);
    color: var(--text);
  }

  .tool:disabled {
    opacity: 0.28;
    cursor: not-allowed;
  }

  .tool-divider {
    width: 1px;
    height: 22px;
    margin: 0 4px;
    background: var(--border);
  }

  .save-state {
    gap: 10px;
  }

  .save-state > span {
    color: var(--muted);
    font-size: 0.68rem;
    white-space: nowrap;
  }

  .save-state > span.error {
    color: var(--text);
    font-weight: 700;
  }

  .board-surface {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--stage);
  }

  .board-footer {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding: 8px 18px;
    border-top: 1px solid var(--border);
    background: var(--surface);
    color: var(--muted);
    font-size: 0.64rem;
  }

  .workspace-home {
    position: relative;
    display: grid;
    justify-items: center;
    align-content: center;
    min-height: 0;
    overflow: hidden;
    padding: 40px;
    background: var(--stage);
    text-align: center;
  }

  .home-index {
    position: absolute;
    top: 20px;
    right: 24px;
    color: var(--faint);
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .home-image {
    width: 222px;
    height: 222px;
    max-width: 58vw;
    margin: 0 0 24px;
  }

  .home-image img {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
    image-rendering: pixelated;
  }

  .workspace-home > p:not(.eyebrow) {
    max-width: 580px;
    margin-bottom: 28px;
    color: var(--muted);
    line-height: 1.75;
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  @media (max-width: 900px) {
    .workspace {
      grid-template-columns: 200px minmax(0, 1fr);
    }

    .board-meta {
      display: none;
    }

    .save-state > span {
      display: none;
    }
  }

  @media (max-width: 680px) {
    .workspace {
      grid-template-columns: 1fr;
      grid-template-rows: auto minmax(0, 1fr);
      overflow: auto;
    }

    .artbead-tray {
      display: block;
      padding: 10px;
      overflow: visible;
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }

    .tray-heading,
    .selected-color,
    .tray-empty {
      display: none;
    }

    .color-grid {
      display: flex;
      gap: 4px;
      overflow-x: auto;
    }

    .artbead {
      flex: 0 0 38px;
      width: 38px;
      height: 38px;
    }

    .swatch {
      min-height: 30px;
    }

    .board-header {
      align-items: start;
      flex-direction: column;
      gap: 8px;
      padding: 8px 12px;
    }

    .board-actions {
      width: 100%;
      justify-content: space-between;
    }

    .board-title h1 {
      max-width: 260px;
    }

    .board-area {
      min-height: 560px;
    }

    .workspace-home {
      padding: 24px;
    }

    .home-image {
      width: 185px;
      height: 185px;
    }
  }
</style>
