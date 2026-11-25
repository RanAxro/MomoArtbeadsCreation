<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Snippet } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { MAX_PROJECT_NAME_LENGTH } from '$model/project.model';
  import { IconName } from '$model/icon.model';
  import { AppLocale, ThemeMode } from '$model/settings.model';
  import {
    MAX_CLIPBOARD_HISTORY_LIMIT,
    MIN_CLIPBOARD_HISTORY_LIMIT,
    type SelectionClipboard
  } from '$model/selection-clipboard.model';
  import { KeyboardKey } from '$model/ui.model';
  import {
    SCHEME_DATE_FORMAT,
    SCHEME_MENU_SIZE,
    SCHEME_TAB_GAP,
    type SchemeMenu,
    type SchemeTarget
  } from '$model/workspace.model';
  import { _, locale } from 'svelte-i18n';
  import { countFilledCells } from '$domain/project';
  import ClipboardPreview from '$lib/components/ClipboardPreview.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { setAppLocale } from '$lib/i18n';
  import { clipboardStore } from '$modules/clipboard/clipboard-store.svelte';
  import { themeStore } from '$modules/settings/theme.svelte';
  import { workspace } from '$modules/workspace/workspace.svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
  let fileOpen = $state(false);
  let clipboardOpen = $state(false);
  let settingsOpen = $state(false);
  let fileArea: HTMLDivElement | undefined = $state();
  let clipboardArea: HTMLDivElement | undefined = $state();
  let schemeAreaElement: HTMLDivElement | undefined = $state();
  let schemeTabsElement: HTMLDivElement | undefined = $state();
  let schemeMeasureElement: HTMLDivElement | undefined = $state();
  let schemePopoverArea: HTMLDivElement | undefined = $state();
  let schemeMenuElement: HTMLDivElement | undefined = $state();
  let schemeMenu = $state<SchemeMenu | null>(null);
  let schemePopoverOpen = $state(false);
  let visibleSchemeCount = $state(0);
  let renameTarget = $state<SchemeTarget | null>(null);
  let renameValue = $state('');
  let renaming = $state(false);
  let renameError = $state('');
  let renameInput: HTMLInputElement | undefined = $state();
  let deleteTarget = $state<SchemeTarget | null>(null);
  let deleting = $state(false);
  let deleteError = $state('');

  let orderedSchemes = $derived.by(() =>
    [...workspace.projects].sort((first, second) =>
      second.updatedAt.localeCompare(first.updatedAt)
    )
  );
  let visibleSchemes = $derived(orderedSchemes.slice(0, visibleSchemeCount));
  let schemeDateFormatter = $derived(
    new Intl.DateTimeFormat($locale ?? AppLocale.ZhCN, SCHEME_DATE_FORMAT)
  );

  async function updateVisibleSchemeCount(): Promise<void> {
    await tick();
    if (!schemeAreaElement || !schemeTabsElement || !schemeMeasureElement) {
      return;
    }

    const areaStyles = getComputedStyle(schemeAreaElement);
    const gap = Number.parseFloat(areaStyles.columnGap) || 0;
    const fixedChildren = Array.from(schemeAreaElement.children).filter(
      (child) =>
        child !== schemeTabsElement &&
        child !== schemeMeasureElement &&
        getComputedStyle(child).display !== 'none'
    );
    const fixedWidth = fixedChildren.reduce(
      (width, child) =>
        width +
        (child.classList.contains('scheme-spacer') ? 0 : child.getBoundingClientRect().width),
      0
    );
    const visibleChildCount = fixedChildren.length + 1;
    const availableWidth = Math.max(
      0,
      schemeAreaElement.clientWidth -
        fixedWidth -
        gap * Math.max(0, visibleChildCount - 1) -
        1
    );
    const measuredTabs = Array.from(schemeMeasureElement.children) as HTMLElement[];
    let usedWidth = 0;
    let nextVisibleCount = 0;

    for (const tab of measuredTabs) {
      const tabWidth = tab.getBoundingClientRect().width;
      const nextWidth =
        usedWidth +
        (nextVisibleCount > 0 ? SCHEME_TAB_GAP : 0) +
        tabWidth;
      if (nextWidth > availableWidth) {
        break;
      }
      usedWidth = nextWidth;
      nextVisibleCount += 1;
    }

    visibleSchemeCount = nextVisibleCount;
  }

  function formatModifiedAt(updatedAt: string): string {
    return schemeDateFormatter.format(new Date(updatedAt));
  }

  async function openScheme(id: string): Promise<void> {
    fileOpen = false;
    clipboardOpen = false;
    schemePopoverOpen = false;
    const opened = await workspace.select(id);
    if (opened && page.url.pathname !== '/') {
      await goto('/');
    }
  }

  function closeScheme(event: MouseEvent): void {
    event.stopPropagation();
    clipboardOpen = false;
    workspace.close();
  }

  async function toggleClipboard(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    fileOpen = false;
    settingsOpen = false;
    schemeMenu = null;
    clipboardOpen = !clipboardOpen;
    if (clipboardOpen) {
      await clipboardStore.refresh();
    }
  }

  async function pasteClipboardEntry(
    clipboard: SelectionClipboard
  ): Promise<void> {
    if (!workspace.editor.pasteSelectionClipboard(clipboard)) {
      return;
    }
    clipboardOpen = false;
    await clipboardStore.use(clipboard.id);
  }

  function showSchemeMenu(
    event: MouseEvent,
    target: SchemeTarget,
    preservePopover = false
  ): void {
    event.preventDefault();
    event.stopPropagation();
    fileOpen = false;
    clipboardOpen = false;
    settingsOpen = false;
    if (!preservePopover) {
      schemePopoverOpen = false;
    }

    schemeMenu = {
      target,
      x: Math.max(
        SCHEME_MENU_SIZE.viewportMargin,
        Math.min(
          event.clientX,
          window.innerWidth -
            SCHEME_MENU_SIZE.width -
            SCHEME_MENU_SIZE.viewportMargin
        )
      ),
      y: Math.max(
        SCHEME_MENU_SIZE.viewportMargin,
        Math.min(
          event.clientY,
          window.innerHeight -
            SCHEME_MENU_SIZE.height -
            SCHEME_MENU_SIZE.viewportMargin
        )
      )
    };
  }

  function openSchemeFromMenu(): void {
    const target = schemeMenu?.target;
    schemeMenu = null;
    if (target) {
      void openScheme(target.id);
    }
  }

  async function requestSchemeRename(): Promise<void> {
    const target = schemeMenu?.target;
    schemeMenu = null;
    if (!target) {
      return;
    }

    deleteTarget = null;
    deleteError = '';
    renameTarget = target;
    renameValue = target.name;
    renameError = '';
    await tick();
    renameInput?.focus();
    renameInput?.select();
  }

  function cancelSchemeRename(): void {
    if (renaming) {
      return;
    }
    renameTarget = null;
    renameValue = '';
    renameError = '';
  }

  async function confirmSchemeRename(): Promise<void> {
    const target = renameTarget;
    const nextName = renameValue.trim();
    if (!target || renaming) {
      return;
    }
    if (!nextName) {
      renameError = $_('nav.renameRequired');
      return;
    }
    if (nextName === target.name) {
      cancelSchemeRename();
      return;
    }

    renaming = true;
    renameError = '';
    try {
      await workspace.renameScheme(target.id, nextName);
      renameTarget = null;
      renameValue = '';
    } catch {
      renameError = $_('nav.renameError');
    } finally {
      renaming = false;
    }
  }

  function requestSchemeDeletion(): void {
    const target = schemeMenu?.target;
    schemeMenu = null;
    if (target) {
      renameTarget = null;
      renameValue = '';
      renameError = '';
      deleteError = '';
      deleteTarget = target;
    }
  }

  function cancelSchemeDeletion(): void {
    if (deleting) {
      return;
    }
    deleteTarget = null;
    deleteError = '';
  }

  async function confirmSchemeDeletion(): Promise<void> {
    const target = deleteTarget;
    if (!target || deleting) {
      return;
    }

    deleting = true;
    deleteError = '';
    try {
      await workspace.deleteScheme(target.id);
      deleteTarget = null;
    } catch {
      deleteError = $_('nav.deleteError');
    } finally {
      deleting = false;
    }
  }

  function changeLocale(nextLocale: AppLocale): void {
    setAppLocale(nextLocale);
  }

  onMount(() => {
    themeStore.initialize();
    void workspace.initialize();
    void clipboardStore.initialize();

    const closeFloatingMenus = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedSchemeMenu = Boolean(
        schemeMenuElement && event.composedPath().includes(schemeMenuElement)
      );

      if (fileArea && !fileArea.contains(target)) {
        fileOpen = false;
      }
      if (clipboardArea && !clipboardArea.contains(target)) {
        clipboardOpen = false;
      }
      if (schemeMenuElement && !schemeMenuElement.contains(target)) {
        schemeMenu = null;
      }
      if (
        schemePopoverArea &&
        !schemePopoverArea.contains(target) &&
        !clickedSchemeMenu
      ) {
        schemePopoverOpen = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === KeyboardKey.Escape) {
        fileOpen = false;
        clipboardOpen = false;
        settingsOpen = false;
        schemeMenu = null;
        schemePopoverOpen = false;
        if (!deleting) {
          deleteTarget = null;
          deleteError = '';
        }
        if (!renaming) {
          renameTarget = null;
          renameValue = '';
          renameError = '';
        }
      }
    };

    window.addEventListener('click', closeFloatingMenus);
    window.addEventListener('keydown', closeOnEscape);
    const refreshClipboardOnFocus = (): void => {
      void clipboardStore.refresh();
    };
    window.addEventListener('focus', refreshClipboardOnFocus);
    const resizeObserver = new ResizeObserver(() => {
      void updateVisibleSchemeCount();
    });
    if (schemeAreaElement) {
      resizeObserver.observe(schemeAreaElement);
    }
    void updateVisibleSchemeCount();
    return () => {
      window.removeEventListener('click', closeFloatingMenus);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('focus', refreshClipboardOnFocus);
      resizeObserver.disconnect();
    };
  });

  $effect(() => {
    orderedSchemes;
    workspace.activeId;
    if (!workspace.activeId) {
      clipboardOpen = false;
    }
    $locale;
    void updateVisibleSchemeCount();
  });
