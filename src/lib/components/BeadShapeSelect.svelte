<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { _ } from 'svelte-i18n';
  import Icon from '$lib/components/Icon.svelte';
  import {
    BEAD_SHAPE_OPTIONS,
    beadShapeLabelKey,
    type BeadShape
  } from '$model/bead-shape.model';
  import { IconName } from '$model/icon.model';

  interface Props {
    value: BeadShape;
    onchange: (value: BeadShape) => void;
    disabled?: boolean;
    ariaLabel?: string;
  }

  let {
    value,
    onchange,
    disabled = false,
    ariaLabel
  }: Props = $props();
  let root: HTMLDivElement | undefined = $state();
  let trigger: HTMLButtonElement | undefined = $state();
  let open = $state(false);
  let selectedLabelKey = $derived(beadShapeLabelKey(value));
  let selectedIndex = $derived(
    BEAD_SHAPE_OPTIONS.findIndex((option) => option.value === value)
  );

  $effect(() => {
    if (disabled) {
      open = false;
    }
  });

  async function focusOption(index: number): Promise<void> {
    await tick();
    root
      ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
      ?.[Math.max(0, index)]
      ?.focus();
  }

  function openMenu(): void {
    if (disabled) {
      return;
    }
    open = true;
  }

  function handleTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      open = false;
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    event.preventDefault();
    openMenu();
    void focusOption(selectedIndex);
  }

  function handleMenuKeydown(event: KeyboardEvent): void {
    if (!open) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      open = false;
      trigger?.focus();
      return;
    }

    const focused = document.activeElement;
    const currentIndex = BEAD_SHAPE_OPTIONS.findIndex((option) => {
      const element = root?.querySelector<HTMLButtonElement>(
        `[data-shape="${option.value}"]`
      );
      return element === focused;
    });
    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') {
      nextIndex = Math.min(BEAD_SHAPE_OPTIONS.length - 1, currentIndex + 1);
    } else if (event.key === 'ArrowUp') {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = BEAD_SHAPE_OPTIONS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    void focusOption(nextIndex);
  }

  async function choose(shape: BeadShape): Promise<void> {
    open = false;
    if (shape !== value) {
      onchange(shape);
    }
    await tick();
    trigger?.focus();
  }

  function handleFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (
      open &&
      (!(next instanceof Node) || !root?.contains(next))
    ) {
      open = false;
    }
  }

  onMount(() => {
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      const target = event.target;
      if (
        open &&
        target instanceof Node &&
        root &&
        !root.contains(target)
      ) {
        open = false;
      }
    };
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  });
</script>

<div
  class="shape-select"
  bind:this={root}
  onfocusout={handleFocusOut}
>
  <button
    bind:this={trigger}
    class="field shape-select-trigger"
    type="button"
    aria-label={ariaLabel ?? $_('beadShape.label')}
    aria-haspopup="listbox"
    aria-expanded={open}
    disabled={disabled}
    onclick={() => (open = !open)}
    onkeydown={handleTriggerKeydown}
  >
    <span class="shape-select-value">
      <span
        class="shape {value}"
        aria-hidden="true"
      ></span>
      <span>{$_(selectedLabelKey)}</span>
    </span>
    <Icon name={IconName.ChevronDown} size={15} />
  </button>

  {#if open}
    <div
      class="shape-select-menu"
      role="listbox"
      tabindex="-1"
      aria-label={ariaLabel ?? $_('beadShape.label')}
      onkeydown={handleMenuKeydown}
    >
      {#each BEAD_SHAPE_OPTIONS as option}
        <button
          class="shape-select-option"
          class:selected={option.value === value}
          type="button"
          role="option"
          aria-selected={option.value === value}
          data-shape={option.value}
          onclick={() => void choose(option.value)}
        >
          <span
            class="shape {option.value}"
            aria-hidden="true"
          ></span>
          <span>{$_(option.labelKey)}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .shape-select {
    position: relative;
    min-width: 0;
  }

  .shape-select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    text-align: left;
    cursor: pointer;
  }

  .shape-select-trigger:disabled {
    cursor: wait;
    opacity: 0.55;
  }

  .shape-select-value {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .shape-select-menu {
    position: absolute;
    z-index: 30;
    top: calc(100% + 4px);
    right: 0;
    left: 0;
    display: grid;
    gap: 3px;
    padding: 5px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .shape-select-option {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 38px;
    padding: 0 10px;
    border: 0;
    border-radius: 2px;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .shape-select-option:hover,
  .shape-select-option:focus-visible {
    background: var(--hover);
  }

  .shape-select-option.selected {
    background: var(--text);
    color: var(--surface);
  }

  .shape {
    display: inline-block;
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
    background: currentColor;
  }

  .shape.circle {
    border-radius: 50%;
  }

  .shape.hexagon {
    clip-path: polygon(
      50% 0,
      93.301% 25%,
      93.301% 75%,
      50% 100%,
      6.699% 75%,
      6.699% 25%
    );
  }
</style>
