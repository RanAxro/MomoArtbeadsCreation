<script lang="ts">
  import { tick } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { countFilledCells } from '$domain/project';
  import Icon from '$lib/components/Icon.svelte';
  import ProjectPreview from '$lib/components/ProjectPreview.svelte';
  import { beadShapeLabelKey } from '$model/bead-shape.model';
  import { IconName } from '$model/icon.model';
  import {
    MAX_PROJECT_NAME_LENGTH,
    type BeadProject
  } from '$model/project.model';
  import {
    decodeShareCode,
    type BoardTransferData
  } from '$modules/board/board-codec';
  import { createProjectFromShareCodeData } from '$modules/workspace/share-code-import';

  interface Props {
    open: boolean;
    onclose: () => void;
    onimported: (project: BeadProject) => void;
  }

  const PARSE_DEBOUNCE_MS = 320;

  let { open, onclose, onimported }: Props = $props();
  let inputValue = $state('');
  let parsedData = $state<BoardTransferData | null>(null);
  let parseError = $state('');
  let pasteError = $state('');
  let confirmError = $state('');
  let schemeName = $state('');
  let parsing = $state(false);
  let pasting = $state(false);
  let creating = $state(false);
  let inputElement: HTMLTextAreaElement | undefined = $state();
  let parseTimer: ReturnType<typeof setTimeout> | undefined;
  let parseRequest = 0;

  let beadCount = $derived(
    parsedData ? countFilledCells(parsedData.cells) : 0
  );
  let usedColorCount = $derived.by(() => {
    if (!parsedData) {
      return 0;
    }
    const usage = new Set(
      parsedData.cells.filter((cell) => cell !== 0)
    );
    return Math.min(usage.size, parsedData.palette.colors.length);
  });

  function cancelPendingParse(): void {
    parseRequest += 1;
    if (parseTimer) {
      clearTimeout(parseTimer);
      parseTimer = undefined;
    }
  }

  function resetDialog(): void {
    cancelPendingParse();
    inputValue = '';
    parsedData = null;
    parseError = '';
    pasteError = '';
    confirmError = '';
    schemeName = '';
    parsing = false;
    pasting = false;
    creating = false;
    void tick().then(() => inputElement?.focus());
  }

  function scheduleParse(): void {
    cancelPendingParse();
    const request = parseRequest;
    parsedData = null;
    parseError = '';
    pasteError = '';
    confirmError = '';
    schemeName = '';

    if (!inputValue.trim()) {
      parsing = false;
      return;
    }

    parsing = true;
    parseTimer = setTimeout(() => {
      parseTimer = undefined;
      void parseInput(request);
    }, PARSE_DEBOUNCE_MS);
  }

  async function parseInput(request: number): Promise<void> {
    try {
      const data = await decodeShareCode(inputValue);
      if (request !== parseRequest) {
        return;
      }
      parsedData = data;
      schemeName = data.name;
    } catch {
      if (request !== parseRequest) {
        return;
      }
      parsedData = null;
      parseError = $_('shareCode.parseError');
    } finally {
      if (request === parseRequest) {
        parsing = false;
      }
    }
  }

  async function pasteFromClipboard(): Promise<void> {
    if (pasting || creating) {
      return;
    }

    pasteError = '';
    if (!navigator.clipboard?.readText) {
      pasteError = $_('shareCode.pasteError');
      return;
    }

    pasting = true;
    try {
      inputValue = await navigator.clipboard.readText();
      scheduleParse();
      await tick();
      inputElement?.focus();
    } catch {
      pasteError = $_('shareCode.pasteError');
    } finally {
      pasting = false;
    }
  }

  async function confirmImport(): Promise<void> {
    if (
      !parsedData ||
      parsing ||
      pasting ||
      creating ||
      !schemeName.trim()
    ) {
      return;
    }

    creating = true;
    confirmError = '';
    try {
      const project = await createProjectFromShareCodeData(
        {
          ...$state.snapshot(parsedData),
          name: schemeName.trim()
        }
      );
      onimported(project);
      onclose();
    } catch (error) {
      console.error('Failed to create a scheme from the share code.', error);
      confirmError = $_('shareCode.createError');
    } finally {
      creating = false;
    }
  }

  function closeDialog(): void {
    if (creating) {
      return;
    }
    onclose();
  }

  $effect(() => {
    if (open) {
      resetDialog();
    } else {
      cancelPendingParse();
    }
  });