</script>

<svelte:head>
  <title>{$_('app.name')} · {$_('app.englishName')}</title>
</svelte:head>

<header class="topbar">
  <div class="topbar-left">
    <a class="wordmark" href="/" aria-label={$_('app.name')}>
      <img class="brand-logo" src="/logo.webp" alt="" />
    </a>

    <div class="main-actions">
      <div class="file-area" bind:this={fileArea}>
        <button
          class="nav-button"
          class:active={fileOpen}
          type="button"
          aria-expanded={fileOpen}
          onclick={(event) => {
            event.stopPropagation();
            fileOpen = !fileOpen;
          }}
        >
          {$_('nav.file')}
        </button>
        {#if fileOpen}
          <div class="file-menu" role="menu">
            <a href="/new" role="menuitem" onclick={() => { fileOpen = false; }}>
              <span><Icon name={IconName.Plus} size={16} /></span>
              {$_('file.new')}
            </a>
            <a href="/import" role="menuitem" onclick={() => { fileOpen = false; }}>
              <span><Icon name={IconName.Image} size={16} /></span>
              {$_('file.import')}
            </a>
            {#if workspace.activeId}
              <button
                type="button"
                role="menuitem"
                onclick={() => {
                  workspace.close();
                  fileOpen = false;
                }}
              >
                <span><Icon name={IconName.Close} size={16} /></span>
                {$_('file.close')}
              </button>
            {/if}
          </div>
        {/if}
      </div>

      {#if workspace.activeId}
        <div class="clipboard-area" bind:this={clipboardArea}>
          <button
            class="nav-button"
            class:active={clipboardOpen}
            type="button"
            aria-haspopup="dialog"
            aria-controls="clipboard-popover"
            aria-expanded={clipboardOpen}
            onclick={(event) => void toggleClipboard(event)}
          >
            {$_('nav.clipboard')}
          </button>

          {#if clipboardOpen}
            <div
              id="clipboard-popover"
              class="clipboard-popover"
              role="dialog"
              aria-label={$_('clipboard.title')}
            >
              <div class="clipboard-heading">
                <strong>{$_('clipboard.title')}</strong>
                <span>
                  {clipboardStore.entries.length} / {clipboardStore.limit}
                </span>
              </div>
              <div class="clipboard-list">
                {#if clipboardStore.entries.length === 0}
                  <p class="clipboard-empty">{$_('clipboard.empty')}</p>
                {/if}
                {#each clipboardStore.entries as clipboard (clipboard.id)}
                  <button
                    class="clipboard-item"
                    type="button"
                    onclick={() => void pasteClipboardEntry(clipboard)}
                  >
                    <ClipboardPreview board={clipboard.board} />
                    <span class="clipboard-item-info">
                      <strong>{$_('board.size', {
                        values: {
                          width: clipboard.board.width,
                          height: clipboard.board.height
                        }
                      })}</strong>
                      <span>
                        {$_('board.artbeads', {
                          values: {
                            count: countFilledCells(clipboard.board.cells)
                          }
                        })}
                      </span>
                    </span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <button
        class="nav-button"
        type="button"
        onclick={() => {
          schemeMenu = null;
          clipboardOpen = false;
          settingsOpen = true;
        }}
      >
        {$_('nav.settings')}
      </button>
    </div>
  </div>

  <div class="scheme-area" bind:this={schemeAreaElement}>
    <span class="scheme-spacer" aria-hidden="true"></span>
    <span class="scheme-label">{$_('nav.schemes')}</span>
    <div class="scheme-tabs" bind:this={schemeTabsElement}>
      {#if orderedSchemes.length === 0}
        <span class="no-schemes">{$_('nav.noSchemes')}</span>
      {/if}
      {#each visibleSchemes as scheme (scheme.id)}
        <div
          class="scheme-tab"
          class:active={workspace.activeId === scheme.id}
          role="group"
          aria-label={scheme.name}
          oncontextmenu={(event) => showSchemeMenu(event, scheme)}
        >
          <button
            class="scheme-name"
            type="button"
            title={$_('nav.openScheme', { values: { name: scheme.name } })}
            onclick={() => openScheme(scheme.id)}
          >
            {scheme.name}
          </button>
          {#if workspace.activeId === scheme.id}
            <button
              class="scheme-close"
              type="button"
              title={$_('nav.closeScheme')}
              aria-label={$_('nav.closeScheme')}
              onclick={closeScheme}
            >
              <Icon name={IconName.Close} size={14} />
            </button>
          {/if}
        </div>
      {/each}
    </div>

    <div class="scheme-measure" bind:this={schemeMeasureElement} aria-hidden="true">
      {#each orderedSchemes as scheme (scheme.id)}
        <div class="scheme-tab" class:active={workspace.activeId === scheme.id}>
          <span class="scheme-name">{scheme.name}</span>
          {#if workspace.activeId === scheme.id}
            <span class="scheme-close"><Icon name={IconName.Close} size={14} /></span>
          {/if}
        </div>
      {/each}
    </div>

    <div class="scheme-popover-area" bind:this={schemePopoverArea}>
      <button
        class="scheme-expand"
        type="button"
        aria-label={$_('nav.expandSchemes')}
        aria-haspopup="dialog"
        aria-controls="scheme-popover"
        aria-expanded={schemePopoverOpen}
        title={$_('nav.expandSchemes')}
        onclick={(event) => {
          event.stopPropagation();
          schemeMenu = null;
          schemePopoverOpen = !schemePopoverOpen;
        }}
      >
        <Icon name={IconName.ChevronDown} size={16} />
      </button>

      {#if schemePopoverOpen}
        <div
          id="scheme-popover"
          class="scheme-popover"
          role="dialog"
          aria-label={$_('nav.allSchemes')}
        >
          <div class="scheme-popover-heading">
            <strong>{$_('nav.allSchemes')}</strong>
            <span>{orderedSchemes.length}</span>
          </div>
          <div class="scheme-list">
            {#if orderedSchemes.length === 0}
              <p class="scheme-list-empty">{$_('nav.noSchemes')}</p>
            {/if}
            {#each orderedSchemes as scheme (scheme.id)}
              <button
                class="scheme-list-item"
                class:active={workspace.activeId === scheme.id}
                type="button"
                aria-current={workspace.activeId === scheme.id ? 'true' : undefined}
                onclick={() => openScheme(scheme.id)}
                oncontextmenu={(event) => showSchemeMenu(event, scheme, true)}
              >
                <span class="scheme-list-name">{scheme.name}</span>
                <span class="scheme-list-time">
                  {$_('nav.modifiedAt', { values: { date: formatModifiedAt(scheme.updatedAt) } })}
                </span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</header>

{#if schemeMenu}
  <div
    class="scheme-context-menu"
    bind:this={schemeMenuElement}
    role="menu"
    aria-label={$_('nav.schemeActions')}
    style:left={`${schemeMenu.x}px`}
    style:top={`${schemeMenu.y}px`}
  >
    <button type="button" role="menuitem" onclick={openSchemeFromMenu}>
      {$_('nav.open')}
    </button>
    <button
      type="button"
      role="menuitem"
      onclick={() => void requestSchemeRename()}
    >
      {$_('nav.rename')}
    </button>
    <button type="button" role="menuitem" onclick={requestSchemeDeletion}>
      {$_('nav.delete')}
    </button>
  </div>
{/if}

<div class="shell-body">
  {@render children()}
</div>

{#if settingsOpen}
  <button
    class="dialog-backdrop"
    type="button"
    aria-label={$_('settings.close')}
    onclick={() => { settingsOpen = false; }}
  ></button>
  <div class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <div class="dialog-heading">
      <div>
        <span class="dialog-index">01</span>
        <h2 id="settings-title">{$_('settings.title')}</h2>
      </div>
      <button
        class="icon-button"
        type="button"
        aria-label={$_('settings.close')}
        onclick={() => { settingsOpen = false; }}
      >
        <Icon name={IconName.Close} size={18} />
      </button>
    </div>

    <div class="setting-group">
      <h3>{$_('settings.appearance')}</h3>
      <p>{$_('settings.theme')}</p>
      <div class="segmented">
        <button
          class:active={themeStore.mode === ThemeMode.Light}
          type="button"
          onclick={() => themeStore.set(ThemeMode.Light)}
        >
          <Icon name={IconName.Sun} size={16} />
          {$_('settings.light')}
        </button>
        <button
          class:active={themeStore.mode === ThemeMode.Dark}
          type="button"
          onclick={() => themeStore.set(ThemeMode.Dark)}
        >
          <Icon name={IconName.Moon} size={16} />
          {$_('settings.dark')}
        </button>
      </div>
    </div>

    <div class="setting-group">
      <h3>{$_('settings.language')}</h3>
      <div class="segmented">
        <button
          class:active={$locale === AppLocale.ZhCN}
          type="button"
          onclick={() => changeLocale(AppLocale.ZhCN)}
        >
          {$_('settings.zh')}
        </button>
        <button
          class:active={$locale === AppLocale.EnUS}
          type="button"
          onclick={() => changeLocale(AppLocale.EnUS)}
        >
          {$_('settings.en')}
        </button>
      </div>
    </div>

    <div class="setting-group">
      <h3>{$_('settings.clipboard')}</h3>
      <p>{$_('settings.clipboardLimitHint')}</p>
      <label class="clipboard-limit-field">
        <span>{$_('settings.clipboardLimit')}</span>
        <input
          class="field"
          type="number"
          min={MIN_CLIPBOARD_HISTORY_LIMIT}
          max={MAX_CLIPBOARD_HISTORY_LIMIT}
          value={clipboardStore.limit}
          onchange={(event) =>
            void clipboardStore.setLimit(
              Number((event.currentTarget as HTMLInputElement).value)
            )}
        />
      </label>
    </div>

    <div class="storage-note">
      <h3>{$_('settings.storage')}</h3>
      <p>{$_('settings.storageCopy')}</p>
    </div>
  </div>
{/if}

{#if deleteTarget}
  <button
    class="dialog-backdrop"
    type="button"
    aria-label={$_('nav.cancel')}
    disabled={deleting}
    onclick={cancelSchemeDeletion}
  ></button>
  <div
    class="confirm-dialog"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="delete-scheme-title"
    aria-describedby="delete-scheme-description"
  >
    <div class="dialog-heading">
      <div>
        <span class="dialog-index">02</span>
        <h2 id="delete-scheme-title">{$_('nav.deleteTitle')}</h2>
      </div>
    </div>

    <p id="delete-scheme-description" class="confirm-copy">
      {$_('nav.deletePrompt', { values: { name: deleteTarget.name } })}
    </p>

    {#if deleteError}
      <p class="delete-error" role="alert">{deleteError}</p>
    {/if}

    <div class="confirm-actions">
      <button
        class="button secondary"
        type="button"
        disabled={deleting}
        onclick={cancelSchemeDeletion}
      >
        {$_('nav.cancel')}
      </button>
      <button
        class="button primary"
        type="button"
        disabled={deleting}
        onclick={() => void confirmSchemeDeletion()}
      >
        {deleting ? $_('nav.deleting') : $_('nav.confirmDelete')}
      </button>
    </div>
  </div>
{/if}

{#if renameTarget}
  <button
    class="dialog-backdrop"
    type="button"
    aria-label={$_('nav.cancel')}
    disabled={renaming}
    onclick={cancelSchemeRename}
  ></button>
  <div
    class="confirm-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="rename-scheme-title"
  >
    <div class="dialog-heading">
      <div>
        <span class="dialog-index">02</span>
        <h2 id="rename-scheme-title">{$_('nav.renameTitle')}</h2>
      </div>
    </div>

    <form
      class="rename-form"
      onsubmit={(event) => {
        event.preventDefault();
        void confirmSchemeRename();
      }}
    >
      <label for="rename-scheme-name">{$_('nav.renameLabel')}</label>
      <input
        id="rename-scheme-name"
        class="field"
        bind:this={renameInput}
        bind:value={renameValue}
        type="text"
        maxlength={MAX_PROJECT_NAME_LENGTH}
        autocomplete="off"
        disabled={renaming}
        oninput={() => { renameError = ''; }}
      />

      {#if renameError}
        <p class="dialog-error" role="alert">{renameError}</p>
      {/if}

      <div class="confirm-actions">
        <button
          class="button secondary"
          type="button"
          disabled={renaming}
          onclick={cancelSchemeRename}
        >
          {$_('nav.cancel')}
        </button>
        <button class="button primary" type="submit" disabled={renaming}>
          {renaming ? $_('nav.renaming') : $_('nav.confirmRename')}
        </button>
      </div>
    </form>
  </div>
{/if}

<style>
  .topbar {
    position: sticky;
    z-index: 30;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    height: 62px;
    padding: 0 18px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .topbar-left,
  .main-actions,
  .scheme-area {
    display: flex;
    align-items: center;
  }

  .topbar-left {
    gap: 20px;
  }

  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    text-decoration: none;
  }

  .brand-logo {
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    border-radius: 4px;
    object-fit: contain;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
    image-rendering: pixelated;
  }

  .main-actions {
    gap: 2px;
  }

  .file-area {
    position: relative;
  }

  .clipboard-area {
    position: relative;
  }

  .nav-button {
    height: 34px;
    padding: 0 12px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .nav-button:hover,
  .nav-button.active {
    background: var(--hover);
    color: var(--text);
  }

  .file-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    display: grid;
    width: 230px;
    padding: 6px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .file-menu a,
  .file-menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 38px;
    padding: 0 10px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--text);
    font-size: 0.84rem;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .file-menu a:hover,
  .file-menu button:hover {
    background: var(--hover);
  }

  .file-menu span {
    display: grid;
    place-items: center;
    width: 16px;
    color: var(--muted);
  }

  .clipboard-popover {
    position: absolute;
    z-index: 37;
    top: calc(100% + 8px);
    left: 0;
    display: grid;
    width: min(340px, calc(100vw - 20px));
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .clipboard-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 12px;
    border-bottom: 1px solid var(--border);
  }

  .clipboard-heading strong {
    font-size: 0.82rem;
    letter-spacing: 0.04em;
  }

  .clipboard-heading span {
    color: var(--muted);
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
  }

  .clipboard-list {
    display: grid;
    max-height: min(55vh, 400px);
    overflow-y: auto;
    padding: 6px;
  }

  .clipboard-item {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    align-items: center;
    gap: 16px;
    width: 100%;
    padding: 9px 10px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .clipboard-item:hover,
  .clipboard-item:focus-visible {
    background: var(--hover);
  }

  .clipboard-item-info {
    display: grid;
    gap: 5px;
    min-width: 0;
    justify-self: stretch;
    text-align: right;
  }

  .clipboard-item-info strong {
    color: var(--text);
    font-size: 0.8rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .clipboard-item-info > span {
    color: var(--muted);
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
  }

  .clipboard-empty {
    margin: 0;
    padding: 14px 10px;
    color: var(--muted);
    font-size: 0.78rem;
  }

  .scheme-area {
    justify-content: flex-end;
    margin-left: auto;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .scheme-spacer {
    min-width: 0;
    flex: 1;
  }

  .scheme-label {
    flex: 0 0 auto;
    color: var(--muted);
    font-size: 0.66rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .scheme-tabs {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex: 0 0 auto;
    gap: 2px;
    min-width: 0;
    overflow: hidden;
  }

  .no-schemes {
    padding: 7px 10px;
    color: var(--muted);
    font-size: 0.78rem;
  }

  .scheme-tab {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    height: 32px;
    border: 1px solid transparent;
    border-radius: 3px;
  }

  .scheme-tab:hover {
    background: var(--hover);
  }

  .scheme-tab.active {
    border-color: var(--text);
    background: var(--text);
  }

  .scheme-name {
    display: flex;
    align-items: center;
    max-width: 190px;
    height: 100%;
    padding: 0 11px;
    overflow: hidden;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 0.78rem;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  .scheme-tab.active .scheme-name {
    color: var(--surface);
  }

  .scheme-context-menu {
    position: fixed;
    z-index: 35;
    display: grid;
    width: 176px;
    padding: 6px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .scheme-context-menu button {
    width: 100%;
    min-height: 38px;
    padding: 0 10px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--text);
    font-size: 0.82rem;
    text-align: left;
    cursor: pointer;
  }

  .scheme-context-menu button:hover,
  .scheme-context-menu button:focus-visible {
    background: var(--hover);
  }

  .scheme-close {
    display: grid;
    place-items: center;
    width: 26px;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--surface);
    font-size: 1rem;
    cursor: pointer;
    opacity: 0.7;
  }

  .scheme-close:hover {
    opacity: 1;
  }

  .scheme-measure {
    position: fixed;
    top: -1000px;
    left: -1000px;
    display: flex;
    gap: 2px;
    visibility: hidden;
    pointer-events: none;
  }

  .scheme-popover-area {
    position: relative;
    flex: 0 0 auto;
  }

  .scheme-expand {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    padding: 0;
    border: 1px solid var(--border-strong);
    border-radius: 3px;
    background: transparent;
    color: var(--text);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
  }

  .scheme-expand:hover,
  .scheme-expand[aria-expanded="true"] {
    background: var(--hover);
  }

  .scheme-popover {
    position: absolute;
    z-index: 36;
    top: calc(100% + 8px);
    right: 0;
    display: grid;
    width: min(320px, calc(100vw - 20px));
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .scheme-popover-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 12px;
    border-bottom: 1px solid var(--border);
  }

  .scheme-popover-heading strong {
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .scheme-popover-heading span {
    color: var(--muted);
    font-size: 0.7rem;
  }

  .scheme-list {
    display: grid;
    max-height: min(60vh, 420px);
    padding: 6px;
    overflow-y: auto;
  }

  .scheme-list-item {
    display: grid;
    gap: 3px;
    width: 100%;
    padding: 9px 10px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .scheme-list-item:hover {
    background: var(--hover);
  }

  .scheme-list-item.active {
    background: var(--text);
    color: var(--surface);
  }

  .scheme-list-name {
    overflow: hidden;
    font-size: 0.82rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .scheme-list-time {
    color: var(--muted);
    font-size: 0.66rem;
  }

  .scheme-list-item.active .scheme-list-time {
    color: var(--surface);
    opacity: 0.68;
  }

  .scheme-list-empty {
    margin: 0;
    padding: 12px 10px;
    color: var(--muted);
    font-size: 0.78rem;
  }

  .shell-body {
    height: calc(100vh - 62px);
    min-height: 480px;
  }

  .icon-button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: transparent;
    color: var(--text);
    font-size: 1.15rem;
    cursor: pointer;
  }

  .dialog-backdrop {
    position: fixed;
    z-index: 40;
    inset: 0;
    border: 0;
    background: rgba(0, 0, 0, 0.32);
    cursor: default;
  }

  .settings-dialog {
    position: fixed;
    z-index: 41;
    top: 50%;
    left: 50%;
    display: grid;
    gap: 28px;
    width: min(460px, calc(100vw - 32px));
    padding: 28px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
    transform: translate(-50%, -50%);
  }

  .confirm-dialog {
    position: fixed;
    z-index: 41;
    top: 50%;
    left: 50%;
    display: grid;
    gap: 22px;
    width: min(420px, calc(100vw - 32px));
    padding: 28px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
    transform: translate(-50%, -50%);
  }

  .confirm-copy {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.7;
  }

  .delete-error,
  .dialog-error {
    margin: 0;
    color: var(--text);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .rename-form {
    display: grid;
    gap: 10px;
  }

  .rename-form label {
    color: var(--muted);
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .rename-form .confirm-actions {
    padding-top: 12px;
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .dialog-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
  }

  .dialog-heading > div {
    display: flex;
    align-items: start;
    gap: 14px;
  }

  .dialog-heading h2 {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 600;
  }

  .dialog-index {
    padding-top: 5px;
    color: var(--muted);
    font-size: 0.68rem;
    letter-spacing: 0.12em;
  }

  .setting-group {
    display: grid;
    gap: 10px;
  }

  .setting-group h3,
  .storage-note h3 {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .setting-group p,
  .storage-note p {
    margin: 0;
    color: var(--muted);
    font-size: 0.82rem;
    line-height: 1.65;
  }

  .clipboard-limit-field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 92px;
    align-items: center;
    gap: 12px;
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .clipboard-limit-field .field {
    min-height: 36px;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .segmented {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    border: 1px solid var(--border-strong);
  }

  .segmented button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 40px;
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .segmented button + button {
    border-left: 1px solid var(--border-strong);
  }

  .segmented button.active {
    background: var(--text);
    color: var(--surface);
  }

  .storage-note {
    display: grid;
    gap: 8px;
    padding-top: 22px;
    border-top: 1px solid var(--border);
  }

  @media (max-width: 760px) {
    .topbar {
      height: auto;
      min-height: 58px;
      padding: 8px 10px;
      gap: 8px;
    }

    .topbar-left {
      min-width: 0;
      gap: 8px;
    }

    .clipboard-popover {
      position: fixed;
      top: 54px;
      left: 10px;
      width: calc(100vw - 20px);
    }

    .scheme-label {
      display: none;
    }

    .scheme-area {
      min-width: 0;
    }

    .scheme-name {
      max-width: 120px;
    }

    .shell-body {
      height: calc(100vh - 59px);
    }
  }
</style>
