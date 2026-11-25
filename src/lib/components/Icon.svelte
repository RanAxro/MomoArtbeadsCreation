<script lang="ts">
  import type { IconName } from '$model/icon.model';

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
