<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Icon from '$lib/components/Icon.svelte';
  import {
    EDITOR_TOOL_DEFINITIONS,
    EditorTool
  } from '$model/editor.model';
  import { IconName } from '$model/icon.model';
  import {
    SELECTION_OPERATION_DEFINITIONS,
    SelectionOperation
  } from '$model/selection.model';

  interface ActionItem {
    icon: IconName;
    labelKey: string;
    descriptionKey: string;
  }

  interface ShortcutItem {
    labelKey: string;
    keys?: string;
    keysKey?: string;
  }

  interface ShortcutGroup {
    titleKey: string;
    items: readonly ShortcutItem[];
  }

  const TOOL_DESCRIPTION_KEYS: Readonly<Record<EditorTool, string>> = {
    [EditorTool.ColorSelect]: 'docs.tools.colorSelect',
    [EditorTool.MagicWand]: 'docs.tools.magicWand',
    [EditorTool.Select]: 'docs.tools.select',
    [EditorTool.Move]: 'docs.tools.move',
    [EditorTool.ColorPicker]: 'docs.tools.colorPicker',
    [EditorTool.Pencil]: 'docs.tools.pencil',
    [EditorTool.Eraser]: 'docs.tools.eraser',
    [EditorTool.Fill]: 'docs.tools.fill'
  };

  const SELECTION_DESCRIPTION_KEYS: Readonly<
    Record<SelectionOperation, string>
  > = {
    [SelectionOperation.Replace]: 'docs.selectionModes.replace',
    [SelectionOperation.Union]: 'docs.selectionModes.union',
    [SelectionOperation.Subtract]: 'docs.selectionModes.subtract',
    [SelectionOperation.Xor]: 'docs.selectionModes.xor',
    [SelectionOperation.Intersect]: 'docs.selectionModes.intersect'
  };

  const ACTION_ITEMS: readonly ActionItem[] = [
    {
      icon: IconName.Image,
      labelKey: 'reference.button',
      descriptionKey: 'docs.actionDescriptions.reference'
    },
    {
      icon: IconName.Copy,
      labelKey: 'board.copySelection',
      descriptionKey: 'docs.actionDescriptions.copy'
    },
    {
      icon: IconName.Paste,
      labelKey: 'board.pasteSelection',
      descriptionKey: 'docs.actionDescriptions.paste'
    },
    {
      icon: IconName.Undo,
      labelKey: 'board.undo',
      descriptionKey: 'docs.actionDescriptions.undo'
    },
    {
      icon: IconName.Redo,
      labelKey: 'board.redo',
      descriptionKey: 'docs.actionDescriptions.redo'
    },
    {
      icon: IconName.Save,
      labelKey: 'board.save',
      descriptionKey: 'docs.actionDescriptions.save'
    },
    {
      icon: IconName.MoreHorizontal,
      labelKey: 'board.more',
      descriptionKey: 'docs.actionDescriptions.more'
    }
  ];

  const TOOL_SHORTCUTS: readonly ShortcutItem[] =
    EDITOR_TOOL_DEFINITIONS.map((tool) => ({
      labelKey: tool.labelKey,
      keys: tool.shortcut
    }));

  const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
    {
      titleKey: 'docs.shortcutGroups.tools',
      items: TOOL_SHORTCUTS
    },
    {
      titleKey: 'docs.shortcutGroups.editing',
      items: [
        {
          labelKey: 'docs.shortcutLabels.copySelection',
          keys: 'Ctrl / ⌘ + C'
        },
        {
          labelKey: 'docs.shortcutLabels.pasteSelection',
          keys: 'Ctrl / ⌘ + V'
        },
        {
          labelKey: 'docs.shortcutLabels.deleteSelection',
          keys: 'Delete / Backspace'
        },
        {
          labelKey: 'docs.shortcutLabels.undo',
          keys: 'Ctrl / ⌘ + Z'
        },
        {
          labelKey: 'docs.shortcutLabels.redo',
          keys: 'Ctrl / ⌘ + Shift + Z'
        },
        {
          labelKey: 'docs.shortcutLabels.redoAlternate',
          keys: 'Ctrl + Y'
        },
        {
          labelKey: 'docs.shortcutLabels.save',
          keys: 'Ctrl / ⌘ + S'
        },
        {
          labelKey: 'docs.shortcutLabels.closeOrCancel',
          keys: 'Esc'
        }
      ]
    },
    {
      titleKey: 'docs.shortcutGroups.navigation',
      items: [
        {
          labelKey: 'docs.shortcutLabels.panVertical',
          keysKey: 'docs.shortcutValues.panVertical'
        },
        {
          labelKey: 'docs.shortcutLabels.panHorizontal',
          keysKey: 'docs.shortcutValues.panHorizontal'
        },
        {
          labelKey: 'docs.shortcutLabels.zoom',
          keysKey: 'docs.shortcutValues.zoom'
        },
        {
          labelKey: 'docs.shortcutLabels.panDrag',
          keysKey: 'docs.shortcutValues.panDrag'
        },
        {
          labelKey: 'docs.shortcutLabels.touchPan',
          keysKey: 'docs.shortcutValues.touchPan'
        }
      ]
    },
    {
      titleKey: 'docs.shortcutGroups.selection',
      items: [
        {
          labelKey: 'docs.shortcutLabels.add',
          keysKey: 'docs.shortcutValues.add'
        },
        {
          labelKey: 'docs.shortcutLabels.subtract',
          keysKey: 'docs.shortcutValues.subtract'
        },
        {
          labelKey: 'docs.shortcutLabels.opposite',
          keysKey: 'docs.shortcutValues.opposite'
        },
        {
          labelKey: 'docs.shortcutLabels.intersect',
          keysKey: 'docs.shortcutValues.intersect'
        },
        {
          labelKey: 'docs.shortcutLabels.square',
          keysKey: 'docs.shortcutValues.square'
        },
        {
          labelKey: 'docs.shortcutLabels.clear',
          keysKey: 'docs.shortcutValues.clear'
        }
      ]
    }
  ];
