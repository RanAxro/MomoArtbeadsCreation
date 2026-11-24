<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { _, locale } from 'svelte-i18n';
  import { setAppLocale, type AppLocale } from '$lib/i18n';
  import { themeStore } from '$modules/settings/theme.svelte';
  import { workspace } from '$modules/workspace/workspace.svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
  let fileOpen = $state(false);
  let settingsOpen = $state(false);
  let fileArea: HTMLDivElement | undefined = $state();

  async function openScheme(id: string): Promise<void> {
    fileOpen = false;
    const opened = await workspace.select(id);
    if (opened && page.url.pathname !== '/') {
      await goto('/');
    }
  }

  function closeScheme(event: MouseEvent): void {
    event.stopPropagation();
    workspace.close();
  }

  function changeLocale(nextLocale: AppLocale): void {
    setAppLocale(nextLocale);
  }

  onMount(() => {
    themeStore.initialize();
    void workspace.initialize();

    const closeFloatingMenus = (event: MouseEvent) => {
      if (fileArea && !fileArea.contains(event.target as Node)) {
        fileOpen = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        fileOpen = false;
        settingsOpen = false;
      }
    };

    window.addEventListener('click', closeFloatingMenus);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', closeFloatingMenus);
      window.removeEventListener('keydown', closeOnEscape);
    };
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
              <span>＋</span>
              {$_('file.new')}
            </a>
            <a href="/import" role="menuitem" onclick={() => { fileOpen = false; }}>
              <span>▧</span>
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
                <span>×</span>
                {$_('file.close')}
              </button>
            {/if}
          </div>
        {/if}
      </div>

      <button class="nav-button" type="button" onclick={() => { settingsOpen = true; }}>
        {$_('nav.settings')}
      </button>
    </div>
  </div>

  <div class="scheme-area">
    <span class="scheme-label">{$_('nav.schemes')}</span>
    <div class="scheme-tabs">
      {#if workspace.projects.length === 0}
        <span class="no-schemes">{$_('nav.noSchemes')}</span>
      {/if}
      {#each workspace.projects as scheme (scheme.id)}
        <div class="scheme-tab" class:active={workspace.activeId === scheme.id}>
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
              ×
            </button>
          {/if}
        </div>
      {/each}
    </div>
    <a class="new-tab" href="/new" aria-label={$_('nav.newScheme')} title={$_('nav.newScheme')}>
      ＋
    </a>
  </div>
</header>

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
        ×
      </button>
    </div>

    <div class="setting-group">
      <h3>{$_('settings.appearance')}</h3>
      <p>{$_('settings.theme')}</p>
      <div class="segmented">
        <button
          class:active={themeStore.mode === 'light'}
          type="button"
          onclick={() => themeStore.set('light')}
        >
          ☼ {$_('settings.light')}
        </button>
        <button
          class:active={themeStore.mode === 'dark'}
          type="button"
          onclick={() => themeStore.set('dark')}
        >
          ◐ {$_('settings.dark')}
        </button>
      </div>
    </div>

    <div class="setting-group">
      <h3>{$_('settings.language')}</h3>
      <div class="segmented">
        <button
          class:active={$locale === 'zh-CN'}
          type="button"
          onclick={() => changeLocale('zh-CN')}
        >
          {$_('settings.zh')}
        </button>
        <button
          class:active={$locale === 'en-US'}
          type="button"
          onclick={() => changeLocale('en-US')}
        >
          {$_('settings.en')}
        </button>
      </div>
    </div>

    <div class="storage-note">
      <h3>{$_('settings.storage')}</h3>
      <p>{$_('settings.storageCopy')}</p>
    </div>
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
    width: 16px;
    color: var(--muted);
    text-align: center;
  }

  .scheme-area {
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .scheme-label {
    color: var(--muted);
    font-size: 0.66rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .scheme-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .scheme-tabs::-webkit-scrollbar {
    display: none;
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

  .scheme-close {
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

  .new-tab {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    border: 1px solid var(--border-strong);
    border-radius: 3px;
    color: var(--text);
    text-decoration: none;
  }

  .new-tab:hover {
    background: var(--hover);
  }

  .shell-body {
    height: calc(100vh - 62px);
    min-height: 480px;
  }

  .icon-button {
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

  .segmented {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    border: 1px solid var(--border-strong);
  }

  .segmented button {
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
