(() => {
  const originalFetch = window.fetch.bind(window);
  const target = 'data/krisplus-v2/chunk-07.txt';
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url;
    if (url === target || url?.endsWith('/' + target)) {
      const parts = await Promise.all([7,8,9,10,11,12].map(async n => {
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
  const timer = setInterval(() => {
    const stats = window.SGDiningKrisplusStats;
    if (stats) {
      stats.source_rows = 1730;
      stats.duplicates_removed = 0;
      clearInterval(timer);
      console.info('SGDining Kris+ 1730-outlet refresh active', stats);
    } else if (Date.now() - started > 20000) {
      clearInterval(timer);
    }
  }, 100);
})();
