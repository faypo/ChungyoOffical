// Load all dm-pic images using Vite glob import
const imageModules = import.meta.glob('../dm-pic/*.jpg', { eager: true });

function getSortKey(name) {
  if (name === 'cover') return -1;
  const n = parseInt(name.split('-')[0]);
  return isNaN(n) ? 999 : n;
}

export const pages = Object.entries(imageModules)
  .map(([path, mod]) => ({
    src: mod.default,
    name: path.split('/').pop().replace('.jpg', ''),
  }))
  .sort((a, b) => getSortKey(a.name) - getSortKey(b.name));

export const TOTAL_PAGES = pages.length;
