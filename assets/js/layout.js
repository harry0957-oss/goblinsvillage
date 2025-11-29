async function injectPartial(id, url) {
  const container = document.getElementById(id);
  if (!container) return;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    container.innerHTML = await res.text();
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  injectPartial('site-header', '/partials/header.html');
  injectPartial('site-footer', '/partials/footer.html');
});
