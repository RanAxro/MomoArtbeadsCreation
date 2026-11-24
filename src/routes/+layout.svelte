<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import '$lib/i18n';
  import '../app.css';

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline caching is an enhancement; editing still works without it.
      });
    }
  });
</script>

<AppShell>
  {@render children()}
</AppShell>
