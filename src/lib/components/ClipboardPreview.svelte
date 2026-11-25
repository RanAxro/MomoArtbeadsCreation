<script lang="ts">
  import type { ClipboardBoardData } from '$model/selection-clipboard.model';
  import { themeStore } from '$modules/settings/theme.svelte';

  interface Props {
    board: ClipboardBoardData;
  }

  const PREVIEW_MAX_WIDTH = 76;
  const PREVIEW_MAX_HEIGHT = 56;

  let { board }: Props = $props();
  let canvas: HTMLCanvasElement | undefined = $state();
  let previewSize = $derived.by(() => {
    const scale = Math.min(
      PREVIEW_MAX_WIDTH / board.width,
      PREVIEW_MAX_HEIGHT / board.height
    );
    return {
      width: Math.max(1, board.width * scale),
      height: Math.max(1, board.height * scale)
    };
  });

  function draw(frameWidth: number, frameHeight: number): void {
    if (!canvas) {
      return;
    }

    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(frameWidth * scale);
    canvas.height = Math.round(frameHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.setTransform(scale, 0, 0, scale, 0, 0);
    const styles = getComputedStyle(document.documentElement);
    const boardColor =
      styles.getPropertyValue('--board').trim() || '#ffffff';
    context.clearRect(0, 0, frameWidth, frameHeight);
    context.fillStyle = boardColor;
    context.fillRect(0, 0, frameWidth, frameHeight);

    const cellSize = Math.min(
      frameWidth / board.width,
      frameHeight / board.height
    );
    const originX = (frameWidth - board.width * cellSize) / 2;
    const originY = (frameHeight - board.height * cellSize) / 2;

    for (let y = 0; y < board.height; y += 1) {
      for (let x = 0; x < board.width; x += 1) {
        const colorIndex = board.cells[y * board.width + x];
        const color = board.palette.colors[colorIndex - 1];
        if (!color) {
          continue;
        }
        context.fillStyle = color.hex;
        context.fillRect(
          originX + x * cellSize,
          originY + y * cellSize,
          Math.ceil(cellSize + 0.2),
          Math.ceil(cellSize + 0.2)
        );
      }
    }
  }

  $effect(() => {
    const size = previewSize;
    themeStore.mode;
    draw(size.width, size.height);
  });
</script>

<div
  class="clipboard-preview"
  style:width={`${previewSize.width}px`}
  style:height={`${previewSize.height}px`}
  aria-hidden="true"
>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .clipboard-preview {
    overflow: hidden;
    background: var(--board);
    outline: 1px solid var(--border-strong);
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