</script>

<div class="docs-page">
  <div class="docs-layout">
    <aside class="docs-toc">
      <p>{$_('docs.toc')}</p>
      <nav aria-label={$_('docs.toc')}>
        <a href="#pegboard">01 · {$_('docs.tocBoard')}</a>
        <a href="#tools">02 · {$_('docs.tocTools')}</a>
        <a href="#selection">03 · {$_('docs.tocSelection')}</a>
        <a href="#shortcuts">04 · {$_('docs.tocShortcuts')}</a>
      </nav>
    </aside>

    <main class="docs-content">
      <section id="pegboard" class="docs-section">
        <div class="section-heading">
          <span>01</span>
          <div>
            <h2>{$_('docs.workflowTitle')}</h2>
            <p>{$_('docs.workflowDescription')}</p>
          </div>
        </div>

        <ol class="workflow-grid">
          <li>
            <span class="step-number">01</span>
            <h3>{$_('docs.steps.create.title')}</h3>
            <p>{$_('docs.steps.create.body')}</p>
          </li>
          <li>
            <span class="step-number">02</span>
            <h3>{$_('docs.steps.chooseColor.title')}</h3>
            <p>{$_('docs.steps.chooseColor.body')}</p>
          </li>
          <li>
            <span class="step-number">03</span>
            <h3>{$_('docs.steps.draw.title')}</h3>
            <p>{$_('docs.steps.draw.body')}</p>
          </li>
          <li>
            <span class="step-number">04</span>
            <h3>{$_('docs.steps.assemble.title')}</h3>
            <p>{$_('docs.steps.assemble.body')}</p>
          </li>
        </ol>

        <div class="board-note">
          <span class="note-icon"><Icon name={IconName.Move} size={20} /></span>
          <div>
            <h3>{$_('docs.boardNoteTitle')}</h3>
            <p>{$_('docs.boardNote')}</p>
          </div>
        </div>
      </section>

      <section id="tools" class="docs-section">
        <div class="section-heading">
          <span>02</span>
          <div>
            <h2>{$_('docs.toolsTitle')}</h2>
            <p>{$_('docs.toolsDescription')}</p>
          </div>
        </div>

        <div class="tool-grid">
          {#each EDITOR_TOOL_DEFINITIONS as tool, index (tool.id)}
            <article class="tool-card">
              <div class="tool-card-head">
                <span class="tool-icon">
                  <Icon name={tool.icon} size={20} />
                </span>
                <span class="tool-index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <kbd>{tool.shortcut}</kbd>
              </div>
              <h3>{$_(tool.labelKey)}</h3>
              <p>{$_(TOOL_DESCRIPTION_KEYS[tool.id])}</p>
            </article>
          {/each}
        </div>

        <div class="action-heading">
          <div>
            <h3>{$_('docs.actionsTitle')}</h3>
            <p>{$_('docs.actionsDescription')}</p>
          </div>
        </div>

        <div class="action-grid">
          {#each ACTION_ITEMS as action}
            <article class="action-card">
              <span class="action-icon">
                <Icon name={action.icon} size={19} />
              </span>
              <div>
                <h3>{$_(action.labelKey)}</h3>
                <p>{$_(action.descriptionKey)}</p>
              </div>
            </article>
          {/each}
        </div>
      </section>

      <section id="selection" class="docs-section">
        <div class="section-heading">
          <span>03</span>
          <div>
            <h2>{$_('docs.selectionTitle')}</h2>
            <p>{$_('docs.selectionDescription')}</p>
          </div>
        </div>

        <div class="selection-modes">
          {#each SELECTION_OPERATION_DEFINITIONS as operation, index (operation.id)}
            <div class="selection-mode">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{$_(operation.labelKey)}</h3>
                <p>{$_(SELECTION_DESCRIPTION_KEYS[operation.id])}</p>
              </div>
            </div>
          {/each}
        </div>
      </section>

      <section id="shortcuts" class="docs-section">
        <div class="section-heading">
          <span>04</span>
          <div>
            <h2>{$_('docs.shortcutsTitle')}</h2>
            <p>{$_('docs.shortcutsDescription')}</p>
          </div>
        </div>

        <div class="shortcut-grid">
          {#each SHORTCUT_GROUPS as group}
            <section class="shortcut-group">
              <h3>{$_(group.titleKey)}</h3>
              <div>
                {#each group.items as shortcut}
                  <div class="shortcut-row">
                    <span>{$_(shortcut.labelKey)}</span>
                    <kbd>
                      {#if shortcut.keysKey}
                        {$_(shortcut.keysKey)}
                      {:else}
                        {shortcut.keys}
                      {/if}
                    </kbd>
                  </div>
                {/each}
              </div>
            </section>
          {/each}
        </div>

        <p class="shortcut-tip">{$_('docs.shortcutTip')}</p>
      </section>
    </main>
  </div>
</div>

<style>
  .docs-page {
    height: 100%;
    overflow-y: auto;
    scroll-behavior: smooth;
    background: var(--page);
  }

  .docs-layout {
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr);
    gap: clamp(36px, 6vw, 90px);
    max-width: 1220px;
    margin: 0 auto;
    padding: 40px 28px 100px;
  }

  .docs-toc {
    position: sticky;
    top: 24px;
    align-self: start;
  }

  .docs-toc > p {
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-strong);
    color: var(--muted);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .docs-toc nav {
    display: grid;
    gap: 2px;
  }

  .docs-toc a {
    padding: 8px 10px;
    color: var(--muted);
    font-size: 0.76rem;
    text-decoration: none;
  }

  .docs-toc a:hover,
  .docs-toc a:focus-visible {
    background: var(--hover);
    color: var(--text);
  }

  .docs-content {
    display: grid;
    min-width: 0;
    gap: clamp(72px, 9vw, 112px);
  }

  .docs-section {
    min-width: 0;
    scroll-margin-top: 24px;
  }

  .section-heading {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 16px;
    margin-bottom: 34px;
    padding-top: 16px;
    border-top: 1px solid var(--border-strong);
  }

  .section-heading > span {
    color: var(--faint);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.1em;
  }

  .section-heading h2 {
    margin-bottom: 10px;
    font-size: clamp(2rem, 4vw, 3.3rem);
    font-weight: 500;
    line-height: 1.04;
  }

  .section-heading p {
    max-width: 760px;
    margin-bottom: 0;
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.8;
  }

  .workflow-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1px;
    margin: 0;
    padding: 1px;
    border: 1px solid var(--border);
    background: var(--border);
    list-style: none;
  }

  .workflow-grid li {
    min-height: 190px;
    padding: 22px;
    background: var(--surface);
  }

  .step-number {
    display: block;
    margin-bottom: 32px;
    color: var(--faint);
    font-size: 0.64rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.1em;
  }

  .workflow-grid h3,
  .tool-card h3,
  .action-card h3,
  .selection-mode h3,
  .shortcut-group h3 {
    margin-bottom: 10px;
    font-size: 0.96rem;
    font-weight: 650;
  }

  .workflow-grid p,
  .tool-card p,
  .action-card p,
  .selection-mode p {
    margin-bottom: 0;
    color: var(--muted);
    font-size: 0.78rem;
    line-height: 1.75;
  }

  .board-note {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 16px;
    margin-top: 18px;
    padding: 18px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
  }

  .note-icon,
  .tool-icon,
  .action-icon {
    display: grid;
    place-items: center;
    border: 1px solid var(--border-strong);
  }

  .note-icon {
    width: 42px;
    height: 42px;
  }

  .board-note h3 {
    margin-bottom: 6px;
    font-size: 0.84rem;
  }

  .board-note p {
    margin-bottom: 0;
    color: var(--muted);
    font-size: 0.76rem;
    line-height: 1.75;
  }

  .tool-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .tool-card {
    min-height: 226px;
    padding: 20px;
    border: 1px solid var(--border);
    background: var(--surface);
  }

  .tool-card-head {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto;
    align-items: start;
    gap: 12px;
    margin-bottom: 32px;
  }

  .tool-icon {
    width: 42px;
    height: 42px;
  }

  .tool-index {
    padding-top: 5px;
    color: var(--faint);
    font-size: 0.6rem;
    letter-spacing: 0.12em;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    min-height: 26px;
    padding: 3px 7px;
    border: 1px solid var(--border-strong);
    border-bottom-width: 2px;
    border-radius: 2px;
    background: var(--surface);
    color: var(--text);
    font-family: inherit;
    font-size: 0.66rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
    text-align: center;
    white-space: nowrap;
  }

  .action-heading {
    margin: 30px 0 12px;
    padding-top: 22px;
    border-top: 1px solid var(--border);
  }

  .action-heading h3 {
    margin-bottom: 6px;
    font-size: 1rem;
  }

  .action-heading p {
    margin-bottom: 0;
    color: var(--muted);
    font-size: 0.76rem;
    line-height: 1.7;
  }

  .action-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1px;
    padding: 1px;
    border: 1px solid var(--border);
    background: var(--border);
  }

  .action-card {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr);
    align-items: start;
    gap: 14px;
    min-height: 152px;
    padding: 18px;
    background: var(--surface);
  }

  .action-card:last-child:nth-child(odd) {
    grid-column: 1 / -1;
    min-height: 0;
  }

  .action-icon {
    width: 38px;
    height: 38px;
    color: var(--muted);
  }

  .selection-modes {
    border-top: 1px solid var(--border-strong);
  }

  .selection-mode {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 16px;
    padding: 18px 0;
    border-bottom: 1px solid var(--border);
  }

  .selection-mode > span {
    color: var(--faint);
    font-size: 0.62rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.1em;
  }

  .selection-mode h3 {
    margin-bottom: 4px;
  }

  .shortcut-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    align-items: start;
  }

  .shortcut-group {
    min-width: 0;
    padding: 18px;
    border: 1px solid var(--border);
    background: var(--surface);
  }

  .shortcut-group h3 {
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-strong);
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .shortcut-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    min-height: 42px;
    padding: 7px 0;
    border-bottom: 1px solid var(--border);
  }

  .shortcut-row:last-child {
    border-bottom: 0;
  }

  .shortcut-row > span {
    color: var(--muted);
    font-size: 0.74rem;
    line-height: 1.45;
  }

  .shortcut-row kbd {
    justify-self: end;
    white-space: normal;
  }

  .shortcut-tip {
    margin: 16px 0 0;
    padding: 14px 16px;
    border-left: 2px solid var(--text);
    background: var(--surface);
    color: var(--muted);
    font-size: 0.72rem;
    line-height: 1.7;
  }

  @media (max-width: 900px) {
    .docs-layout {
      grid-template-columns: minmax(0, 1fr);
      gap: 44px;
    }

    .docs-toc {
      position: static;
    }

    .docs-toc nav {
      display: flex;
      flex-wrap: wrap;
    }

    .docs-toc a {
      border: 1px solid var(--border);
    }
  }

  @media (max-width: 680px) {
    .docs-layout {
      padding: 28px 16px 72px;
    }

    .workflow-grid,
    .tool-grid,
    .action-grid,
    .shortcut-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .action-card:last-child:nth-child(odd) {
      grid-column: auto;
    }

    .workflow-grid li,
    .tool-card {
      min-height: 0;
    }

    .section-heading {
      grid-template-columns: 30px minmax(0, 1fr);
      gap: 10px;
    }

    .shortcut-row {
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
    }

    .shortcut-row kbd {
      justify-self: start;
    }
  }
</style>
