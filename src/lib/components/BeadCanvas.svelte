<script lang="ts">
  import { onMount } from 'svelte';
  import type { EditorStore } from '$modules/editor/editor-store.svelte';
  import type {
    BoardCell,
    BoardLayout,
    BoardViewCenter
  } from '$modules/editor/board-layout';
  import {
    boardOriginForView,
    calculateBoardLayout,
    cellFromCanvasPoint,
    clampBoardZoom,
    clampViewCenter,
    contrastingOutline
  } from '$modules/editor/board-layout';
  import {
    combineSelections,
    createSelectionRectangle,
    type SelectionOperation,
    type SelectionRectangle
  } from '$modules/editor/selection';
  import { themeStore } from '$modules/settings/theme.svelte';
  import { _ } from 'svelte-i18n';

  interface Props {
    editor: EditorStore;
  }

  let { editor }: Props = $props();
  let canvas: HTMLCanvasElement | undefined = $state();
  let host: HTMLDivElement | undefined = $state();
  let frameWidth = $state(0);
  let frameHeight = $state(0);
  let pointerDown = $state(false);
  let hoveredCell = $state<BoardCell | null>(null);
  let viewCenterX = $state(0);
  let viewCenterY = $state(0);
  let spacePressed = $state(false);
  let panPointerId = $state<number | null>(null);
  let pinching = $state(false);
  let selectionDrag = $state<{
    pointerId: number;
    operation: SelectionOperation;
    previous: ReadonlySet<number>;
    rectangle: SelectionRectangle;
  } | null>(null);

  let baseLayout: BoardLayout = {
    edgeInset: 8,
    contentX: 0,
    contentY: 0,
    contentWidth: 1,
    contentHeight: 1,
    originX: 0,
    originY: 0,
    boardWidth: 0,
    boardHeight: 0,
    cellSize: 20,
    rulerThickness: 20,
    rulerGap: 4
  };

  let layout: BoardLayout = {
    edgeInset: 8,
    contentX: 0,
    contentY: 0,
    contentWidth: 1,
    contentHeight: 1,
    originX: 0,
    originY: 0,
    boardWidth: 0,
    boardHeight: 0,
    cellSize: 20,
    rulerThickness: 20,
    rulerGap: 4
  };
  let viewInitialized = false;
  let viewProjectId: string | null = null;
  let panLastX = 0;
  let panLastY = 0;
  let touchGestureStarted = false;
  let pinchState: {
    distance: number;
    zoom: number;
    anchorX: number;
    anchorY: number;
  } | null = null;
  const touchPoints = new Map<number, { x: number; y: number }>();

  function updateFrame(): void {
    if (!host) {
      return;
    }

    const rect = host.getBoundingClientRect();
    frameWidth = Math.max(1, rect.width);
    frameHeight = Math.max(1, rect.height);
  }

  function resolveViewLayout(
    base: BoardLayout,
    zoom: number,
    center: BoardViewCenter
  ): { layout: BoardLayout; center: BoardViewCenter } {
    const clampedCenter = clampViewCenter(base, zoom, center);
    const origin = boardOriginForView(base, zoom, clampedCenter);

    return {
      center: clampedCenter,
      layout: {
        ...base,
        originX: origin.x,
        originY: origin.y,
        boardWidth: base.boardWidth * zoom,
        boardHeight: base.boardHeight * zoom,
        cellSize: base.cellSize * zoom
      }
    };
  }

  function applyViewCenter(center: BoardViewCenter): void {
    if (viewCenterX !== center.x) {
      viewCenterX = center.x;
    }
    if (viewCenterY !== center.y) {
      viewCenterY = center.y;
    }
  }

  function draw(): void {
    const project = editor.project;
    if (!canvas || !project || frameWidth <= 1 || frameHeight <= 1) {
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
    const selectionColor = styles.getPropertyValue('--selection').trim() || '#2f6fed';
    const selectionFill =
      styles.getPropertyValue('--selection-fill').trim() || 'rgba(47, 111, 237, 0.32)';
    const fontFamily =
      styles.getPropertyValue('font-family').trim() || 'system-ui, sans-serif';

    context.clearRect(0, 0, frameWidth, frameHeight);
    context.fillStyle = stageColor;
    context.fillRect(0, 0, frameWidth, frameHeight);

    baseLayout = calculateBoardLayout(
      frameWidth,
      frameHeight,
      project.width,
      project.height
    );
    if (!viewInitialized || viewProjectId !== project.id) {
      viewCenterX = baseLayout.boardWidth / 2;
      viewCenterY = baseLayout.boardHeight / 2;
      viewInitialized = true;
      viewProjectId = project.id;
    }

    const resolved = resolveViewLayout(baseLayout, editor.zoom, {
      x: viewCenterX,
      y: viewCenterY
    });
    applyViewCenter(resolved.center);
    layout = resolved.layout;
    const {
      originX,
      originY,
      boardWidth,
      boardHeight,
      cellSize,
      contentX,
      contentY,
      contentWidth,
      contentHeight
    } = layout;

    context.save();
    context.beginPath();
    context.rect(contentX, contentY, contentWidth, contentHeight);
    context.clip();

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

    if (editor.selectedCells.size > 0) {
      context.fillStyle = selectionFill;
      for (const index of editor.selectedCells) {
        if (index < 0 || index >= project.cells.length) {
          continue;
        }
        const x = index % project.width;
        const y = Math.floor(index / project.width);
        context.fillRect(
          originX + x * cellSize,
          originY + y * cellSize,
          Math.ceil(cellSize + 0.2),
          Math.ceil(cellSize + 0.2)
        );
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

    if (editor.selectedCells.size > 0) {
      strokeSelectionOutline(
        context,
        editor.selectedCells,
        selectionColor,
        Math.max(1, Math.min(2, cellSize * 0.08))
      );
    }

    if (selectionDrag) {
      const { minX, minY, width, height } = selectionDrag.rectangle;
      context.save();
      context.strokeStyle = selectionColor;
      context.lineWidth = Math.max(1.25, Math.min(2.25, cellSize * 0.1));
      context.setLineDash([
        Math.max(4, cellSize * 0.28),
        Math.max(3, cellSize * 0.2)
      ]);
      context.strokeRect(
        originX + minX * cellSize,
        originY + minY * cellSize,
        width * cellSize,
        height * cellSize
      );
      context.restore();

      if (
        selectionDrag.operation === 'intersect' &&
        selectionDrag.previous.size > 0
      ) {
        strokeSelectionOutline(
          context,
          selectionDrag.previous,
          selectionColor,
          Math.max(1.5, Math.min(2.5, cellSize * 0.1)),
          [
            Math.max(3, cellSize * 0.2),
            Math.max(2, cellSize * 0.14)
          ]
        );
      }
    }

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

    context.restore();

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
  }

  function strokeSelectionOutline(
    context: CanvasRenderingContext2D,
    cells: ReadonlySet<number>,
    color: string,
    lineWidth: number,
    dash: number[] = []
  ): void {
    const project = editor.project;
    if (!project || cells.size === 0) {
      return;
    }

    const { originX, originY, cellSize } = layout;
    context.save();
    context.beginPath();

    for (const index of cells) {
      if (index < 0 || index >= project.cells.length) {
        continue;
      }

      const x = index % project.width;
      const y = Math.floor(index / project.width);
      const cellX = originX + x * cellSize;
      const cellY = originY + y * cellSize;

      if (y === 0 || !cells.has(index - project.width)) {
        context.moveTo(cellX, cellY);
        context.lineTo(cellX + cellSize, cellY);
      }
      if (y === project.height - 1 || !cells.has(index + project.width)) {
        context.moveTo(cellX, cellY + cellSize);
        context.lineTo(cellX + cellSize, cellY + cellSize);
      }
      if (x === 0 || !cells.has(index - 1)) {
        context.moveTo(cellX, cellY);
        context.lineTo(cellX, cellY + cellSize);
      }
      if (x === project.width - 1 || !cells.has(index + 1)) {
        context.moveTo(cellX + cellSize, cellY);
        context.lineTo(cellX + cellSize, cellY + cellSize);
      }
    }

    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.setLineDash(dash);
    context.stroke();
    context.restore();
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
      cellSize,
      edgeInset,
      contentX,
      contentY,
      contentWidth,
      contentHeight,
      rulerThickness
    } = layout;
    const contentRight = contentX + contentWidth;
    const contentBottom = contentY + contentHeight;
    const topY = edgeInset;
    const bottomY = frameHeight - edgeInset - rulerThickness;
    const leftX = edgeInset;
    const rightX = frameWidth - edgeInset - rulerThickness;
    const hovered = hoveredCell;
    const fontSize = Math.max(6, Math.min(10, cellSize * 0.42));

    context.fillStyle = style.rulerColor;
    context.fillRect(contentX, topY, contentWidth, rulerThickness);
    context.fillRect(contentX, bottomY, contentWidth, rulerThickness);
    context.fillRect(leftX, contentY, rulerThickness, contentHeight);
    context.fillRect(rightX, contentY, rulerThickness, contentHeight);

    context.fillStyle = style.activeRulerColor;
    if (hovered && hovered.x < style.columns) {
      const columnX = originX + hovered.x * cellSize;
      context.save();
      context.beginPath();
      context.rect(contentX, topY, contentWidth, rulerThickness);
      context.rect(contentX, bottomY, contentWidth, rulerThickness);
      context.clip();
      context.fillRect(columnX, topY, cellSize, rulerThickness);
      context.fillRect(columnX, bottomY, cellSize, rulerThickness);
      context.restore();
    }
    if (hovered && hovered.y < style.rows) {
      const rowY = originY + hovered.y * cellSize;
      context.save();
      context.beginPath();
      context.rect(leftX, contentY, rulerThickness, contentHeight);
      context.rect(rightX, contentY, rulerThickness, contentHeight);
      context.clip();
      context.fillRect(leftX, rowY, rulerThickness, cellSize);
      context.fillRect(rightX, rowY, rulerThickness, cellSize);
      context.restore();
    }

    context.strokeStyle = style.rulerLine;
    context.lineWidth = 1;
    context.strokeRect(contentX, topY, contentWidth, rulerThickness);
    context.strokeRect(contentX, bottomY, contentWidth, rulerThickness);
    context.strokeRect(leftX, contentY, rulerThickness, contentHeight);
    context.strokeRect(rightX, contentY, rulerThickness, contentHeight);

    context.beginPath();
    for (let column = 1; column < style.columns; column += 1) {
      const x = originX + column * cellSize;
      if (x < contentX || x > contentRight) {
        continue;
      }
      context.moveTo(x, topY + rulerThickness * 0.62);
      context.lineTo(x, topY + rulerThickness);
      context.moveTo(x, bottomY);
      context.lineTo(x, bottomY + rulerThickness * 0.38);
    }
    for (let row = 1; row < style.rows; row += 1) {
      const y = originY + row * cellSize;
      if (y < contentY || y > contentBottom) {
        continue;
      }
      context.moveTo(rightX, y);
      context.lineTo(rightX + rulerThickness * 0.38, y);
      context.moveTo(leftX + rulerThickness * 0.62, y);
      context.lineTo(leftX + rulerThickness, y);
    }
    context.stroke();

    context.font = `500 ${fontSize}px ${style.fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    context.save();
    context.beginPath();
    context.rect(contentX, topY, contentWidth, rulerThickness);
    context.rect(contentX, bottomY, contentWidth, rulerThickness);
    context.clip();
    for (let column = 0; column < style.columns; column += 1) {
      const x = originX + (column + 0.5) * cellSize;
      const columnStart = originX + column * cellSize;
      const columnEnd = columnStart + cellSize;
      if (columnEnd <= contentX || columnStart >= contentRight) {
        continue;
      }
      context.fillStyle =
        hovered?.x === column ? style.activeRulerText : style.rulerText;
      const label = String(column + 1);
      context.fillText(label, x, topY + rulerThickness / 2);
      context.fillText(label, x, bottomY + rulerThickness / 2);
    }
    context.restore();

    context.save();
    context.beginPath();
    context.rect(leftX, contentY, rulerThickness, contentHeight);
    context.rect(rightX, contentY, rulerThickness, contentHeight);
    context.clip();
    for (let row = 0; row < style.rows; row += 1) {
      const y = originY + (row + 0.5) * cellSize;
      const rowStart = originY + row * cellSize;
      const rowEnd = rowStart + cellSize;
      if (rowEnd <= contentY || rowStart >= contentBottom) {
        continue;
      }
      context.fillStyle =
        hovered?.y === row ? style.activeRulerText : style.rulerText;
      const label = String(row + 1);
      context.fillText(label, leftX + rulerThickness / 2, y);
      context.fillText(label, rightX + rulerThickness / 2, y);
    }
    context.restore();
  }

  function pointFromPointer(event: MouseEvent): { x: number; y: number } | null {
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function cellFromPoint(point: { x: number; y: number }): BoardCell | null {
    const project = editor.project;
    if (!project) {
      return null;
    }

    return cellFromCanvasPoint(layout, project.width, project.height, point.x, point.y);
  }

  function cellFromPointer(event: PointerEvent): BoardCell | null {
    const point = pointFromPointer(event);
    return point ? cellFromPoint(point) : null;
  }

  function clampedCellFromPointer(event: PointerEvent): BoardCell | null {
    const project = editor.project;
    const point = pointFromPointer(event);
    if (!project || !point) {
      return null;
    }

    const x = Math.max(
      0,
      Math.min(
        project.width - 1,
        Math.floor((point.x - layout.originX) / layout.cellSize)
      )
    );
    const y = Math.max(
      0,
      Math.min(
        project.height - 1,
        Math.floor((point.y - layout.originY) / layout.cellSize)
      )
    );

    return {
      x,
      y,
      index: y * project.width + x
    };
  }

  function selectionOperationForPointer(
    event: PointerEvent
  ): SelectionOperation | 'clear' | null {
    const command = event.ctrlKey || event.metaKey;

    if (event.button === 0) {
      if (command) {
        return 'union';
      }
      if (event.altKey) {
        return 'subtract';
      }
      return 'replace';
    }

    if (event.button === 2) {
      if (command) {
        return 'xor';
      }
      if (event.altKey) {
        return 'intersect';
      }
      return 'clear';
    }

    return null;
  }

  function beginSelectionDrag(
    event: PointerEvent,
    operation: SelectionOperation
  ): boolean {
    const project = editor.project;
    const start = cellFromPointer(event);
    if (!project || !start) {
      return false;
    }

    const previous = new Set(editor.selectedCells);
    const rectangle = createSelectionRectangle(
      start,
      start,
      project.width,
      project.height,
      event.shiftKey
    );
    editor.setSelection(
      combineSelections(previous, rectangle.cells, operation)
    );
    selectionDrag = {
      pointerId: event.pointerId,
      operation,
      previous,
      rectangle
    };
    canvas?.setPointerCapture(event.pointerId);
    updateHoveredCell(start);
    return true;
  }

  function updateSelectionDrag(event: PointerEvent): void {
    const project = editor.project;
    const end = clampedCellFromPointer(event);
    if (!project || !end || selectionDrag?.pointerId !== event.pointerId) {
      return;
    }

    const rectangle = createSelectionRectangle(
      selectionDrag.rectangle.start,
      end,
      project.width,
      project.height,
      event.shiftKey
    );
    editor.setSelection(
      combineSelections(
        selectionDrag.previous,
        rectangle.cells,
        selectionDrag.operation
      )
    );
    selectionDrag = {
      ...selectionDrag,
      rectangle
    };
  }

  function releaseSelectionPointer(pointerId: number): void {
    if (canvas?.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  }

  function finishSelectionDrag(event: PointerEvent): boolean {
    if (selectionDrag?.pointerId !== event.pointerId) {
      return false;
    }

    releaseSelectionPointer(event.pointerId);
    selectionDrag = null;
    updateHoveredCell(cellFromPointer(event));
    return true;
  }

  function cancelSelectionDrag(event?: PointerEvent): boolean {
    if (
      !selectionDrag ||
      (event && selectionDrag.pointerId !== event.pointerId)
    ) {
      return false;
    }

    const pointerId = event?.pointerId ?? selectionDrag.pointerId;
    editor.setSelection(selectionDrag.previous);
    releaseSelectionPointer(pointerId);
    selectionDrag = null;
    return true;
  }

  function paintPoint(point: { x: number; y: number }): void {
    const cell = cellFromPoint(point);
    if (cell) {
      editor.paint(cell.index);
    }
  }

  function applyPointer(event: PointerEvent): void {
    const point = pointFromPointer(event);
    if (point) {
      paintPoint(point);
    }
  }

  function updateHoveredCell(cell: BoardCell | null): void {
    if (hoveredCell?.index === cell?.index) {
      return;
    }

    hoveredCell = cell;
  }

  function endPaintStroke(): void {
    if (!pointerDown) {
      return;
    }

    pointerDown = false;
    editor.endStroke();
  }

  function startPan(event: PointerEvent): void {
    panPointerId = event.pointerId;
    panLastX = event.clientX;
    panLastY = event.clientY;
    canvas?.setPointerCapture(event.pointerId);
    updateHoveredCell(null);
  }

  function panBy(deltaX: number, deltaY: number): void {
    const project = editor.project;
    if (!project) {
      return;
    }

    const base = calculateBoardLayout(frameWidth, frameHeight, project.width, project.height);
    const center = clampViewCenter(base, editor.zoom, {
      x: viewCenterX - deltaX / editor.zoom,
      y: viewCenterY - deltaY / editor.zoom
    });
    applyViewCenter(center);
  }

  function zoomAtViewPoint(nextZoom: number, x: number, y: number): void {
    const project = editor.project;
    if (!project) {
      return;
    }

    const zoom = clampBoardZoom(nextZoom);
    if (zoom === editor.zoom) {
      return;
    }

    const base = calculateBoardLayout(frameWidth, frameHeight, project.width, project.height);
    const currentCenter = clampViewCenter(base, editor.zoom, {
      x: viewCenterX,
      y: viewCenterY
    });
    const currentOrigin = boardOriginForView(base, editor.zoom, currentCenter);
    const boardX = (x - currentOrigin.x) / editor.zoom;
    const boardY = (y - currentOrigin.y) / editor.zoom;
    const center = clampViewCenter(base, zoom, {
      x: boardX + (base.contentX + base.contentWidth / 2 - x) / zoom,
      y: boardY + (base.contentY + base.contentHeight / 2 - y) / zoom
    });

    applyViewCenter(center);
    editor.setZoom(zoom);
    const nextLayout = resolveViewLayout(base, zoom, center).layout;
    updateHoveredCell(
      cellFromCanvasPoint(nextLayout, project.width, project.height, x, y)
    );
  }

  function refreshHoverAtPoint(point: { x: number; y: number }): void {
    const project = editor.project;
    if (!project) {
      return;
    }

    const base = calculateBoardLayout(
      frameWidth,
      frameHeight,
      project.width,
      project.height
    );
    const nextLayout = resolveViewLayout(base, editor.zoom, {
      x: viewCenterX,
      y: viewCenterY
    }).layout;
    updateHoveredCell(
      cellFromCanvasPoint(nextLayout, project.width, project.height, point.x, point.y)
    );
  }

  function onWheel(event: WheelEvent): void {
    const point = pointFromPointer(event);
    if (!point) {
      return;
    }

    event.preventDefault();
    const deltaScale =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? frameHeight : 1;
    const deltaX = event.deltaX * deltaScale;
    const deltaY = event.deltaY * deltaScale;

    if (event.ctrlKey) {
      const nextZoom = editor.zoom * Math.exp(-deltaY * 0.0015);
      zoomAtViewPoint(nextZoom, point.x, point.y);
      return;
    }

    if (event.shiftKey) {
      panBy(-(deltaY || deltaX), 0);
    } else {
      panBy(0, -deltaY);
    }
    refreshHoverAtPoint(point);
  }

  function touchMetrics(): {
    midpoint: { x: number; y: number };
    distance: number;
  } | null {
    const points = Array.from(touchPoints.values());
    const first = points[0];
    const second = points[1];
    if (!first || !second) {
      return null;
    }

    const deltaX = second.x - first.x;
    const deltaY = second.y - first.y;
    return {
      midpoint: {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2
      },
      distance: Math.max(1, Math.hypot(deltaX, deltaY))
    };
  }

  function beginPinch(): void {
    const metrics = touchMetrics();
    if (!metrics) {
      return;
    }

    endPaintStroke();
    cancelSelectionDrag();
    updateHoveredCell(null);
    pinchState = {
      distance: metrics.distance,
      zoom: editor.zoom,
      anchorX: (metrics.midpoint.x - layout.originX) / editor.zoom,
      anchorY: (metrics.midpoint.y - layout.originY) / editor.zoom
    };
    touchGestureStarted = true;
    pinching = true;
  }

  function onTouchPointerDown(event: PointerEvent): void {
    const point = pointFromPointer(event);
    if (!point) {
      return;
    }

    event.preventDefault();
    canvas?.setPointerCapture(event.pointerId);
    touchPoints.set(event.pointerId, point);

    if (touchPoints.size === 1) {
      if (editor.tool === 'select') {
        beginSelectionDrag(event, 'replace');
      } else {
        updateHoveredCell(null);
      }
      return;
    }

    if (touchPoints.size === 2) {
      beginPinch();
    }
  }

  function onTouchPointerMove(event: PointerEvent): void {
    const point = pointFromPointer(event);
    const previous = touchPoints.get(event.pointerId);
    if (!point || !previous) {
      return;
    }

    event.preventDefault();
    touchPoints.set(event.pointerId, point);

    if (touchPoints.size >= 2) {
      if (!pinchState) {
        beginPinch();
      }
      const metrics = touchMetrics();
      if (!metrics || !pinchState) {
        return;
      }

      const zoom = clampBoardZoom(
        pinchState.zoom * (metrics.distance / pinchState.distance)
      );
      const project = editor.project;
      if (!project) {
        return;
      }
      const base = calculateBoardLayout(
        frameWidth,
        frameHeight,
        project.width,
        project.height
      );
      const center = clampViewCenter(base, zoom, {
        x:
          pinchState.anchorX +
          (base.contentX + base.contentWidth / 2 - metrics.midpoint.x) / zoom,
        y:
          pinchState.anchorY +
          (base.contentY + base.contentHeight / 2 - metrics.midpoint.y) / zoom
      });

      applyViewCenter(center);
      editor.setZoom(zoom);
      updateHoveredCell(null);
      return;
    }

    if (touchGestureStarted) {
      panBy(point.x - previous.x, point.y - previous.y);
      return;
    }

    if (editor.tool === 'select') {
      if (selectionDrag?.pointerId === event.pointerId) {
        updateSelectionDrag(event);
        updateHoveredCell(cellFromPoint(point));
      }
      return;
    }

    const cell = cellFromPoint(point);
    updateHoveredCell(cell);
    if (!cell) {
      return;
    }

    if (!pointerDown) {
      pointerDown = true;
      editor.beginStroke();
    }
    paintPoint(point);
  }

  function onTouchPointerEnd(event: PointerEvent): void {
    const finishingSelection = selectionDrag?.pointerId === event.pointerId;
    touchPoints.delete(event.pointerId);
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    if (touchPoints.size >= 2) {
      pinchState = null;
      beginPinch();
      return;
    }

    if (touchPoints.size === 1) {
      pinchState = null;
      pinching = touchGestureStarted;
      return;
    }

    touchGestureStarted = false;
    pinching = false;
    pinchState = null;
    if (finishingSelection) {
      finishSelectionDrag(event);
    }
    endPaintStroke();
    updateHoveredCell(null);
  }

  function finishPan(event: PointerEvent): void {
    if (panPointerId !== event.pointerId) {
      return;
    }

    panPointerId = null;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      onTouchPointerDown(event);
      return;
    }

    if (
      event.button !== 0 &&
      event.button !== 1 &&
      event.button !== 2
    ) {
      return;
    }

    event.preventDefault();
    if (event.button === 1 || (event.button === 0 && spacePressed)) {
      startPan(event);
      return;
    }

    if (editor.tool === 'select') {
      const operation = selectionOperationForPointer(event);
      if (operation === 'clear') {
        cancelSelectionDrag();
        editor.clearSelection();
        updateHoveredCell(cellFromPointer(event));
        return;
      }
      if (operation && beginSelectionDrag(event, operation)) {
        return;
      }
      updateHoveredCell(cellFromPointer(event));
      return;
    }

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
    if (event.pointerType === 'touch') {
      onTouchPointerMove(event);
      return;
    }

    if (panPointerId === event.pointerId) {
      panBy(event.clientX - panLastX, event.clientY - panLastY);
      panLastX = event.clientX;
      panLastY = event.clientY;
      return;
    }

    if (selectionDrag?.pointerId === event.pointerId) {
      updateSelectionDrag(event);
      updateHoveredCell(cellFromPointer(event));
      return;
    }

    updateHoveredCell(cellFromPointer(event));
    if (pointerDown) {
      applyPointer(event);
    }
  }

  function onPointerLeave(): void {
    if (
      !pointerDown &&
      panPointerId === null &&
      !pinching &&
      !selectionDrag
    ) {
      updateHoveredCell(null);
    }
  }

  function finishStroke(event: PointerEvent): void {
    if (!pointerDown) {
      return;
    }

    endPaintStroke();
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      onTouchPointerEnd(event);
      return;
    }

    if (panPointerId === event.pointerId) {
      finishPan(event);
      return;
    }

    if (finishSelectionDrag(event)) {
      return;
    }

    finishStroke(event);
  }

  function onPointerCancel(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      onTouchPointerEnd(event);
      return;
    }

    cancelSelectionDrag(event);
    finishPan(event);
    finishStroke(event);
  }

  onMount(() => {
    const isInteractiveTarget = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement &&
      Boolean(
        target.closest(
          'input, textarea, select, button, a, [contenteditable="true"]'
        )
      );
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isInteractiveTarget(event.target)) {
        return;
      }

      if (event.key === 'Escape' && selectionDrag) {
        event.preventDefault();
        cancelSelectionDrag();
        return;
      }

      if (event.code !== 'Space') {
        return;
      }

      event.preventDefault();
      spacePressed = true;
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') {
        spacePressed = false;
      }
    };
    const onBlur = (): void => {
      spacePressed = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  });

  $effect(() => {
    editor.project;
    editor.revision;
    editor.zoom;
    editor.selectedCells;
    viewCenterX;
    viewCenterY;
    hoveredCell;
    selectionDrag;
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
    class:pan-ready={spacePressed && panPointerId === null}
    class:panning={panPointerId !== null || pinching}
    aria-hidden="true"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerleave={onPointerLeave}
    onpointerup={onPointerUp}
    onpointercancel={onPointerCancel}
    onwheel={onWheel}
    onauxclick={(event) => event.preventDefault()}
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
    overscroll-behavior: contain;
  }

  canvas.fill-tool {
    cursor: cell;
  }

  canvas.pan-ready {
    cursor: grab;
  }

  canvas.panning {
    cursor: grabbing;
  }

  @media (max-width: 720px) {
    .canvas-host,
    canvas {
      min-height: 360px;
    }
  }
</style>
