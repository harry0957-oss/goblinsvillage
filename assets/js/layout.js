const BASE = '/goblinsvillage/';

async function injectPartial(id, partialPath) {
  const container = document.getElementById(id);
  if (!container) return;

  const normalised = partialPath.replace(/^\//, '');
  const url = BASE + normalised;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
    }
    const html = await res.text();
    container.innerHTML = html;
  } catch (err) {
    console.error('[layout] Error injecting partial', id, err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  injectPartial('site-header', 'partials/header.html');
  injectPartial('site-footer', 'partials/footer.html');
});
