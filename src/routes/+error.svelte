<script lang="ts">
  import { page } from '$app/state';
  import { _ } from 'svelte-i18n';
</script>

<div class="panel error-page">
  <p class="eyebrow">Page not found</p>
  <h1>{page.status}</h1>
  <h2>{page.status === 404 ? $_('common.notFound') : $_('board.error')}</h2>
  <p>{page.error?.message ?? ''}</p>
  <a class="button primary" href="/">{$_('common.backHome')}</a>
</div>

<style>
  .error-page {
    display: grid;
    place-items: center;
    align-content: center;
    height: 100%;
    padding: 40px;
    background: var(--stage);
    text-align: center;
  }

  .error-page h1 {
    margin-bottom: 0;
    color: var(--border-strong);
    font-size: clamp(7rem, 20vw, 15rem);
    line-height: 0.8;
  }

  .error-page h2 {
    margin: 20px 0 8px;
    font-size: 2rem;
  }

  .error-page p:not(.eyebrow) {
    margin-bottom: 24px;
    color: var(--text-muted);
  }
</style>
