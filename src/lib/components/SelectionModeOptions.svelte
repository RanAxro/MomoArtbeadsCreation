<script lang="ts">
  import { _ } from 'svelte-i18n';
  import {
    SELECTION_OPERATION_DEFINITIONS,
    SelectionOperation
  } from '$model/selection.model';

  interface Props {
    value: SelectionOperation;
    onselect: (operation: SelectionOperation) => void;
  }

  let { value, onselect }: Props = $props();
</script>

<div
  class="selection-mode-options"
  role="group"
  aria-label={$_('board.selectionMode')}
>
  {#each SELECTION_OPERATION_DEFINITIONS as operation (operation.id)}
    <button
      class="selection-mode-option"
      class:active={value === operation.id}
      type="button"
      aria-pressed={value === operation.id}
      onclick={() => onselect(operation.id)}
    >
      <span>{$_(operation.labelKey)}</span>
      {#if operation.id === SelectionOperation.Replace}
        <small>{$_('board.selectionModeDefault')}</small>
      {/if}
    </button>
  {/each}
</div>

<style>
  .selection-mode-options {
    display: grid;
    gap: 2px;
  }

  .selection-mode-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 31px;
    padding: 5px 8px;
    border: 1px solid transparent;
    border-radius: 2px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 0.75rem;
    text-align: left;
    cursor: pointer;
  }

  .selection-mode-option:hover {
    border-color: var(--border);
    background: var(--hover);
  }

  .selection-mode-option.active {
    border-color: var(--text);
    font-weight: 600;
  }

  .selection-mode-option small {
    color: var(--muted);
    font-size: 0.62rem;
    font-weight: 400;
  }
</style>
