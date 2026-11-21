// Where the site lives. Pages are served from any sub-path, so every URL is built from
// the relative root that the build writes onto <body data-root>.

export const ROOT = new URL(document.body.dataset.root || './', location.href);
export const url = (path = '') => new URL(path, ROOT).href;
export const SECTION = document.body.dataset.section || '';
