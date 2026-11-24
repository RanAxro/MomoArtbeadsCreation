<script lang="ts">
  import type { EditorStore } from '$modules/editor/editor-store.svelte';
  import { themeStore } from '$modules/settings/theme.svelte';
  import { _ } from 'svelte-i18n';

  interface Props {
    editor: EditorStore;
  }

  let { editor }: Props = $props();
  let canvas: HTMLCanvasElement | undefined = $state();
  let host: HTMLDivElement | undefined = $state();
  let frameWidth = $state(800);
  let frameHeight = $state(600);
  let pointerDown = $state(false);

  let layout = {
    originX: 0,
    originY: 0,
    cellSize: 20
  };

  function updateFrame(): void {
    if (!host) {
      return;
    }

    const rect = host.getBoundingClientRect();
    frameWidth = Math.max(320, rect.width);
    frameHeight = Math.max(360, rect.height);
  }

  function draw(): void {
    const project = editor.project;
    if (!canvas || !project) {
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
    const stageColor = styles.getPropertyValue('--stage').trim() || '#e7e7e4';
    const boardColor = styles.getPropertyValue('--board').trim() || '#ffffff';
    const boardLine = styles.getPropertyValue('--board-line').trim() || 'rgba(0,0,0,.12)';

    context.clearRect(0, 0, frameWidth, frameHeight);
    context.fillStyle = stageColor;
    context.fillRect(0, 0, frameWidth, frameHeight);

    const padding = 40;
    const cellSize = Math.max(
      2,
      Math.min(
        (frameWidth - padding * 2) / project.width,
        (frameHeight - padding * 2) / project.height
      )
    );
    const originX = (frameWidth - project.width * cellSize) / 2;
    const originY = (frameHeight - project.height * cellSize) / 2;
    layout = { originX, originY, cellSize };

    context.fillStyle = boardColor;
    context.fillRect(
      originX,
      originY,
      project.width * cellSize,
      project.height * cellSize
    );

    for (let y = 0; y < project.height; y += 1) {
      for (let x = 0; x < project.width; x += 1) {
        const index = y * project.width + x;
        const colorIndex = project.cells[index];
        if (colorIndex === 0) {
          continue;
        }

        const bead = project.palette.colors[colorIndex - 1];
        if (!bead) {
          continue;
        }

        const cellX = originX + x * cellSize;
        const cellY = originY + y * cellSize;
        context.fillStyle = bead.hex;
        context.fillRect(cellX, cellY, Math.ceil(cellSize + 0.2), Math.ceil(cellSize + 0.2));
      }
    }

    if (cellSize >= 5) {
      context.strokeStyle = boardLine;
      context.lineWidth = Math.max(0.35, Math.min(0.8, cellSize / 18));
      for (let x = 0; x <= project.width; x += 1) {
        context.beginPath();
        context.moveTo(originX + x * cellSize, originY);
        context.lineTo(originX + x * cellSize, originY + project.height * cellSize);
        context.stroke();
      }
      for (let y = 0; y <= project.height; y += 1) {
        context.beginPath();
        context.moveTo(originX, originY + y * cellSize);
        context.lineTo(originX + project.width * cellSize, originY + y * cellSize);
        context.stroke();
      }
    }

    context.strokeStyle = styles.getPropertyValue('--border-strong').trim() || '#b8b8b3';
    context.lineWidth = 1;
    context.strokeRect(
      originX,
      originY,
      project.width * cellSize,
      project.height * cellSize
    );
  }

  function cellIndexFromPointer(event: PointerEvent): number {
    const project = editor.project;
    if (!canvas || !project) {
      return -1;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const gridX = Math.floor((x - layout.originX) / layout.cellSize);
    const gridY = Math.floor((y - layout.originY) / layout.cellSize);

    if (gridX < 0 || gridY < 0 || gridX >= project.width || gridY >= project.height) {
      return -1;
    }

    return gridY * project.width + gridX;
  }

  function applyPointer(event: PointerEvent): void {
    const index = cellIndexFromPointer(event);
    if (index >= 0) {
      editor.paint(index);
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.button !== 2) {
      return;
    }

    event.preventDefault();
    const index = cellIndexFromPointer(event);
    if (index < 0) {
      return;
    }

    if (editor.tool === 'fill' && event.button === 0) {
      editor.fill(index);
      return;
    }

    pointerDown = true;
    canvas?.setPointerCapture(event.pointerId);
    editor.beginStroke();
    applyPointer(event);
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerDown) {
      applyPointer(event);
    }
  }

  function finishStroke(event: PointerEvent): void {
    if (!pointerDown) {
      return;
    }

    pointerDown = false;
    editor.endStroke();
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  $effect(() => {
    editor.project;
    editor.revision;
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

<div
  class="canvas-host"
  bind:this={host}
  role="region"
  aria-label={$_('board.title')}
>
  <canvas
    bind:this={canvas}
    class:fill-tool={editor.tool === 'fill'}
    aria-hidden="true"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={finishStroke}
    onpointercancel={finishStroke}
    oncontextmenu={(event) => event.preventDefault()}
  ></canvas>
</div>

<style>
  .canvas-host {
    width: 100%;
    min-height: 420px;
    height: 100%;
    overflow: hidden;
    border-radius: 0;
    background: var(--stage);
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 420px;
    cursor: crosshair;
    touch-action: none;
    user-select: none;
  }

  canvas.fill-tool {
    cursor: cell;
  }

  @media (max-width: 720px) {
    .canvas-host,
    canvas {
      min-height: 360px;
    }
  }
</style>
