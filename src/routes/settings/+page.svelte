<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { _ , locale } from 'svelte-i18n';
  import Icon from '$lib/components/Icon.svelte';
  import { AppLocale, ThemeMode } from '$model/settings.model';
  import {
    MAX_CLIPBOARD_HISTORY_LIMIT,
    MIN_CLIPBOARD_HISTORY_LIMIT
  } from '$model/selection-clipboard.model';
  import { IconName } from '$model/icon.model';
  import {
    createBackupFilename,
    createDatabaseBackup,
    DatabaseBackupError,
    downloadDatabaseBackup,
    importDatabaseBackup
  } from '$lib/data/database-backup';
  import { setAppLocale } from '$lib/i18n';
  import { clipboardStore } from '$modules/clipboard/clipboard-store.svelte';
  import { themeStore } from '$modules/settings/theme.svelte';
  import { workspace } from '$modules/workspace/workspace.svelte';

  type ToastKind = 'success' | 'error';
  type StorageEstimateWithDetails = StorageEstimate & {
    usageDetails?: {
      indexedDB?: number;
    };
  };
  interface StorageUsage {
    indexedDbBytes: number;
    usageBytes: number;
    quotaBytes: number;
    hasIndexedDbDetail: boolean;
  }

  let fileInput: HTMLInputElement | undefined = $state();
  let exporting = $state(false);
  let importing = $state(false);
  let importProgress = $state('');
  let storageUsage = $state<StorageUsage | null>(null);
  let storageUsageLoading = $state(true);
  let storageUsageUnavailable = $state(false);
  let toastMessage = $state('');
  let toastKind = $state<ToastKind>('success');
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let storageUsagePercent = $derived.by(() => {
    if (!storageUsage || storageUsage.quotaBytes <= 0) {
      return 0;
    }
    return Math.min(
      100,
      (storageUsage.indexedDbBytes / storageUsage.quotaBytes) * 100
    );
  });
  let storageAvailableBytes = $derived(
    storageUsage
      ? Math.max(0, storageUsage.quotaBytes - storageUsage.usageBytes)
      : 0
  );

  onMount(() => {
    void workspace.initialize();
    void clipboardStore.initialize();
    void refreshStorageUsage();
  });

  onDestroy(() => {
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
  });

  function showToast(message: string, kind: ToastKind): void {
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastMessage = message;
    toastKind = kind;
    toastTimer = setTimeout(() => {
      toastMessage = '';
      toastTimer = undefined;
    }, 3600);
  }

  function changeLocale(nextLocale: AppLocale): void {
    setAppLocale(nextLocale);
  }

  async function refreshStorageUsage(): Promise<void> {
    storageUsageLoading = true;
    try {
      if (!navigator.storage?.estimate) {
        storageUsage = null;
        storageUsageUnavailable = true;
        return;
      }

      const estimate =
        (await navigator.storage.estimate()) as StorageEstimateWithDetails;
      const usageBytes = estimate.usage ?? 0;
      const quotaBytes = estimate.quota ?? 0;
      const indexedDbBytes =
        estimate.usageDetails?.indexedDB ?? usageBytes;

      storageUsage = {
        indexedDbBytes,
        usageBytes,
        quotaBytes,
        hasIndexedDbDetail:
          typeof estimate.usageDetails?.indexedDB === 'number'
      };
      storageUsageUnavailable = quotaBytes <= 0;
    } catch {
      storageUsage = null;
      storageUsageUnavailable = true;
    } finally {
      storageUsageLoading = false;
    }
  }

  function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const unitIndex = Math.min(
      units.length - 1,
      Math.floor(Math.log(bytes) / Math.log(1024))
    );
    const value = bytes / 1024 ** unitIndex;
    const maximumFractionDigits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toLocaleString($locale ?? AppLocale.ZhCN, {
      maximumFractionDigits
    })} ${units[unitIndex]}`;
  }

  async function exportData(): Promise<void> {
    if (exporting || importing) {
      return;
    }

    exporting = true;
    try {
      await workspace.saveActiveScheme();
      const backup = await createDatabaseBackup();
      downloadDatabaseBackup(backup, createBackupFilename());
      showToast($_('settings.exportSuccess'), 'success');
    } catch {
      showToast($_('settings.exportError'), 'error');
    } finally {
      exporting = false;
    }
  }

  function chooseImportFile(): void {
    if (!importing && !exporting) {
      fileInput?.click();
    }
  }

  async function importData(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || importing || exporting) {
      return;
    }

    importing = true;
    importProgress = $_('settings.importPreparing');
    try {
      await workspace.saveActiveScheme();
      const summary = await importDatabaseBackup(file, {
        clipboardLimit: clipboardStore.limit,
        onProgress: (progress) => {
          if (
            progress.totalRows !== undefined &&
            progress.totalRows > 0
          ) {
            importProgress = $_('settings.importProgress', {
              values: {
                completed: progress.completedRows,
                total: progress.totalRows
              }
            });
          }
        }
      });
      await workspace.refresh();
      await workspace.reloadActiveScheme();
      await clipboardStore.refresh();
      await refreshStorageUsage();
      showToast(
        $_('settings.importSuccess', {
          values: {
            projects: summary.projectsImported,
            clipboards: summary.clipboardsImported
          }
        }),
        'success'
      );
    } catch (error) {
      showToast(importErrorMessage(error), 'error');
    } finally {
      importing = false;
      importProgress = '';
    }
  }

  function importErrorMessage(error: unknown): string {
    if (error instanceof DatabaseBackupError) {
      switch (error.code) {
        case 'wrong-database':
          return $_('settings.importWrongFile');
        case 'invalid-project':
          return $_('settings.importInvalidProject');
        case 'invalid-clipboard':
          return $_('settings.importInvalidClipboard');
        case 'unknown-table':
        case 'invalid-export':
          return $_('settings.importInvalidFile');
      }
    }
    return $_('settings.importError');
  }
</script>

<svelte:head>
  <title>{$_('settings.title')} · {$_('app.name')}</title>
</svelte:head>

<div class="settings-screen">
  <main class="settings-shell">
    <header class="page-heading">
      <div>
        <p class="eyebrow">01 / Settings</p>
        <h1>{$_('settings.title')}</h1>
        <p>{$_('settings.storageCopy')}</p>
      </div>
      <a class="button ghost compact" href="/">
        <Icon name={IconName.ArrowLeft} size={16} />
        {$_('common.backWorkspace')}
      </a>
    </header>

    <div class="settings-grid">
      <section class="settings-card">
        <span class="card-number">01</span>
        <div class="card-content">
          <h2>{$_('settings.appearance')}</h2>
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
      </section>

      <section class="settings-card">
        <span class="card-number">02</span>
        <div class="card-content">
          <h2>{$_('settings.language')}</h2>
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
      </section>

      <section class="settings-card">
        <span class="card-number">03</span>
        <div class="card-content">
          <h2>{$_('settings.clipboard')}</h2>
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
      </section>

      <section class="settings-card backup-card">
        <span class="card-number">04</span>
        <div class="card-content">
          <h2>{$_('settings.backup')}</h2>
          <p>{$_('settings.backupDescription')}</p>
          <div class="storage-usage">
            <div class="storage-usage-heading">
              <span>{$_('settings.storageUsage')}</span>
              {#if storageUsageLoading}
                <strong>{$_('settings.storageUsageLoading')}</strong>
              {:else if storageUsage}
                <strong>{formatBytes(storageUsage.indexedDbBytes)}</strong>
              {:else}
                <strong>{$_('settings.storageUsageUnavailable')}</strong>
              {/if}
            </div>

            {#if storageUsage && !storageUsageLoading}
              <div
                class="storage-meter"
                role="progressbar"
                aria-label={$_('settings.storageUsage')}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={storageUsagePercent}
                aria-valuetext={`${storageUsagePercent.toFixed(1)}%`}
              >
                <span style:width={`${storageUsagePercent}%`}></span>
              </div>
              <div class="storage-usage-meta">
                <span>
                  {$_('settings.storageUsed', {
                    values: {
                      used: `${formatBytes(storageUsage.indexedDbBytes)} (${storageUsagePercent.toFixed(1)}%)`
                    }
                  })}
                </span>
                <span>
                  {$_('settings.storageAvailable', {
                    values: { available: formatBytes(storageAvailableBytes) }
                  })}
                </span>
                <span>
                  {$_('settings.storageQuota', {
                    values: { quota: formatBytes(storageUsage.quotaBytes) }
                  })}
                </span>
              </div>
              {#if !storageUsage.hasIndexedDbDetail}
                <p class="storage-usage-note">
                  {$_('settings.storageUsageApprox')}
                </p>
              {/if}
            {:else if storageUsageUnavailable && !storageUsageLoading}
              <p class="storage-usage-note">
                {$_('settings.storageUsageUnavailable')}
              </p>
            {/if}
          </div>
          <div class="backup-actions">
            <button
              class="button primary"
              type="button"
              disabled={exporting || importing}
              onclick={() => void exportData()}
            >
              {exporting ? $_('settings.exporting') : $_('settings.exportData')}
            </button>
            <button
              class="button secondary"
              type="button"
              disabled={exporting || importing}
              onclick={chooseImportFile}
            >
              {importing ? $_('settings.importing') : $_('settings.importData')}
            </button>
            <input
              class="visually-hidden"
              bind:this={fileInput}
              type="file"
              accept=".json,application/json"
              onchange={importData}
            />
          </div>
          {#if importing && importProgress}
            <p class="import-progress" role="status">{importProgress}</p>
          {/if}
        </div>
      </section>
    </div>
  </main>
</div>

{#if toastMessage}
  <div
    class="toast"
    class:error={toastKind === 'error'}
    role={toastKind === 'error' ? 'alert' : 'status'}
    aria-live="polite"
  >
    {toastMessage}
  </div>
{/if}

<style>
  .settings-screen {
    height: 100%;
    overflow: auto;
  }

  .settings-shell {
    width: min(980px, calc(100% - 40px));
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
    font-size: clamp(2.6rem, 7vw, 5.4rem);
    font-weight: 500;
    line-height: 0.95;
  }

  .page-heading p:not(.eyebrow) {
    max-width: 660px;
    margin-bottom: 0;
    color: var(--muted);
    line-height: 1.7;
  }

  .settings-grid {
    border-top: 1px solid var(--text);
  }

  .settings-card {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 20px;
    padding: 28px 0;
    border-bottom: 1px solid var(--border);
  }

  .card-number {
    padding-top: 4px;
    color: var(--muted);
    font-size: 0.68rem;
    letter-spacing: 0.12em;
  }

  .card-content {
    display: grid;
    gap: 12px;
    max-width: 650px;
  }

  .card-content h2 {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .card-content p {
    margin: 0;
    color: var(--muted);
    font-size: 0.82rem;
    line-height: 1.65;
  }

  .segmented {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: 400px;
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

  .clipboard-limit-field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 92px;
    align-items: center;
    gap: 12px;
    max-width: 400px;
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .clipboard-limit-field .field {
    min-height: 36px;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .backup-card {
    border-bottom-color: var(--text);
  }

  .storage-usage {
    display: grid;
    gap: 8px;
    padding: 14px;
    border: 1px solid var(--border);
    background: var(--surface);
  }

  .storage-usage-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    font-size: 0.76rem;
  }

  .storage-usage-heading span {
    color: var(--muted);
    font-weight: 600;
  }

  .storage-usage-heading strong {
    font-size: 0.88rem;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .storage-meter {
    height: 8px;
    overflow: hidden;
    border: 1px solid var(--border-strong);
    background: var(--hover);
  }

  .storage-meter > span {
    display: block;
    height: 100%;
    min-width: 1px;
    background: var(--text);
    transition: width 180ms ease;
  }

  .storage-usage-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    color: var(--muted);
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
  }

  .storage-usage-note {
    font-size: 0.68rem;
  }

  .backup-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 4px;
  }

  .import-progress {
    font-variant-numeric: tabular-nums;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    border: 0;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .toast {
    position: fixed;
    z-index: 70;
    right: 24px;
    bottom: 24px;
    max-width: min(420px, calc(100vw - 32px));
    padding: 12px 16px;
    border: 1px solid var(--border-strong);
    background: var(--surface-raised);
    box-shadow: var(--shadow);
    color: var(--text);
    font-size: 0.82rem;
    line-height: 1.5;
  }

  .toast.error {
    border-color: var(--danger);
    color: var(--danger);
    font-weight: 700;
  }

  @media (max-width: 680px) {
    .settings-shell {
      width: min(100% - 24px, 980px);
      padding: 32px 0 56px;
    }

    .page-heading {
      flex-direction: column;
      gap: 16px;
    }

    .settings-card {
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 8px;
    }

    .toast {
      right: 16px;
      bottom: 16px;
    }
  }
</style>
