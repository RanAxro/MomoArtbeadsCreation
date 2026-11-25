<script lang="ts">
  import type { ClipboardBoardData } from '$model/selection-clipboard.model';
  import { themeStore } from '$modules/settings/theme.svelte';

  interface Props {
    board: ClipboardBoardData;
  }

  let { board }: Props = $props();
  let canvas: HTMLCanvasElement | undefined = $state();
  let host: HTMLDivElement | undefined = $state();
  let frameWidth = $state(76);
  let frameHeight = $state(56);

  function updateFrame(): void {
    if (!host) {
      return;
    }
    const rect = host.getBoundingClientRect();
    frameWidth = Math.max(1, rect.width);
    frameHeight = Math.max(1, rect.height);
  }

  function draw(): void {
    if (!canvas || frameWidth <= 1 || frameHeight <= 1) {
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
    board;
    frameWidth;
    frameHeight;
    themeStore.mode;
    draw();
  });

  $effect(() => {
    if (!host) {
      return;
    }

    updateFrame();
    const observer = new ResizeObserver(updateFrame);
    observer.observe(host);
    return () => observer.disconnect();
  });
</script>

<div class="clipboard-preview" bind:this={host} aria-hidden="true">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .clipboard-preview {
    width: 76px;
    height: 56px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--board);
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
