<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { _ } from 'svelte-i18n';
  import { workspace } from '$modules/workspace/workspace.svelte';

  let { data }: { data: { projectId: string } } = $props();
  let notFound = $state(false);

  onMount(() => {
    void (async () => {
      await workspace.initialize();
      const opened = await workspace.select(data.projectId);
      if (opened) {
        await goto('/', { replaceState: true });
      } else {
        notFound = true;
      }
    })();
  });
</script>

<div class="redirect-state">
  {#if notFound}
    <p>{$_('common.notFound')}</p>
    <a class="button primary" href="/">{$_('common.backHome')}</a>
  {:else}
    <p>{$_('common.loading')}</p>
  {/if}
</div>

<style>
  .redirect-state {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 18px;
    height: 100%;
    background: var(--stage);
    color: var(--muted);
  }
</style>