</script>

<svelte:window
  onkeydown={(event) => {
    if (open && event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
    }
  }}
/>

{#if open}
  <button
    class="dialog-backdrop"
    type="button"
    aria-label={$_('shareCode.close')}
    disabled={creating}
    onclick={closeDialog}
  ></button>
  <div
    class="share-code-dialog"
    role="dialog"
    aria-modal="true"
    aria-label={$_('shareCode.title')}
  >
    <header class="dialog-heading">
      <div>
        <span class="dialog-index">03</span>
        <h2>{$_('shareCode.title')}</h2>
      </div>
      <button
        class="icon-button"
        type="button"
        aria-label={$_('shareCode.close')}
        disabled={creating}
        onclick={closeDialog}
      >
        <Icon name={IconName.Close} size={18} />
      </button>
    </header>

    <form
      onsubmit={(event) => {
        event.preventDefault();
        void confirmImport();
      }}
    >
      <label class="field-label">
        <span>{$_('shareCode.inputLabel')}</span>
        <span class="input-row">
          <textarea
            class="share-code-input"
            bind:this={inputElement}
            bind:value={inputValue}
            rows="4"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder={$_('shareCode.placeholder')}
            aria-invalid={Boolean(parseError)}
            disabled={creating}
            oninput={(event) => {
              inputValue = event.currentTarget.value;
              scheduleParse();
            }}
          ></textarea>
          <button
            class="paste-button"
            type="button"
            title={$_('shareCode.paste')}
            aria-label={$_('shareCode.paste')}
            aria-busy={pasting}
            disabled={pasting || creating}
            onclick={() => void pasteFromClipboard()}
          >
            <Icon name={IconName.Paste} size={19} />
          </button>
        </span>
      </label>

      {#if pasteError}
        <p class="error-message" role="alert">{pasteError}</p>
      {/if}

      {#if parseError}
        <p class="error-message" role="alert">{parseError}</p>
      {:else if parsedData}
        <div class="parse-result" aria-live="polite">
          <article class="preview-result">
            <div class="preview-frame">
              <ProjectPreview
                project={parsedData}
                label={$_('shareCode.preview')}
              />
            </div>
            <div class="scheme-summary">
              <label class="scheme-name-field">
                <span>{$_('shareCode.name')}</span>
                <input
                  class="scheme-name-input"
                  bind:value={schemeName}
                  type="text"
                  maxlength={MAX_PROJECT_NAME_LENGTH}
                  autocomplete="off"
                  aria-invalid={!schemeName.trim()}
                  disabled={creating}
                  oninput={() => {
                    confirmError = '';
                  }}
                />
              </label>
              {#if !schemeName.trim()}
                <p class="name-error" role="alert">
                  {$_('nav.renameRequired')}
                </p>
              {/if}
              <dl>
                <div>
                  <dt>{$_('shareCode.size')}</dt>
                  <dd>{parsedData.width} × {parsedData.height}</dd>
                </div>
                <div>
                  <dt>{$_('beadShape.label')}</dt>
                  <dd>{$_(beadShapeLabelKey(parsedData.beadShape))}</dd>
                </div>
                <div>
                  <dt>{$_('shareCode.artbeads')}</dt>
                  <dd>{beadCount}</dd>
                </div>
                <div>
                  <dt>{$_('shareCode.colors')}</dt>
                  <dd>{usedColorCount}</dd>
                </div>
              </dl>
            </div>
          </article>
        </div>
      {/if}

      {#if confirmError}
        <p class="error-message" role="alert">{confirmError}</p>
      {/if}

      <div class="dialog-actions" class:after-preview={Boolean(parsedData)}>
        <button
          class="button secondary"
          type="button"
          disabled={creating}
          onclick={closeDialog}
        >
          {$_('nav.cancel')}
        </button>
        <button
          class="button primary"
          type="submit"
          disabled={!parsedData ||
            parsing ||
            pasting ||
            creating ||
            !schemeName.trim()}
        >
          {creating ? $_('shareCode.creating') : $_('shareCode.confirm')}
        </button>
      </div>
    </form>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    z-index: 60;
    inset: 0;
    border: 0;
    background: rgba(0, 0, 0, 0.38);
    cursor: default;
  }

  .share-code-dialog {
    --dialog-padding: 26px;
    position: fixed;
    z-index: 61;
    top: 50%;
    left: 50%;
    display: grid;
    gap: 20px;
    width: min(760px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    padding: var(--dialog-padding);
    overflow: auto;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
    transform: translate(-50%, -50%);
  }

  .dialog-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 18px;
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

  .icon-button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 2px;
    background: transparent;
    color: var(--text);
    cursor: pointer;
  }

  .icon-button:hover:not(:disabled) {
    border-color: var(--border-strong);
    background: var(--hover);
  }

  .icon-button:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }

  form {
    display: grid;
    gap: 10px;
  }

  .field-label {
    display: grid;
    gap: 8px;
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .input-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 42px;
    gap: 8px;
  }

  .share-code-input {
    width: 100%;
    min-height: 92px;
    padding: 10px 12px;
    resize: vertical;
    border: 1px solid var(--border-strong);
    border-radius: 2px;
    outline: none;
    background: var(--surface);
    color: var(--text);
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 0.72rem;
    line-height: 1.5;
  }

  .share-code-input:focus {
    border-color: var(--text);
  }

  .share-code-input[aria-invalid='true'] {
    border-color: var(--danger);
  }

  .paste-button {
    display: grid;
    place-items: center;
    align-self: start;
    width: 42px;
    height: 42px;
    padding: 0;
    border: 1px solid var(--border-strong);
    border-radius: 2px;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
  }

  .paste-button:hover:not(:disabled) {
    border-color: var(--text);
    background: var(--hover);
  }

  .paste-button:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }

  .error-message {
    margin: 0;
    padding: 11px 12px;
    border: 1px solid var(--border);
    background: var(--stage);
    color: var(--muted);
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .error-message {
    border-color: color-mix(in srgb, var(--danger) 42%, var(--border));
    background: color-mix(in srgb, var(--danger) 7%, var(--surface));
    color: var(--danger);
    font-weight: 700;
  }

  .preview-result {
    display: grid;
    grid-template-columns: minmax(190px, 260px) minmax(0, 1fr);
    gap: 20px;
    align-items: center;
    padding: 14px;
    border: 1px solid var(--border);
    background: var(--stage);
  }

  .preview-frame {
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--border-strong);
  }

  .preview-frame :global(.preview) {
    border-radius: 0;
  }

  .scheme-summary {
    min-width: 0;
  }

  .scheme-name-field {
    display: grid;
    gap: 7px;
    margin-bottom: 14px;
    color: var(--muted);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.12em;
  }

  .scheme-name-input {
    width: 100%;
    min-height: 42px;
    padding: 0 11px;
    border: 1px solid var(--border-strong);
    border-radius: 2px;
    outline: none;
    background: var(--surface);
    color: var(--text);
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: 0;
  }

  .scheme-name-input:focus {
    border-color: var(--text);
  }

  .scheme-name-input[aria-invalid='true'] {
    border-color: var(--danger);
  }

  .name-error {
    margin: -6px 0 12px;
    color: var(--danger);
    font-size: 0.72rem;
    font-weight: 700;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }

  dl > div {
    min-width: 0;
    padding: 8px 10px;
    border-left: 2px solid var(--border-strong);
  }

  dt {
    color: var(--muted);
    font-size: 0.65rem;
  }

  dd {
    margin: 4px 0 0;
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .dialog-actions.after-preview {
    margin-top: calc(var(--dialog-padding) - 10px);
  }

  @media (max-width: 620px) {
    .share-code-dialog {
      --dialog-padding: 20px;
    }

    .preview-result {
      grid-template-columns: minmax(0, 1fr);
    }

    .preview-frame {
      max-width: 280px;
    }

    dl {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
