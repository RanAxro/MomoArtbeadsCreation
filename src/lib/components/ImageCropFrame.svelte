<script lang="ts">
  import { _ } from 'svelte-i18n';
  import {
    calculateAspectCrop,
    cropCenter,
    fitImageWithinViewport,
    type CropCenter
  } from '$modules/image-import/crop';

  interface Props {
    sourceUrl: string;
    sourceWidth: number;
    sourceHeight: number;
    aspectRatio: number;
    centerX: number;
    centerY: number;
    onCropChange: (center: CropCenter) => void;
    onReplace: () => void;
  }

  interface DragState {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startCenterX: number;
    startCenterY: number;
  }

  let {
    sourceUrl,
    sourceWidth,
    sourceHeight,
    aspectRatio,
    centerX,
    centerY,
    onCropChange,
    onReplace
  }: Props = $props();

  let stage: HTMLDivElement | undefined = $state();
  let stageWidth = $state(0);
  let stageHeight = $state(0);
  let drag = $state<DragState | null>(null);

  let crop = $derived(
    calculateAspectCrop(sourceWidth, sourceHeight, aspectRatio, centerX, centerY)
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

  function moveCropTo(nextCenterX: number, nextCenterY: number): void {
    const nextCrop = calculateAspectCrop(
      sourceWidth,
      sourceHeight,
      aspectRatio,
      nextCenterX,
      nextCenterY
    );
    onCropChange(cropCenter(nextCrop, sourceWidth, sourceHeight));
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
      drag.startCenterY + (event.clientY - drag.startClientY) / imageBounds.height
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
  bind:this={stage}
  role="group"
  aria-label={$_('import.cropArea')}
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
    <button
      class="crop-frame"
      class:dragging={drag !== null}
      type="button"
      aria-label={`${$_('import.cropFrame')} · ${$_('import.cropPosition', {
        values: {
          x: Math.round(centerX * 100),
          y: Math.round(centerY * 100)
        }
      })}`}
      style:left={`${frameBounds.left}px`}
      style:top={`${frameBounds.top}px`}
      style:width={`${frameBounds.width}px`}
      style:height={`${frameBounds.height}px`}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={finishDrag}
      onpointercancel={finishDrag}
      onkeydown={onKeyDown}
    >
      <span class="crop-corner top-left"></span>
      <span class="crop-corner top-right"></span>
      <span class="crop-corner bottom-left"></span>
      <span class="crop-corner bottom-right"></span>
    </button>
    <button class="replace-label" type="button" onclick={onReplace}>
      {$_('import.replace')}
    </button>
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
    cursor: move;
    outline: none;
    touch-action: none;
  }

  .crop-frame:focus-visible {
    border-color: #ffffff;
    box-shadow:
      inset 0 0 0 2px #111111,
      0 0 0 9999px rgba(0, 0, 0, 0.62);
  }

  .crop-frame.dragging {
    border-color: #ffffff;
  }

  .crop-corner {
    position: absolute;
    width: 18px;
    height: 18px;
    border-color: #ffffff;
    border-style: solid;
    pointer-events: none;
  }

  .top-left {
    top: -1px;
    left: -1px;
    border-width: 3px 0 0 3px;
  }

  .top-right {
    top: -1px;
    right: -1px;
    border-width: 3px 3px 0 0;
  }

  .bottom-left {
    bottom: -1px;
    left: -1px;
    border-width: 0 0 3px 3px;
  }

  .bottom-right {
    right: -1px;
    bottom: -1px;
    border-width: 0 3px 3px 0;
  }

  .replace-label {
    position: absolute;
    right: 10px;
    bottom: 10px;
    z-index: 2;
    padding: 7px 10px;
    border: 1px solid rgba(255, 255, 255, 0.55);
    background: rgba(17, 17, 17, 0.86);
    color: #ffffff;
    font-size: 0.7rem;
    cursor: pointer;
  }

  .replace-label:hover {
    border-color: #ffffff;
  }

</style>
