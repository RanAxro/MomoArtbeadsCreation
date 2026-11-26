<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import BeadCanvas from '$lib/components/BeadCanvas.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { ARTBEAD_COLORS } from '$model/pegboard.model';
  import {
    AUTO_SAVE_DELAY_MS,
    ColorPickerMode,
    EditorCommandKey,
    EDITOR_TOOL_DEFINITIONS,
    EditorTool
  } from '$model/editor.model';
  import { IconName } from '$model/icon.model';
  import { countBeads, countColorUsage } from '$domain/project';
  import { projectRepository } from '$data/project-repository';
  import {
    MAX_BOARD_ZOOM,
    MIN_BOARD_ZOOM
  } from '$model/editor.model';
  import {
    MAX_MAGIC_WAND_THRESHOLD,
    MIN_MAGIC_WAND_THRESHOLD
  } from '$model/selection.model';
  import { KeyboardKey } from '$model/ui.model';
  import {
    DEFAULT_REFERENCE_IMAGE_COVERAGE,
    REFERENCE_IMAGE_MAX_FILE_BYTES,
    type ReferenceImage
  } from '$model/reference-image.model';
  import { clipboardStore } from '$modules/clipboard/clipboard-store.svelte';
  import { workspace } from '$modules/workspace/workspace.svelte';

  const editor = workspace.editor;
  const MIN_SAVE_PROGRESS_MS = 500;
  const SAVE_SUCCESS_VISIBLE_MS = 2000;
  const REFERENCE_REORDER_HOLD_MS = 280;
  const REFERENCE_REORDER_CANCEL_DISTANCE = 8;
  const REFERENCE_REORDER_SCROLL_EDGE = 28;
  const REFERENCE_REORDER_SCROLL_STEP = 12;

  type SaveFeedback = 'idle' | 'saving' | 'saved' | 'failed';

  let saveFeedback = $state<SaveFeedback>('idle');
  let saveFeedbackRequest = 0;
  let saveFeedbackTimer: ReturnType<typeof setTimeout> | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let referenceOpen = $state(false);
  let referenceDragActive = $state(false);
  let referenceLoading = $state(false);
  let referenceError = $state('');
  let referenceInput: HTMLInputElement | undefined = $state();
  let referenceArea: HTMLDivElement | undefined = $state();
  let referenceList: HTMLDivElement | undefined = $state();
  let magicWandOpen = $state(false);
  let magicWandArea: HTMLDivElement | undefined = $state();
  let colorPickerOpen = $state(false);
  let colorPickerArea: HTMLDivElement | undefined = $state();
  let referenceReorder = $state<{
    pointerId: number;
    referenceId: string;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  let referenceReorderTimer: ReturnType<typeof setTimeout> | undefined;
  let referenceReorderElement: HTMLElement | null = null;

  let hasSelection = $derived(editor.selectedCells.size > 0);
  let clipboardAvailable = $derived(clipboardStore.entries.length > 0);
  let canMoveSelection = $derived(
    hasSelection || editor.activePasteLayer !== null
  );

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

  let isDirty = $derived(
    editor.revision !== editor.savedRevision ||
      editor.activePasteLayer !== null
  );

  function beginSaveFeedback(): number {
    const request = ++saveFeedbackRequest;
    if (saveFeedbackTimer) {
      clearTimeout(saveFeedbackTimer);
      saveFeedbackTimer = undefined;
    }
    saveFeedback = 'saving';
    return request;
  }

  function finishSaveFeedback(
    request: number,
    succeeded: boolean
  ): void {
    if (request !== saveFeedbackRequest) {
      return;
    }

    if (!succeeded) {
      saveFeedback = 'failed';
      return;
    }

    saveFeedback = 'saved';
    saveFeedbackTimer = setTimeout(() => {
      if (request === saveFeedbackRequest) {
        saveFeedback = 'idle';
        saveFeedbackTimer = undefined;
      }
    }, SAVE_SUCCESS_VISIBLE_MS);
  }

  async function persist(): Promise<void> {
    if (!editor.project) {
      return;
    }

    const request = beginSaveFeedback();
    const startedAt = Date.now();
    let succeeded = true;

    try {
      if (isDirty) {
        const snapshot = editor.toSnapshot();
        const revision = editor.revision;
        if (!snapshot) {
          succeeded = false;
        } else {
          await projectRepository.save(snapshot);
          editor.markSaved(revision);
          workspace.updateProjectSummary(snapshot);
        }
      }
    } catch {
      succeeded = false;
    }

    const remainingProgress =
      MIN_SAVE_PROGRESS_MS - (Date.now() - startedAt);
    if (remainingProgress > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingProgress));
    }
    finishSaveFeedback(request, succeeded);
  }

  function scheduleSave(): void {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      void persist();
    }, AUTO_SAVE_DELAY_MS);
  }

  function saveNow(): void {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    void persist();
  }

  async function refreshClipboardState(): Promise<void> {
    try {
      await clipboardStore.refresh();
    } catch {
      clipboardStore.entries = [];
    }
  }

  async function copySelection(): Promise<void> {
    const clipboard = editor.createSelectionClipboard();
    if (!clipboard) {
      return;
    }

    try {
      await clipboardStore.copy(clipboard);
    } catch {
      clipboardStore.entries = [];
    }
  }

  async function pasteSelection(): Promise<void> {
    await clipboardStore.initialize();
    const clipboard = clipboardStore.entries[0];
    if (!clipboard || !editor.pasteSelectionClipboard(clipboard)) {
      return;
    }
    await clipboardStore.use(clipboard.id);
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Invalid image data.'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('Read failed.'));
      reader.readAsDataURL(file);
    });
  }

  function imageDimensions(
    dataUrl: string
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
          reject(new Error('Invalid image dimensions.'));
          return;
        }
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight
        });
      };
      image.onerror = () => reject(new Error('Image decode failed.'));
      image.src = dataUrl;
    });
  }

  async function importReferenceImage(file: File): Promise<void> {
    if (!editor.project || referenceLoading) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      referenceError = $_('reference.invalidFile');
      return;
    }
    if (file.size > REFERENCE_IMAGE_MAX_FILE_BYTES) {
      referenceError = $_('reference.fileTooLarge');
      return;
    }

    referenceLoading = true;
    referenceError = '';
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const dimensions = await imageDimensions(dataUrl);
      const project = editor.project;
      if (!project) {
        return;
      }

      const aspectRatio = dimensions.width / dimensions.height;
      let width = project.width * DEFAULT_REFERENCE_IMAGE_COVERAGE;
      let height = width / aspectRatio;
      const maxHeight = project.height * DEFAULT_REFERENCE_IMAGE_COVERAGE;
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }

      const reference: ReferenceImage = {
        id: crypto.randomUUID(),
        name: file.name.trim() || $_('reference.defaultName'),
        dataUrl,
        width,
        height,
        centerX: project.width / 2,
        centerY: project.height / 2,
        rotation: 0
      };
      editor.addReferenceImage(reference);
      cancelReferenceReorder();
      referenceOpen = false;
      magicWandOpen = false;
      colorPickerOpen = false;
    } catch {
      referenceError = $_('reference.readError');
    } finally {
      referenceLoading = false;
      if (referenceInput) {
        referenceInput.value = '';
      }
    }
  }

  function chooseReferenceImage(): void {
    if (!referenceLoading) {
      referenceInput?.click();
    }
  }

  function selectReferenceImage(id: string): void {
    cancelReferenceReorder();
    if (editor.selectReferenceImage(id)) {
      referenceOpen = false;
      magicWandOpen = false;
      colorPickerOpen = false;
    }
  }

  function toggleColorPicker(): void {
    cancelReferenceReorder();
    referenceOpen = false;
    magicWandOpen = false;
    referenceError = '';
    editor.clearReferenceImageSelection();
    colorPickerOpen = !colorPickerOpen;
  }

  function activateColorPicker(mode: ColorPickerMode): void {
    cancelReferenceReorder();
    referenceOpen = false;
    magicWandOpen = false;
    colorPickerOpen = false;
    referenceError = '';
    editor.setColorPickerMode(mode);
  }

  function removeReferenceImage(id: string): void {
    editor.removeReferenceImage(id);
  }

  function cancelReferenceReorder(): void {
    if (referenceReorderTimer) {
      clearTimeout(referenceReorderTimer);
      referenceReorderTimer = undefined;
    }
    const reorder = referenceReorder;
    const element = referenceReorderElement;
    referenceReorder = null;
    referenceReorderElement = null;
    if (
      element &&
      reorder &&
      element.hasPointerCapture(reorder.pointerId)
    ) {
      element.releasePointerCapture(reorder.pointerId);
    }
  }

  function beginReferenceReorder(
    event: PointerEvent,
    referenceId: string
  ): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    cancelReferenceReorder();
    if (!referenceList) {
      return;
    }
    referenceList.setPointerCapture(event.pointerId);
    referenceReorderElement = referenceList;
    referenceReorder = {
      pointerId: event.pointerId,
      referenceId,
      startX: event.clientX,
      startY: event.clientY,
      active: false
    };
    referenceReorderTimer = setTimeout(() => {
      referenceReorderTimer = undefined;
      if (
        referenceReorder?.pointerId !== event.pointerId ||
        referenceReorder.referenceId !== referenceId
      ) {
        return;
      }
      referenceReorder = {
        ...referenceReorder,
        active: true
      };
      editor.selectReferenceImage(referenceId);
    }, REFERENCE_REORDER_HOLD_MS);
  }

  function updateReferenceReorder(event: PointerEvent): void {
    const reorder = referenceReorder;
    if (!reorder || reorder.pointerId !== event.pointerId) {
      return;
    }

    if (!reorder.active) {
      if (
        Math.hypot(
          event.clientX - reorder.startX,
          event.clientY - reorder.startY
        ) > REFERENCE_REORDER_CANCEL_DISTANCE
      ) {
        cancelReferenceReorder();
      }
      return;
    }

    event.preventDefault();
    if (!referenceList) {
      return;
    }

    const listRect = referenceList.getBoundingClientRect();
    if (event.clientY < listRect.top + REFERENCE_REORDER_SCROLL_EDGE) {
      referenceList.scrollTop -= REFERENCE_REORDER_SCROLL_STEP;
    } else if (
      event.clientY >
      listRect.bottom - REFERENCE_REORDER_SCROLL_EDGE
    ) {
      referenceList.scrollTop += REFERENCE_REORDER_SCROLL_STEP;
    }

    const items = Array.from(
      referenceList.querySelectorAll<HTMLElement>(
        '.reference-item[data-reference-id]'
      )
    );
    let insertionIndex = items.findIndex((item) => {
      const rect = item.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    if (insertionIndex < 0) {
      insertionIndex = items.length;
    }

    const currentIndex = editor.referenceImages.findIndex(
      (reference) => reference.id === reorder.referenceId
    );
    if (currentIndex < 0) {
      cancelReferenceReorder();
      return;
    }
    const targetIndex =
      insertionIndex > currentIndex ? insertionIndex - 1 : insertionIndex;
    editor.moveReferenceImage(reorder.referenceId, targetIndex);
  }

  function finishReferenceReorder(event: PointerEvent): void {
    if (referenceReorder?.pointerId !== event.pointerId) {
      return;
    }
    updateReferenceReorder(event);
    cancelReferenceReorder();
  }

  function onReferenceDrop(event: DragEvent): void {
    event.preventDefault();
    referenceDragActive = false;
    const file = event.dataTransfer?.files[0];
    if (file) {
      void importReferenceImage(file);
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, select') || target?.isContentEditable) {
      return;
    }

    const command = event.ctrlKey || event.metaKey;
    if (
      !command &&
      (event.key === KeyboardKey.Delete ||
        event.key === KeyboardKey.Backspace) &&
      editor.selectedCells.size > 0 &&
      !referenceOpen &&
      !editor.selectedReferenceImageId
    ) {
      event.preventDefault();
      editor.deleteSelection();
      return;
    }
    if (command && event.key.toLowerCase() === EditorCommandKey.Copy) {
      if (editor.project && editor.selectedCells.size > 0) {
        event.preventDefault();
        void copySelection();
      }
      return;
    }
    if (command && event.key.toLowerCase() === EditorCommandKey.Paste) {
      if (editor.project) {
        event.preventDefault();
        void pasteSelection();
      }
      return;
    }
    if (command && event.key.toLowerCase() === EditorCommandKey.Undo) {
      event.preventDefault();
      event.shiftKey ? editor.redo() : editor.undo();
      return;
    }
    if (command && event.key.toLowerCase() === EditorCommandKey.Redo) {
      event.preventDefault();
      editor.redo();
      return;
    }
    if (command && event.key.toLowerCase() === EditorCommandKey.Save) {
      event.preventDefault();
      saveNow();
      return;
    }

    const tool = EDITOR_TOOL_DEFINITIONS.find(
      (candidate) => candidate.shortcut.toLowerCase() === event.key.toLowerCase()
    );
    if (tool) {
      cancelReferenceReorder();
      referenceOpen = false;
      magicWandOpen = false;
      colorPickerOpen = false;
      referenceError = '';
      editor.setTool(tool.id);
    }
  }

  $effect(() => {
    editor.revision;
    editor.savedRevision;
    if (!editor.project) {
      cancelReferenceReorder();
      referenceOpen = false;
      magicWandOpen = false;
      colorPickerOpen = false;
    }
    if (editor.project && editor.revision !== editor.savedRevision) {
      scheduleSave();
    }
  });

  onMount(() => {
    void workspace.initialize();
    void clipboardStore.initialize();
    const refreshClipboardOnFocus = (): void => {
      void refreshClipboardState();
    };
    const closePopovers = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (
        referenceOpen &&
        referenceArea &&
        !referenceArea.contains(target)
      ) {
        cancelReferenceReorder();
        referenceOpen = false;
        referenceError = '';
      }
      if (
        magicWandOpen &&
        magicWandArea &&
        !magicWandArea.contains(target)
      ) {
        magicWandOpen = false;
      }
      if (
        colorPickerOpen &&
        colorPickerArea &&
        !colorPickerArea.contains(target)
      ) {
        colorPickerOpen = false;
      }
    };
    const closePopoversOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && referenceOpen) {
        cancelReferenceReorder();
        referenceOpen = false;
        referenceError = '';
        referenceDragActive = false;
      }
      if (event.key === 'Escape' && magicWandOpen) {
        magicWandOpen = false;
      }
      if (event.key === 'Escape' && colorPickerOpen) {
        colorPickerOpen = false;
      }
    };
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keydown', closePopoversOnEscape);
    window.addEventListener('focus', refreshClipboardOnFocus);
    window.addEventListener('click', closePopovers);
    return () => {
      cancelReferenceReorder();
      window.removeEventListener('keydown', onKeydown);
      window.removeEventListener('keydown', closePopoversOnEscape);
      window.removeEventListener('focus', refreshClipboardOnFocus);
      window.removeEventListener('click', closePopovers);
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      if (saveFeedbackTimer) {
        clearTimeout(saveFeedbackTimer);
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
        <div class="selected-color-info">
          <small>{$_('tray.selected')}</small>
          <strong>{selectedTrayColor.code} · {selectedTrayColor.hex}</strong>
        </div>
        <span class="selected-usage">{usage[editor.selectedColorIndex] ?? 0}</span>
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
            {#each EDITOR_TOOL_DEFINITIONS as tool}
              {#if tool.id === EditorTool.ColorPicker}
                <div
                  class="color-picker-area"
                  bind:this={colorPickerArea}
                  role="group"
                  aria-label={$_('board.colorPicker')}
                >
                  <button
                    class="tool"
                    class:active={editor.tool === EditorTool.ColorPicker}
                    type="button"
                    aria-haspopup="dialog"
                    aria-controls="color-picker-popover"
                    aria-expanded={colorPickerOpen}
                    aria-label={$_('board.colorPicker')}
                    title={`${$_(tool.labelKey)} (${tool.shortcut})`}
                    onclick={toggleColorPicker}
                  >
                    <Icon name={tool.icon} size={18} />
                  </button>

                  {#if colorPickerOpen}
                    <div
                      id="color-picker-popover"
                      class="color-picker-popover"
                      role="dialog"
                      aria-labelledby="color-picker-popover-title"
                    >
                      <strong
                        id="color-picker-popover-title"
                        class="color-picker-popover-title"
                      >
                        {$_('board.colorPicker')}
                      </strong>
                      <button
                        class="color-picker-option"
                        class:active={
                          editor.tool === EditorTool.ColorPicker &&
                          editor.colorPickerMode === ColorPickerMode.Artbead
                        }
                        type="button"
                        aria-pressed={
                          editor.tool === EditorTool.ColorPicker &&
                          editor.colorPickerMode === ColorPickerMode.Artbead
                        }
                        onclick={() =>
                          activateColorPicker(ColorPickerMode.Artbead)}
                      >
                        <span class="color-picker-option-icon">
                          <Icon name={IconName.ColorPicker} size={18} />
                        </span>
                        <span>
                          <strong>{$_('board.colorPickerArtbead')}</strong>
                          <small>
                            {$_('board.colorPickerArtbeadHint')}
                          </small>
                        </span>
                      </button>
                      <button
                        class="color-picker-option"
                        class:active={
                          editor.tool === EditorTool.ColorPicker &&
                          editor.colorPickerMode === ColorPickerMode.Reference
                        }
                        type="button"
                        aria-pressed={
                          editor.tool === EditorTool.ColorPicker &&
                          editor.colorPickerMode === ColorPickerMode.Reference
                        }
                        onclick={() =>
                          activateColorPicker(ColorPickerMode.Reference)}
                      >
                        <span class="color-picker-option-icon">
                          <Icon name={IconName.Image} size={18} />
                        </span>
                        <span>
                          <strong>{$_('board.colorPickerReference')}</strong>
                          <small>
                            {editor.referenceImages.length > 0
                              ? $_('board.colorPickerReferenceHint')
                              : $_('board.colorPickerNoReference')}
                          </small>
                        </span>
                      </button>
                    </div>
                  {/if}
                </div>
              {:else if tool.id === EditorTool.MagicWand}
                <div
                  class="magic-wand-area"
                  bind:this={magicWandArea}
                >
                  <button
                    class="tool"
                    class:active={
                      editor.tool === tool.id &&
                      !referenceOpen &&
                      !editor.selectedReferenceImageId
                    }
                    type="button"
                    aria-haspopup="dialog"
                    aria-controls="magic-wand-popover"
                    aria-expanded={magicWandOpen}
                    title={`${$_(tool.labelKey)} (${tool.shortcut})`}
                    aria-label={$_(tool.labelKey)}
                    aria-pressed={
                      editor.tool === tool.id &&
                      !referenceOpen &&
                      !editor.selectedReferenceImageId
                    }
                    onclick={() => {
                      const alreadyActive = editor.tool === tool.id;
                      cancelReferenceReorder();
                      referenceOpen = false;
                      colorPickerOpen = false;
                      referenceError = '';
                      editor.setTool(tool.id);
                      magicWandOpen = alreadyActive
                        ? !magicWandOpen
                        : true;
                    }}
                  >
                    <Icon name={tool.icon} size={18} />
                  </button>

                  {#if magicWandOpen}
                    <div
                      id="magic-wand-popover"
                      class="magic-wand-popover"
                      role="dialog"
                      aria-labelledby="magic-wand-popover-title"
                    >
                      <div class="magic-wand-popover-heading">
                        <strong id="magic-wand-popover-title">
                          {$_('board.magicWandThreshold')}
                        </strong>
                        <output for="magic-wand-threshold">
                          {editor.magicWandThreshold}%
                        </output>
                      </div>
                      <input
                        id="magic-wand-threshold"
                        type="range"
                        min={MIN_MAGIC_WAND_THRESHOLD}
                        max={MAX_MAGIC_WAND_THRESHOLD}
                        step="1"
                        value={editor.magicWandThreshold}
                        aria-label={$_('board.magicWandThreshold')}
                        oninput={(event) =>
                          editor.setMagicWandThreshold(
                            Number((event.currentTarget as HTMLInputElement).value)
                          )}
                      />
                    </div>
                  {/if}
                </div>
              {:else}
                <button
                  class="tool"
                  class:active={
                    editor.tool === tool.id &&
                    !referenceOpen &&
                    !editor.selectedReferenceImageId
                  }
                  type="button"
                  title={`${$_(tool.labelKey)} (${tool.shortcut})`}
                  aria-label={$_(tool.labelKey)}
                  aria-pressed={
                    editor.tool === tool.id &&
                    !referenceOpen &&
                    !editor.selectedReferenceImageId
                  }
                  disabled={
                    tool.id === EditorTool.Move &&
                    !canMoveSelection
                  }
                  onclick={() => {
                    cancelReferenceReorder();
                    referenceOpen = false;
                    magicWandOpen = false;
                    colorPickerOpen = false;
                    referenceError = '';
                    editor.setTool(tool.id);
                  }}
                >
                  <Icon name={tool.icon} size={18} />
                </button>
              {/if}
            {/each}
            <div
              class="reference-area"
              bind:this={referenceArea}
              role="group"
              aria-label={$_('reference.title')}
              ondragenter={(event) => {
                event.preventDefault();
                referenceDragActive = true;
              }}
              ondragover={(event) => {
                event.preventDefault();
                referenceDragActive = true;
              }}
              ondragleave={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null
                  )
                ) {
                  referenceDragActive = false;
                }
              }}
              ondrop={onReferenceDrop}
            >
              <button
                class="tool reference-tool"
                class:active={referenceOpen || Boolean(editor.selectedReferenceImageId)}
                type="button"
                aria-haspopup="dialog"
                aria-controls="reference-popover"
                aria-expanded={referenceOpen}
                aria-label={$_('reference.button')}
                title={$_('reference.hint')}
                onclick={() => {
                  referenceOpen = !referenceOpen;
                  magicWandOpen = false;
                  colorPickerOpen = false;
                  referenceError = '';
                }}
              >
                <Icon name={IconName.Image} size={18} />
              </button>

              <input
                class="reference-file-input"
                bind:this={referenceInput}
                type="file"
                accept="image/*"
                onchange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) {
                    void importReferenceImage(file);
                  } else if (referenceInput) {
                    referenceInput.value = '';
                  }
                }}
              />

              {#if referenceOpen}
                <div
                  id="reference-popover"
                  class="reference-popover"
                  class:dragging={referenceDragActive}
                  role="dialog"
                  aria-label={$_('reference.title')}
                >
                  <button
                    class="reference-import"
                    type="button"
                    disabled={referenceLoading}
                    onclick={chooseReferenceImage}
                  >
                    <span class="reference-import-icon">
                      <Icon name={IconName.Plus} size={17} />
                    </span>
                    <span>
                      <strong>
                        {referenceLoading
                          ? $_('reference.loading')
                          : $_('reference.import')}
                      </strong>
                      <small>{$_('reference.dropHint')}</small>
                    </span>
                  </button>

                  {#if referenceDragActive}
                    <div class="reference-drop-active">
                      {$_('reference.dropActive')}
                    </div>
                  {/if}

                  {#if referenceError}
                    <p class="reference-error" role="alert">
                      {referenceError}
                    </p>
                  {/if}

                  <div
                    class="reference-list"
                    bind:this={referenceList}
                    role="list"
                    aria-label={$_('reference.title')}
                    onpointermove={updateReferenceReorder}
                    onpointerup={finishReferenceReorder}
                    onpointercancel={cancelReferenceReorder}
                    onlostpointercapture={cancelReferenceReorder}
                  >
                    {#if editor.referenceImages.length === 0}
                      <p class="reference-empty">{$_('reference.empty')}</p>
                    {/if}
                    {#each editor.referenceImages as reference, index (reference.id)}
                      <div
                        class="reference-item"
                        role="listitem"
                        class:active={editor.selectedReferenceImageId === reference.id}
                        class:reordering={
                          referenceReorder?.referenceId === reference.id &&
                          referenceReorder.active
                        }
                        data-reference-id={reference.id}
                      >
                        <button
                          class="reference-select"
                          type="button"
                          aria-pressed={editor.selectedReferenceImageId === reference.id}
                          onclick={() => selectReferenceImage(reference.id)}
                        >
                          <span class="reference-thumb">
                            <img src={reference.dataUrl} alt="" />
                          </span>
                          <span class="reference-name">
                            <strong>{reference.name}</strong>
                            {#if index === 0}
                              <small>{$_('reference.newest')}</small>
                            {/if}
                          </span>
                        </button>
                        <button
                          class="reference-drag"
                          type="button"
                          title={$_('reference.reorder')}
                          aria-label={$_('reference.reorderNamed', {
                            values: { name: reference.name }
                          })}
                          onpointerdown={(event) =>
                            beginReferenceReorder(event, reference.id)}
                          oncontextmenu={(event) => event.preventDefault()}
                        >
                          <Icon name={IconName.Move} size={14} />
                        </button>
                        <button
                          class="reference-remove"
                          type="button"
                          title={$_('reference.remove')}
                          aria-label={$_('reference.removeNamed', {
                            values: { name: reference.name }
                          })}
                          onclick={() => removeReferenceImage(reference.id)}
                        >
                          <Icon name={IconName.Close} size={14} />
                        </button>
                      </div>
                    {/each}
                  </div>

                </div>
              {/if}
            </div>
            <span class="tool-divider"></span>
            <button
              class="tool"
              type="button"
              title={`${$_('board.copySelection')} (Ctrl+C)`}
              aria-label={$_('board.copySelection')}
              disabled={!hasSelection}
              onclick={() => void copySelection()}
            >
              <Icon name={IconName.Copy} size={18} />
            </button>
            <button
              class="tool"
              type="button"
              title={`${$_('board.pasteSelection')} (Ctrl+V)`}
              aria-label={$_('board.pasteSelection')}
              disabled={!clipboardAvailable}
              onclick={() => void pasteSelection()}
            >
              <Icon name={IconName.Paste} size={18} />
            </button>
            <span class="tool-divider"></span>
            <button
              class="tool"
              type="button"
              title={$_('board.undo')}
              aria-label={$_('board.undo')}
              disabled={!editor.canUndo}
              onclick={() => editor.undo()}
            >
              <Icon name={IconName.Undo} size={18} />
            </button>
            <button
              class="tool"
              type="button"
              title={$_('board.redo')}
              aria-label={$_('board.redo')}
              disabled={!editor.canRedo}
              onclick={() => editor.redo()}
            >
              <Icon name={IconName.Redo} size={18} />
            </button>
          </div>

          <div class="save-state">
            <span class="visually-hidden" aria-live="polite">
              {#if saveFeedback === 'saving'}
                {$_('board.saving')}
              {:else if saveFeedback === 'saved'}
                {$_('board.saved')}
              {:else if saveFeedback === 'failed'}
                {$_('board.error')}
              {/if}
            </span>
            <button
              class="button compact secondary save-button"
              class:error={saveFeedback === 'failed'}
              type="button"
              title={saveFeedback === 'saving'
                ? $_('board.saving')
                : saveFeedback === 'saved'
                  ? $_('board.saved')
                  : saveFeedback === 'failed'
                    ? $_('board.error')
                    : $_('board.save')}
              aria-label={$_('board.save')}
              aria-busy={saveFeedback === 'saving'}
              onclick={saveNow}
            >
              <span>{$_('board.save')}</span>
              <span class="save-icon" aria-hidden="true">
                {#if saveFeedback === 'saving'}
                  <span class="save-progress"></span>
                {:else if saveFeedback === 'saved'}
                  <Icon name={IconName.Check} size={16} />
                {:else if saveFeedback === 'failed'}
                  <Icon name={IconName.Close} size={16} />
                {:else}
                  <Icon name={IconName.Save} size={16} />
                {/if}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div class="board-surface">
        <BeadCanvas
          {editor}
          referenceMode={referenceOpen ||
            Boolean(editor.selectedReferenceImageId)}
        />
      </div>

      <footer class="board-footer">
        <span>
          {editor.tool === EditorTool.ColorSelect
            ? $_('board.colorSelectionHint')
            : editor.tool === EditorTool.MagicWand
              ? $_('board.magicWandHint')
              : editor.tool === EditorTool.Select
                ? $_('board.selectionHint')
                : editor.tool === EditorTool.Move
                  ? $_('board.moveHint')
                  : editor.tool === EditorTool.ColorPicker
                    ? editor.colorPickerMode === ColorPickerMode.Reference
                      ? $_('board.colorPickerReferenceHint')
                      : $_('board.colorPickerArtbeadHint')
                    : editor.tool === EditorTool.Fill
                      ? $_('board.fillHint')
                      : $_('board.hint')}
        </span>
        <div class="zoom-control">
          <label for="board-zoom">{$_('board.zoom')}</label>
          <div class="zoom-slider">
            <input
              id="board-zoom"
              type="range"
              min={MIN_BOARD_ZOOM}
              max={MAX_BOARD_ZOOM}
              step="0.05"
              value={editor.zoom}
              aria-label={$_('board.zoom')}
              oninput={(event) =>
                editor.setZoom(Number((event.currentTarget as HTMLInputElement).value))}
            />
          </div>
          <output for="board-zoom">{Math.round(editor.zoom * 100)}%</output>
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
    {:else}
      <section class="workspace-home">
        <div class="home-index" aria-hidden="true">00 / Pegboard</div>
        <h1 class="home-image">
          <img src="/home.webp" alt={$_('app.name')} width="37" height="37" />
        </h1>
        <p class="eyebrow">{$_('home.eyebrow')}</p>
        <p>{$_('home.description')}</p>
        <div class="quick-actions">
          <a class="button primary" href="/new">
            <Icon name={IconName.Plus} size={17} />
            {$_('home.new')}
          </a>
          <a class="button secondary" href="/import">
            <Icon name={IconName.Image} size={17} />
            {$_('home.import')}
          </a>
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

  .selected-color-info {
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

  .selected-usage {
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

  .reference-area {
    position: relative;
    display: flex;
  }

  .magic-wand-area {
    position: relative;
    display: flex;
    align-items: center;
  }

  .color-picker-area {
    position: relative;
    display: flex;
    align-items: center;
  }

  .magic-wand-popover {
    position: absolute;
    z-index: 26;
    top: calc(100% + 9px);
    left: 0;
    display: grid;
    gap: 10px;
    width: min(280px, calc(100vw - 20px));
    padding: 12px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .magic-wand-popover-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .magic-wand-popover-heading strong {
    font-size: 0.76rem;
    font-weight: 600;
  }

  .magic-wand-popover-heading output {
    color: var(--muted);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
  }

  .magic-wand-popover input {
    width: 100%;
    height: 18px;
    margin: 0;
    accent-color: var(--text);
    cursor: pointer;
  }

  .color-picker-popover {
    position: absolute;
    z-index: 27;
    top: calc(100% + 9px);
    left: 0;
    display: grid;
    gap: 5px;
    width: min(310px, calc(100vw - 20px));
    padding: 8px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .color-picker-popover-title {
    padding: 4px 6px 6px;
    font-size: 0.72rem;
    font-weight: 600;
  }

  .color-picker-option {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: 58px;
    padding: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .color-picker-option:hover {
    border-color: var(--border);
    background: var(--hover);
  }

  .color-picker-option.active {
    border-color: var(--text);
  }

  .color-picker-option-icon {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--border-strong);
  }

  .color-picker-option > span:last-child {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .color-picker-option strong {
    font-size: 0.78rem;
    font-weight: 600;
  }

  .color-picker-option small {
    color: var(--muted);
    font-size: 0.66rem;
    line-height: 1.45;
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

  .reference-tool {
    width: 34px;
    padding: 0;
  }

  .reference-file-input {
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

  .reference-popover {
    position: absolute;
    z-index: 25;
    top: calc(100% + 9px);
    right: 0;
    display: grid;
    width: min(330px, calc(100vw - 20px));
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .reference-popover.dragging {
    outline: 2px solid var(--selection);
    outline-offset: -2px;
  }

  .reference-import {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: 58px;
    padding: 9px 10px;
    border: 0;
    border-bottom: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .reference-import:hover:not(:disabled) {
    background: var(--hover);
  }

  .reference-import:disabled {
    cursor: wait;
    opacity: 0.68;
  }

  .reference-import-icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--border-strong);
  }

  .reference-import > span:last-child {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .reference-import strong {
    font-size: 0.8rem;
    font-weight: 600;
  }

  .reference-import small {
    color: var(--muted);
    font-size: 0.66rem;
    line-height: 1.4;
  }

  .reference-drop-active {
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--selection-fill);
    color: var(--selection);
    font-size: 0.72rem;
    font-weight: 700;
    text-align: center;
  }

  .reference-error {
    margin: 0;
    padding: 9px 10px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1.5;
  }

  .reference-list {
    display: grid;
    max-height: min(46vh, 330px);
    overflow-y: auto;
    padding: 6px;
  }

  .reference-empty {
    margin: 0;
    padding: 14px 9px;
    color: var(--muted);
    font-size: 0.76rem;
  }

  .reference-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 30px 30px;
    align-items: stretch;
    border: 1px solid transparent;
    transition:
      border-color 120ms ease,
      background-color 120ms ease,
      transform 120ms ease;
  }

  .reference-item:hover {
    border-color: var(--border);
  }

  .reference-item.active {
    border-color: var(--text);
  }

  .reference-item.reordering {
    z-index: 1;
    border-color: var(--selection);
    background: var(--selection-fill);
    box-shadow: var(--shadow);
    transform: scale(1.01);
  }

  .reference-select {
    display: grid;
    grid-template-columns: 54px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-width: 0;
    min-height: 62px;
    padding: 7px;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .reference-select:hover {
    background: var(--hover);
  }

  .reference-thumb {
    display: grid;
    place-items: center;
    width: 54px;
    height: 46px;
    overflow: hidden;
    border: 1px solid var(--border);
    background:
      linear-gradient(45deg, var(--board-checker-light) 25%, transparent 25%),
      linear-gradient(-45deg, var(--board-checker-light) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, var(--board-checker-light) 75%),
      linear-gradient(-45deg, transparent 75%, var(--board-checker-light) 75%),
      var(--board-checker-dark);
    background-position: 0 0, 0 4px, 4px -4px, -4px 0;
    background-size: 8px 8px;
  }

  .reference-thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .reference-name {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .reference-name strong {
    overflow: hidden;
    font-size: 0.76rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reference-name small {
    color: var(--muted);
    font-size: 0.6rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .reference-drag,
  .reference-remove {
    display: grid;
    place-items: center;
    width: 30px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .reference-drag {
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .reference-drag:active {
    cursor: grabbing;
  }

  .reference-drag:hover,
  .reference-remove:hover {
    background: var(--hover);
    color: var(--text);
  }

  .tool-divider {
    width: 1px;
    height: 22px;
    margin: 0 4px;
    background: var(--border);
  }

  .save-state {
    flex: 0 0 auto;
  }

  .save-button {
    padding: 8px;
  }

  .save-button.error {
    border-color: var(--text);
  }

  .save-icon {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
  }

  .save-progress {
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: save-progress-spin 700ms linear infinite;
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

  @keyframes save-progress-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .board-surface {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--stage);
  }

  .board-footer {
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

  .board-footer > span {
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

  .zoom-slider {
    position: relative;
    display: flex;
    align-items: center;
    width: 132px;
    height: 18px;
  }

  .zoom-control input {
    width: 100%;
    height: 18px;
    margin: 0;
    accent-color: var(--text);
    cursor: pointer;
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
    font-size: 0.9rem;
    line-height: 1;
    cursor: pointer;
  }

  .zoom-reset:hover {
    border-color: var(--border-strong);
    background: var(--hover);
    color: var(--text);
  }

  .zoom-control output {
    width: 34px;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    text-align: right;
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

  }

  @media (max-width: 680px) {
    .workspace {
      grid-template-columns: minmax(0, 1fr);
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

    .reference-popover {
      position: fixed;
      top: 116px;
      right: 10px;
      width: min(330px, calc(100vw - 20px));
    }

    .magic-wand-popover {
      position: fixed;
      top: 116px;
      left: 10px;
      width: min(280px, calc(100vw - 20px));
    }

    .board-title h1 {
      max-width: 260px;
    }

    .board-area {
      min-height: 560px;
    }

    .board-footer {
      gap: 8px;
      padding: 8px 10px;
    }

    .board-footer > span {
      display: none;
    }

    .zoom-control {
      width: 100%;
      justify-content: flex-end;
    }

    .zoom-slider {
      width: min(160px, 48vw);
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
