<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Icon from '$lib/components/Icon.svelte';
  import type { CustomPaletteScheme } from '$model/custom-palette.model';
  import { MAX_CUSTOM_PALETTE_NAME_LENGTH } from '$model/custom-palette.model';
  import { IconName } from '$model/icon.model';

  interface Props {
    schemes: readonly CustomPaletteScheme[];
    selectedId: string | null;
    disabled?: boolean;
    onadd: () => void | Promise<void>;
    onselect: (id: string) => void;
    onrename: (id: string, name: string) => void | Promise<void>;
    ondelete: (id: string) => void | Promise<void>;
  }

  let {
    schemes,
    selectedId,
    disabled = false,
    onadd,
    onselect,
    onrename,
    ondelete
  }: Props = $props();
  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();
  let contextMenu = $state<{
    schemeId: string;
    left: number;
    top: number;
  } | null>(null);
  let contextMenuElement: HTMLDivElement | undefined = $state();
  let actionMode = $state<'rename' | 'delete' | null>(null);
  let actionTargetId = $state<string | null>(null);
  let renameName = $state('');
  let actionError = $state('');
  let working = $state(false);

  let selectedScheme = $derived(
    schemes.find((scheme) => scheme.id === selectedId)
  );
  let actionTarget = $derived(
    schemes.find((scheme) => scheme.id === actionTargetId)
  );

  function toggleMenu(): void {
    if (disabled) {
      return;
    }
    open = !open;
    contextMenu = null;
  }

  function closeDropdown(): void {
    open = false;
    contextMenu = null;
  }

  async function addScheme(): Promise<void> {
    await onadd();
    closeDropdown();
  }

  function selectScheme(id: string): void {
    onselect(id);
    closeDropdown();
  }

  function openSchemeMenu(event: MouseEvent, schemeId: string): void {
    event.preventDefault();
    event.stopPropagation();
    contextMenu = {
      schemeId,
      left: Math.min(event.clientX, window.innerWidth - 164),
      top: Math.min(event.clientY, window.innerHeight - 92)
    };
  }

  function beginRename(): void {
    const scheme = schemes.find(
      (candidate) => candidate.id === contextMenu?.schemeId
    );
    if (!scheme) {
      return;
    }
    actionTargetId = scheme.id;
    renameName = scheme.name;
    actionMode = 'rename';
    actionError = '';
    contextMenu = null;
    open = false;
  }

  function beginDelete(): void {
    const schemeId = contextMenu?.schemeId;
    if (!schemeId) {
      return;
    }
    actionTargetId = schemeId;
    actionMode = 'delete';
    actionError = '';
    contextMenu = null;
    open = false;
  }

  function closeAction(): void {
    if (working) {
      return;
    }
    actionMode = null;
    actionTargetId = null;
    actionError = '';
  }

  async function submitAction(): Promise<void> {
    if (!actionMode || !actionTarget || working) {
      return;
    }

    actionError = '';
    if (actionMode === 'rename') {
      const nextName = renameName.trim();
      if (!nextName) {
        actionError = $_('tray.paletteNameRequired');
        return;
      }

      working = true;
      try {
        await onrename(actionTarget.id, nextName);
        actionMode = null;
        actionTargetId = null;
      } catch {
        actionError = $_('tray.renamePaletteError');
      } finally {
        working = false;
      }
      return;
    }

    working = true;
    try {
      await ondelete(actionTarget.id);
      actionMode = null;
      actionTargetId = null;
    } catch {
      actionError = $_('tray.deletePaletteError');
    } finally {
      working = false;
    }
  }
</script>

<svelte:window
  onclick={(event) => {
    const target = event.target as Node;
    if (open && root && !root.contains(target)) {
      open = false;
    }
    if (
      contextMenu &&
      contextMenuElement &&
      !contextMenuElement.contains(target)
    ) {
      contextMenu = null;
    }
  }}
  onkeydown={(event) => {
    if (event.key !== 'Escape') {
      return;
    }
    if (actionMode) {
      closeAction();
    } else {
      closeDropdown();
    }
  }}
/>

