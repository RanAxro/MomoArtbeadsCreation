<script lang="ts">
  import { _ } from 'svelte-i18n';
  import {
    calculateAspectCrop,
    cropCenter,
    fitImageWithinViewport,
    type CropTransform
  } from '$modules/image-import/crop';

  interface Props {
    sourceUrl: string;
    sourceWidth: number;
    sourceHeight: number;
    aspectRatio: number;
    centerX: number;
    centerY: number;
    scale: number;
    onCropChange: (transform: CropTransform) => void;
    onRemove: () => void;
    onImageDrop: (file: File) => void;
  }

  type CropCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  interface DragState {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startCenterX: number;
    startCenterY: number;
  }

  interface ResizeState {
    pointerId: number;
    corner: CropCorner;
    anchorX: number;
    anchorY: number;
    directionX: 1 | -1;
    directionY: 1 | -1;
    minWidth: number;
    maxWidth: number;
  }

  let {
    sourceUrl,
    sourceWidth,
    sourceHeight,
    aspectRatio,
    centerX,
    centerY,
    scale,
    onCropChange,
    onRemove,
    onImageDrop
  }: Props = $props();

  let stage: HTMLDivElement | undefined = $state();
  let stageWidth = $state(0);
  let stageHeight = $state(0);
  let drag = $state<DragState | null>(null);
  let resize = $state<ResizeState | null>(null);
  let fileDragActive = $state(false);

  let crop = $derived(
    calculateAspectCrop(sourceWidth, sourceHeight, aspectRatio, centerX, centerY, scale)
  );
  let imageBounds = $derived(
    fitImageWithinViewport(stageWidth, stageHeight, sourceWidth, sourceHeight)
  );
  let frameBounds = $derived.by(() => {
    if (sourceWidth <= 0 || sourceHeight <= 0 || imageBounds.width <= 0) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }

    return {
      left: imageBounds.left + (crop.x / sourceWidth) * imageBounds.width,
      top: imageBounds.top + (crop.y / sourceHeight) * imageBounds.height,
      width: (crop.width / sourceWidth) * imageBounds.width,
      height: (crop.height / sourceHeight) * imageBounds.height
    };
  });
  let maxCropWidth = $derived(
    Math.min(imageBounds.width, imageBounds.height * aspectRatio)
  );

  function moveCropTo(
    nextCenterX: number,
    nextCenterY: number,
    nextScale = scale
  ): void {
    const nextCrop = calculateAspectCrop(
      sourceWidth,
      sourceHeight,
      aspectRatio,
      nextCenterX,
      nextCenterY,
      nextScale
    );
    onCropChange({
      ...cropCenter(nextCrop, sourceWidth, sourceHeight),
      scale: nextScale
    });
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    drag = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCenterX: centerX,
      startCenterY: centerY
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent): void {
    if (
      !drag ||
      drag.pointerId !== event.pointerId ||
      imageBounds.width <= 0 ||
      imageBounds.height <= 0
    ) {
      return;
    }

    moveCropTo(
      drag.startCenterX + (event.clientX - drag.startClientX) / imageBounds.width,
      drag.startCenterY + (event.clientY - drag.startClientY) / imageBounds.height,
      scale
    );
  }

  function finishDrag(event: PointerEvent): void {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    drag = null;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  function startResize(event: PointerEvent, corner: CropCorner): void {
    if (event.button !== 0 || maxCropWidth <= 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const directionX = corner.endsWith('right') ? 1 : -1;
    const directionY = corner.startsWith('bottom') ? 1 : -1;
    const anchorX =
      directionX === 1 ? frameBounds.left : frameBounds.left + frameBounds.width;
    const anchorY =
      directionY === 1 ? frameBounds.top : frameBounds.top + frameBounds.height;
    const availableX =
      directionX === 1
        ? imageBounds.left + imageBounds.width - anchorX
        : anchorX - imageBounds.left;
    const availableY =
      directionY === 1
        ? imageBounds.top + imageBounds.height - anchorY
        : anchorY - imageBounds.top;
    const maxWidth = Math.min(availableX, availableY * aspectRatio);

    if (maxWidth <= 0) {
      return;
    }

    resize = {
      pointerId: event.pointerId,
      corner,
      anchorX,
      anchorY,
      directionX,
      directionY,
      minWidth: Math.min(maxWidth, Math.max(28, maxCropWidth * 0.12)),
      maxWidth
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onResizeMove(event: PointerEvent): void {
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }

    const stageRect = stage?.getBoundingClientRect();
    if (!stageRect) {
      return;
    }
    const pointerX = event.clientX - stageRect.left;
    const pointerY = event.clientY - stageRect.top;
    const horizontalWidth =
      (pointerX - resize.anchorX) * resize.directionX;
    const verticalWidth =
      (pointerY - resize.anchorY) * resize.directionY * aspectRatio;
    const width = Math.max(
      resize.minWidth,
      Math.min(resize.maxWidth, (horizontalWidth + verticalWidth) / 2)
    );
    const height = width / aspectRatio;
    const left = resize.directionX === 1 ? resize.anchorX : resize.anchorX - width;
    const top = resize.directionY === 1 ? resize.anchorY : resize.anchorY - height;
    const sourceCrop = {
      x: ((left - imageBounds.left) / imageBounds.width) * sourceWidth,
      y: ((top - imageBounds.top) / imageBounds.height) * sourceHeight,
      width: (width / imageBounds.width) * sourceWidth,
      height: (height / imageBounds.height) * sourceHeight
    };

    onCropChange({
      ...cropCenter(sourceCrop, sourceWidth, sourceHeight),
      scale: width / maxCropWidth
    });
  }

  function finishResize(event: PointerEvent): void {
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }

    resize = null;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    const distance = event.shiftKey ? 0.05 : 0.01;
    const movement = {
      ArrowLeft: [-distance, 0],
      ArrowRight: [distance, 0],
      ArrowUp: [0, -distance],
      ArrowDown: [0, distance]
    } as const;
    const delta = movement[event.key as keyof typeof movement];

    if (!delta) {
      return;
    }

    event.preventDefault();
    moveCropTo(centerX + delta[0], centerY + delta[1]);
  }

  function onFileDragOver(event: DragEvent): void {
    event.preventDefault();
    fileDragActive = true;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function onFileDragLeave(event: DragEvent): void {
    const target = event.currentTarget as HTMLElement;
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !target.contains(nextTarget)) {
      fileDragActive = false;
    }
  }

  function onFileDrop(event: DragEvent): void {
    event.preventDefault();
    fileDragActive = false;
    const file = event.dataTransfer?.files[0];
    if (file) {
      onImageDrop(file);
    }
  }

  $effect(() => {
    const currentStage = stage;
    if (!currentStage) {
      return;
    }

    const updateSize = (): void => {
      stageWidth = currentStage.clientWidth;
      stageHeight = currentStage.clientHeight;
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(currentStage);

    return () => observer.disconnect();
  });
</script>

<div
  class="crop-stage"
  class:drop-active={fileDragActive}
  bind:this={stage}
  role="group"
  aria-label={$_('import.cropArea')}
  ondragover={onFileDragOver}
  ondragleave={onFileDragLeave}
  ondrop={onFileDrop}
>
  {#if imageBounds.width > 0 && crop.width > 0}
    <img
      src={sourceUrl}
      alt=""
      draggable={false}
      style:left={`${imageBounds.left}px`}
      style:top={`${imageBounds.top}px`}
      style:width={`${imageBounds.width}px`}
      style:height={`${imageBounds.height}px`}
    />
    <div
      class="crop-frame"
      class:resizing={drag !== null || resize !== null}
      style:left={`${frameBounds.left}px`}
      style:top={`${frameBounds.top}px`}
      style:width={`${frameBounds.width}px`}
      style:height={`${frameBounds.height}px`}
    >
      <button
        class="crop-move-surface"
        type="button"
        aria-label={`${$_('import.cropFrame')} · ${$_('import.cropPosition', {
          values: {
            x: Math.round(centerX * 100),
            y: Math.round(centerY * 100)
          }
        })}`}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={finishDrag}
        onpointercancel={finishDrag}
        onkeydown={onKeyDown}
      ></button>
      <button
        class="crop-handle top-left"
        type="button"
        aria-label={$_('import.resizeTopLeft')}
        onpointerdown={(event) => startResize(event, 'top-left')}
        onpointermove={onResizeMove}
        onpointerup={finishResize}
        onpointercancel={finishResize}
      ></button>
      <button
        class="crop-handle top-right"
        type="button"
        aria-label={$_('import.resizeTopRight')}
        onpointerdown={(event) => startResize(event, 'top-right')}
        onpointermove={onResizeMove}
        onpointerup={finishResize}
        onpointercancel={finishResize}
      ></button>
      <button
        class="crop-handle bottom-left"
        type="button"
        aria-label={$_('import.resizeBottomLeft')}
        onpointerdown={(event) => startResize(event, 'bottom-left')}
        onpointermove={onResizeMove}
        onpointerup={finishResize}
        onpointercancel={finishResize}
      ></button>
      <button
        class="crop-handle bottom-right"
        type="button"
        aria-label={$_('import.resizeBottomRight')}
        onpointerdown={(event) => startResize(event, 'bottom-right')}
        onpointermove={onResizeMove}
        onpointerup={finishResize}
        onpointercancel={finishResize}
      ></button>
    </div>
    <button class="remove-label" type="button" onclick={onRemove}>
      {$_('import.remove')}
    </button>
  {/if}
  {#if fileDragActive}
    <div class="drop-notice">{$_('import.dropActive')}</div>
  {/if}
</div>

<style>
  .crop-stage {
    position: relative;
    min-height: 340px;
    overflow: hidden;
    border: 1px solid var(--border-strong);
    background: #111111;
    touch-action: none;
    user-select: none;
  }

  .crop-stage.drop-active {
    border-color: #ffffff;
    outline: 2px solid #ffffff;
    outline-offset: -6px;
  }

  img {
    position: absolute;
    display: block;
    max-width: none;
    pointer-events: none;
  }

  .crop-frame {
    position: absolute;
    z-index: 1;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.95);
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.62);
    background: transparent;
    pointer-events: none;
    touch-action: none;
  }

  .crop-frame:focus-within,
  .crop-frame.resizing {
    border-color: #ffffff;
    box-shadow:
      inset 0 0 0 2px #111111,
      0 0 0 9999px rgba(0, 0, 0, 0.62);
  }

  .crop-move-surface {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: move;
    outline: none;
    pointer-events: auto;
    touch-action: none;
  }

  .crop-move-surface:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: -4px;
  }

  .crop-handle {
    position: absolute;
    z-index: 2;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    background: transparent;
    pointer-events: auto;
    touch-action: none;
  }

  .crop-handle::after {
    position: absolute;
    inset: 6px;
    border-color: #ffffff;
    border-style: solid;
    content: "";
  }

  .crop-handle:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: -3px;
  }

  .crop-handle.top-left {
    top: -14px;
    left: -14px;
    cursor: nwse-resize;
  }

  .crop-handle.top-left::after {
    border-width: 3px 0 0 3px;
  }

  .crop-handle.top-right {
    top: -14px;
    right: -14px;
    cursor: nesw-resize;
  }

  .crop-handle.top-right::after {
    border-width: 3px 3px 0 0;
  }

  .crop-handle.bottom-left {
    bottom: -14px;
    left: -14px;
    cursor: nesw-resize;
  }

  .crop-handle.bottom-left::after {
    border-width: 0 0 3px 3px;
  }

  .crop-handle.bottom-right {
    right: -14px;
    bottom: -14px;
    cursor: nwse-resize;
  }

  .crop-handle.bottom-right::after {
    border-width: 0 3px 3px 0;
  }

  .remove-label {
    position: absolute;
    left: 50%;
    bottom: 10px;
    z-index: 4;
    padding: 7px 10px;
    border: 1px solid rgba(255, 255, 255, 0.55);
    background: rgba(17, 17, 17, 0.86);
    color: #ffffff;
    font-size: 0.7rem;
    cursor: pointer;
    transform: translateX(-50%);
  }

  .remove-label:hover {
    border-color: #ffffff;
  }

  .drop-notice {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: grid;
    place-items: center;
    background: rgba(17, 17, 17, 0.72);
    color: #ffffff;
    font-size: 0.82rem;
    pointer-events: none;
  }
</style>
