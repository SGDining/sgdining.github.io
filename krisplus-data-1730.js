(() => {
  const originalFetch = window.fetch.bind(window);
  const target = 'data/krisplus-v2/chunk-07.txt';
  const manifestPath = 'data/krisplus-v2/manifest.json';
  let manifestPromise = null;

  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = originalFetch(manifestPath, { cache: 'no-store' })
        .then(r => {
          if (!r.ok) throw new Error(`Kris+ manifest ${r.status}`);
          return r.json();
        })
        .then(manifest => {
          const count = Number(manifest?.chunk_count);
          if (!Number.isInteger(count) || count < 7) throw new Error('Invalid Kris+ manifest chunk_count');
          if (!Number.isInteger(Number(manifest?.source_rows)) || Number(manifest.source_rows) <= 0) throw new Error('Invalid Kris+ manifest source_rows');
          return manifest;
        });
    }
    return manifestPromise;
  }

  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url;
    if (url === target || url?.endsWith('/' + target)) {
      const manifest = await loadManifest();
      const chunkCount = Number(manifest.chunk_count);
      const parts = await Promise.all(Array.from({ length: chunkCount - 6 }, (_, i) => i + 7).map(async n => {
        const path = `data/krisplus-v2/chunk-${String(n).padStart(2,'0')}.txt`;
        const r = await originalFetch(path, { ...(init || {}), cache: 'no-store' });
        if (!r.ok) throw new Error(`Kris+ outlet data ${r.status}: ${path}`);
        return r.text();
      }));
      return new Response(parts.join(''), { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return originalFetch(input, init);
  };

  const started = Date.now();
  const timer = setInterval(async () => {
    const stats = window.SGDiningKrisplusStats;
    if (stats) {
      try {
        const manifest = await loadManifest();
        stats.source_rows = Number(manifest.source_rows);
        stats.duplicates_removed = Number(manifest.duplicates_removed || 0);
        stats.unique_merchants = Number(manifest.unique_merchants || stats.unique_merchants || 0);
        stats.chunk_count = Number(manifest.chunk_count);
        stats.dataset_sha256 = manifest.sha256 || null;
        console.info('SGDining Kris+ manifest-backed dataset active', stats);
      } catch (err) {
        console.error('Kris+ manifest validation failed', err);
      }
      clearInterval(timer);
    } else if (Date.now() - started > 20000) {
      clearInterval(timer);
    }
  }, 100);
})();
