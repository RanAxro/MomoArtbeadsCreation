<script lang="ts">
  import type { BeadProject } from '$domain/project';
  import { themeStore } from '$modules/settings/theme.svelte';

  interface Props {
    project: Pick<BeadProject, 'width' | 'height' | 'cells' | 'palette'>;
    revision?: number;
    label?: string;
  }

  let { project, revision = 0, label = 'Pegboard preview' }: Props = $props();
  let canvas: HTMLCanvasElement | undefined = $state();
  let host: HTMLDivElement | undefined = $state();
  let hostWidth = $state(320);

  function draw(): void {
    if (!canvas || !host || hostWidth <= 0) {
      return;
    }

    const scale = window.devicePixelRatio || 1;
    const viewportHeight = Math.max(180, Math.min(460, hostWidth * 0.72));
    canvas.width = Math.round(hostWidth * scale);
    canvas.height = Math.round(viewportHeight * scale);
    canvas.style.height = `${viewportHeight}px`;

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.setTransform(scale, 0, 0, scale, 0, 0);
    const styles = getComputedStyle(document.documentElement);
    const stageColor = styles.getPropertyValue('--stage').trim() || '#e7e7e4';
    const boardColor = styles.getPropertyValue('--board').trim() || '#ffffff';

    context.clearRect(0, 0, hostWidth, viewportHeight);
    context.fillStyle = stageColor;
    context.fillRect(0, 0, hostWidth, viewportHeight);

    const padding = 24;
    const cellSize = Math.min(
      (hostWidth - padding * 2) / project.width,
      (viewportHeight - padding * 2) / project.height
    );
    const originX = (hostWidth - project.width * cellSize) / 2;
    const originY = (viewportHeight - project.height * cellSize) / 2;

    for (let y = 0; y < project.height; y += 1) {
      for (let x = 0; x < project.width; x += 1) {
        const colorIndex = project.cells[y * project.width + x];
        const color = project.palette.colors[colorIndex - 1];
        context.fillStyle = color?.hex ?? boardColor;
        context.fillRect(
          originX + x * cellSize,
          originY + y * cellSize,
          Math.ceil(cellSize + 0.2),
          Math.ceil(cellSize + 0.2)
        );
      }
    }

    if (cellSize > 7) {
      context.strokeStyle = styles.getPropertyValue('--board-line').trim() || 'rgba(0,0,0,.12)';
      context.lineWidth = 0.5;
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
  }

  $effect(() => {
    revision;
    project;
    hostWidth;
    themeStore.mode;
    draw();
  });

  $effect(() => {
    if (!host) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      hostWidth = Math.max(120, entry.contentRect.width);
    });
    observer.observe(host);

    return () => observer.disconnect();
  });
</script>

<div class="preview" bind:this={host} role="img" aria-label={label}>
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
</div>

<style>
  .preview {
    width: 100%;
    overflow: hidden;
    border-radius: 18px;
    background: var(--stage);
  }

  canvas {
    display: block;
    width: 100%;
  }
</style>
