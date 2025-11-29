function getBasePath() {
  // For GitHub Pages project sites, the base is "/<repo-name>/"
  // Example: "/goblinsvillage/"
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    // Fallback to root
    return '/';
  }

  const repo = segments[0];
  const base = `/${repo}/`;
  return base;
}

const BASE = getBasePath();

async function injectPartial(id, partialPath) {
  const container = document.getElementById(id);
  if (!container) return;

  const cleanPath = partialPath.replace(/^\//, '');
  const url = `${BASE}${cleanPath}`;

  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
    }
    const html = await res.text();
    container.innerHTML = html;
    console.log(`[layout] Injected ${id} from ${url}`);
  } catch (err) {
    console.error(`[layout] Error injecting ${id} from ${url}`, err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  injectPartial('site-header', 'partials/header.html');
  injectPartial('site-footer', 'partials/footer.html');
});
