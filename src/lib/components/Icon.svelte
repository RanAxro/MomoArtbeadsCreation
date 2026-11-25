<script module lang="ts">
  export type IconName =
    | 'select'
    | 'pencil'
    | 'eraser'
    | 'fill'
    | 'undo'
    | 'redo'
    | 'reset'
    | 'plus'
    | 'image'
    | 'close'
    | 'chevron-down'
    | 'sun'
    | 'moon'
    | 'arrow-left';
</script>

<script lang="ts">
  interface Props {
    name: IconName;
    size?: number;
    className?: string;
  }

  let { name, size = 18, className = '' }: Props = $props();
</script>

<svg
  class={`ui-icon ${className}`}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  aria-hidden="true"
  focusable="false"
>
  <use href={`/icons/ui-icons.svg#${name}`}></use>
</svg>

<style>
  .ui-icon {
    display: block;
    flex: 0 0 auto;
    overflow: visible;
    fill: none;
    stroke: currentColor;
  }
</style>