<div class="scheme-select" bind:this={root}>
  <button
    class="scheme-trigger"
    type="button"
    aria-haspopup="listbox"
    aria-expanded={open}
    disabled={disabled}
    onclick={toggleMenu}
  >
    <span>{selectedScheme?.name ?? $_('tray.paletteSchemeSelectLabel')}</span>
    <Icon name={IconName.ChevronDown} size={14} />
  </button>

  {#if open}
    <div class="scheme-menu" role="listbox" aria-label={$_('tray.paletteSchemeSelectLabel')}>
      <button
        class="scheme-option add-option"
        type="button"
        role="option"
        aria-selected="false"
        onclick={() => void addScheme()}
      >
        <Icon name={IconName.Plus} size={14} />
        <span>{$_('tray.addPaletteScheme')}</span>
      </button>
      {#each schemes as scheme (scheme.id)}
        <button
          class="scheme-option"
          class:active={scheme.id === selectedId}
          type="button"
          role="option"
          aria-selected={scheme.id === selectedId}
          title={$_('tray.paletteSchemeActions')}
          onclick={() => selectScheme(scheme.id)}
          oncontextmenu={(event) => openSchemeMenu(event, scheme.id)}
        >
          <span>{scheme.name}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

{#if contextMenu}
  <div
    class="scheme-context-menu"
    bind:this={contextMenuElement}
    role="menu"
    tabindex="-1"
    aria-label={$_('tray.paletteSchemeActions')}
    style:left={`${contextMenu.left}px`}
    style:top={`${contextMenu.top}px`}
  >
    <button
      type="button"
      role="menuitem"
      onclick={(event) => {
        event.stopPropagation();
        beginRename();
      }}
    >
      {$_('tray.renamePalette')}
    </button>
    <button
      type="button"
      role="menuitem"
      onclick={(event) => {
        event.stopPropagation();
        beginDelete();
      }}
    >
      {$_('tray.deletePalette')}
    </button>
  </div>
{/if}

{#if actionMode}
  <button
    class="dialog-backdrop"
    type="button"
    aria-label={$_('nav.cancel')}
    disabled={working}
    onclick={closeAction}
  ></button>
  <div
    class="palette-action-dialog"
    role="dialog"
    aria-modal="true"
    aria-label={actionMode === 'rename'
      ? $_('tray.renamePaletteTitle')
      : $_('tray.deletePaletteTitle')}
  >
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void submitAction();
      }}
    >
      <header>
        <h2>
          {actionMode === 'rename'
            ? $_('tray.renamePaletteTitle')
            : $_('tray.deletePaletteTitle')}
        </h2>
        <button
          class="dialog-close"
          type="button"
          aria-label={$_('nav.cancel')}
          disabled={working}
          onclick={closeAction}
        >
          <Icon name={IconName.Close} size={18} />
        </button>
      </header>

      {#if actionMode === 'rename'}
        <label class="name-field">
          <span>{$_('tray.paletteNameLabel')}</span>
          <input
            bind:value={renameName}
            type="text"
            maxlength={MAX_CUSTOM_PALETTE_NAME_LENGTH}
            autocomplete="off"
            disabled={working}
            aria-invalid={Boolean(actionError)}
          />
        </label>
      {:else}
        <p class="delete-prompt">
          {$_('tray.deletePalettePrompt', {
            values: { name: actionTarget?.name ?? '' }
          })}
        </p>
      {/if}

      {#if actionError}
        <p class="action-error" role="alert">{actionError}</p>
      {/if}

      <div class="dialog-actions">
        <button
          class="button secondary"
          type="button"
          disabled={working}
          onclick={closeAction}
        >
          {$_('nav.cancel')}
        </button>
        <button class="button primary" type="submit" disabled={working}>
          {actionMode === 'rename'
            ? $_('tray.renamePalette')
            : working
              ? $_('tray.deletingPalette')
              : $_('tray.deletePalette')}
        </button>
      </div>
    </form>
  </div>
{/if}

<style>
  .scheme-select {
    position: relative;
  }

  .scheme-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    min-height: 34px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: 2px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 0.74rem;
    text-align: left;
    cursor: pointer;
  }

  .scheme-trigger span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .scheme-trigger:disabled {
    cursor: wait;
    opacity: 0.55;
  }

  .scheme-menu {
    position: absolute;
    z-index: 25;
    top: calc(100% + 4px);
    right: 0;
    left: 0;
    display: grid;
    max-height: 210px;
    padding: 4px;
    overflow-y: auto;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .scheme-option {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 6px 8px;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 0.72rem;
    text-align: left;
    cursor: pointer;
  }

  .scheme-option:hover,
  .scheme-option.active {
    background: var(--hover);
  }

  .scheme-option span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .add-option {
    margin-bottom: 3px;
    border-bottom: 1px solid var(--border);
    color: var(--muted);
  }

  .scheme-context-menu {
    position: fixed;
    z-index: 90;
    display: grid;
    min-width: 152px;
    padding: 4px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .scheme-context-menu button {
    min-height: 34px;
    padding: 0 10px;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 0.76rem;
    text-align: left;
    cursor: pointer;
  }

  .scheme-context-menu button:hover {
    background: var(--hover);
  }

  .dialog-backdrop {
    position: fixed;
    z-index: 70;
    inset: 0;
    border: 0;
    background: rgba(0, 0, 0, 0.38);
    cursor: default;
  }

  .palette-action-dialog {
    position: fixed;
    z-index: 71;
    top: 50%;
    left: 50%;
    width: min(420px, calc(100vw - 32px));
    padding: 22px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
    transform: translate(-50%, -50%);
  }

  .palette-action-dialog form {
    display: grid;
    gap: 18px;
  }

  .palette-action-dialog header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 16px;
  }

  .palette-action-dialog h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .dialog-close {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    cursor: pointer;
  }

  .name-field {
    display: grid;
    gap: 7px;
    color: var(--muted);
    font-size: 0.72rem;
  }

  .name-field input {
    min-height: 38px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: 2px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }

  .delete-prompt {
    margin: 0;
    color: var(--muted);
    font-size: 0.78rem;
    line-height: 1.65;
  }

  .action-error {
    margin: 0;
    color: var(--danger, #b42318);
    font-size: 0.72rem;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
