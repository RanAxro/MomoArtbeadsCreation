<script lang="ts">
  import type { EditorStore } from '$modules/editor/editor-store.svelte';
  import type { BoardCell, BoardLayout } from '$modules/editor/board-layout';
  import {
    calculateBoardLayout,
    cellFromCanvasPoint,
    contrastingOutline
  } from '$modules/editor/board-layout';
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
  let hoveredCell = $state<BoardCell | null>(null);

  let layout: BoardLayout = {
    originX: 0,
    originY: 0,
    boardWidth: 0,
    boardHeight: 0,
    cellSize: 20,
    rulerThickness: 20,
    rulerGap: 4
  };

  function updateFrame(): void {
    if (!host) {
      return;
    }

    const rect = host.getBoundingClientRect();
    frameWidth = Math.max(1, rect.width);
    frameHeight = Math.max(1, rect.height);
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
    const rulerColor = styles.getPropertyValue('--surface').trim() || '#ffffff';
    const rulerLine = styles.getPropertyValue('--border').trim() || '#d7d7d3';
    const rulerText = styles.getPropertyValue('--muted').trim() || '#707070';
    const activeRulerColor = styles.getPropertyValue('--text').trim() || '#111111';
    const activeRulerText = styles.getPropertyValue('--selected-text').trim() || '#ffffff';
    const fontFamily =
      styles.getPropertyValue('font-family').trim() || 'system-ui, sans-serif';

    context.clearRect(0, 0, frameWidth, frameHeight);
    context.fillStyle = stageColor;
    context.fillRect(0, 0, frameWidth, frameHeight);

    layout = calculateBoardLayout(
      frameWidth,
      frameHeight,
      project.width,
      project.height
    );
    const { originX, originY, boardWidth, boardHeight, cellSize } = layout;

    context.fillStyle = boardColor;
    context.fillRect(originX, originY, boardWidth, boardHeight);

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
        context.lineTo(originX + x * cellSize, originY + boardHeight);
        context.stroke();
      }
      for (let y = 0; y <= project.height; y += 1) {
        context.beginPath();
        context.moveTo(originX, originY + y * cellSize);
        context.lineTo(originX + boardWidth, originY + y * cellSize);
        context.stroke();
      }
    }

    context.strokeStyle = styles.getPropertyValue('--border-strong').trim() || '#b8b8b3';
    context.lineWidth = 1;
    context.strokeRect(
      originX,
      originY,
      boardWidth,
      boardHeight
    );

    drawRulers(context, {
      columns: project.width,
      rows: project.height,
      rulerColor,
      rulerLine,
      rulerText,
      activeRulerColor,
      activeRulerText,
      fontFamily
    });

    const hovered = hoveredCell;
    if (hovered) {
      const colorIndex = project.cells[hovered.index];
      const bead = colorIndex > 0 ? project.palette.colors[colorIndex - 1] : undefined;
      const outline = contrastingOutline(bead?.hex ?? boardColor);
      const strokeWidth = Math.max(1.5, Math.min(3, cellSize * 0.12));
      const inset = strokeWidth / 2 + 0.5;

      context.strokeStyle = outline;
      context.lineWidth = strokeWidth;
      context.strokeRect(
        originX + hovered.x * cellSize + inset,
        originY + hovered.y * cellSize + inset,
        cellSize - inset * 2,
        cellSize - inset * 2
      );
    }
  }

  interface RulerStyle {
    columns: number;
    rows: number;
    rulerColor: string;
    rulerLine: string;
    rulerText: string;
    activeRulerColor: string;
    activeRulerText: string;
    fontFamily: string;
  }

  function drawRulers(
    context: CanvasRenderingContext2D,
    style: RulerStyle
  ): void {
    const {
      originX,
      originY,
      boardWidth,
      boardHeight,
      cellSize,
      rulerThickness,
      rulerGap
    } = layout;
    const topY = originY - rulerGap - rulerThickness;
    const bottomY = originY + boardHeight + rulerGap;
    const leftX = originX - rulerGap - rulerThickness;
    const rightX = originX + boardWidth + rulerGap;
    const hovered = hoveredCell;
    const fontSize = Math.max(6, Math.min(10, cellSize * 0.42));

    context.fillStyle = style.rulerColor;
    context.fillRect(originX, topY, boardWidth, rulerThickness);
    context.fillRect(originX, bottomY, boardWidth, rulerThickness);
    context.fillRect(leftX, originY, rulerThickness, boardHeight);
    context.fillRect(rightX, originY, rulerThickness, boardHeight);

    context.fillStyle = style.activeRulerColor;
    if (hovered && hovered.x < style.columns) {
      const columnX = originX + hovered.x * cellSize;
      context.fillRect(columnX, topY, cellSize, rulerThickness);
      context.fillRect(columnX, bottomY, cellSize, rulerThickness);
    }
    if (hovered && hovered.y < style.rows) {
      const rowY = originY + hovered.y * cellSize;
      context.fillRect(leftX, rowY, rulerThickness, cellSize);
      context.fillRect(rightX, rowY, rulerThickness, cellSize);
    }

    context.strokeStyle = style.rulerLine;
    context.lineWidth = 1;
    context.strokeRect(originX, topY, boardWidth, rulerThickness);
    context.strokeRect(originX, bottomY, boardWidth, rulerThickness);
    context.strokeRect(leftX, originY, rulerThickness, boardHeight);
    context.strokeRect(rightX, originY, rulerThickness, boardHeight);

    context.beginPath();
    for (let column = 1; column < style.columns; column += 1) {
      const x = originX + column * cellSize;
      context.moveTo(x, topY + rulerThickness * 0.62);
      context.lineTo(x, topY + rulerThickness);
      context.moveTo(x, bottomY);
      context.lineTo(x, bottomY + rulerThickness * 0.38);
    }
    for (let row = 1; row < style.rows; row += 1) {
      const y = originY + row * cellSize;
      context.moveTo(rightX, y);
      context.lineTo(rightX + rulerThickness * 0.38, y);
      context.moveTo(leftX + rulerThickness * 0.62, y);
      context.lineTo(leftX + rulerThickness, y);
    }
    context.stroke();

    context.font = `500 ${fontSize}px ${style.fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    for (let column = 0; column < style.columns; column += 1) {
      const x = originX + (column + 0.5) * cellSize;
      context.fillStyle =
        hovered?.x === column ? style.activeRulerText : style.rulerText;
      const label = String(column + 1);
      context.fillText(label, x, topY + rulerThickness / 2);
      context.fillText(label, x, bottomY + rulerThickness / 2);
    }

    for (let row = 0; row < style.rows; row += 1) {
      const y = originY + (row + 0.5) * cellSize;
      context.fillStyle =
        hovered?.y === row ? style.activeRulerText : style.rulerText;
      const label = String(row + 1);
      context.fillText(label, leftX + rulerThickness / 2, y);
      context.fillText(label, rightX + rulerThickness / 2, y);
    }
  }

  function cellFromPointer(event: PointerEvent): BoardCell | null {
    const project = editor.project;
    if (!canvas || !project) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return cellFromCanvasPoint(layout, project.width, project.height, x, y);
  }

  function applyPointer(event: PointerEvent): void {
    const cell = cellFromPointer(event);
    if (cell) {
      editor.paint(cell.index);
    }
  }

  function updateHoveredCell(cell: BoardCell | null): void {
    if (hoveredCell?.index === cell?.index) {
      return;
    }

    hoveredCell = cell;
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.button !== 2) {
      return;
    }

    event.preventDefault();
    const cell = cellFromPointer(event);
    updateHoveredCell(cell);
    if (!cell) {
      return;
    }

    if (editor.tool === 'fill' && event.button === 0) {
      editor.fill(cell.index);
      return;
    }

    pointerDown = true;
    canvas?.setPointerCapture(event.pointerId);
    editor.beginStroke();
    applyPointer(event);
  }

  function onPointerMove(event: PointerEvent): void {
    updateHoveredCell(cellFromPointer(event));
    if (pointerDown) {
      applyPointer(event);
    }
  }

  function onPointerLeave(): void {
    if (!pointerDown) {
      updateHoveredCell(null);
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
    hoveredCell;
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
    onpointerleave={onPointerLeave}
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
