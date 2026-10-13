import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const articlesDir = path.resolve('src/content/articles');
const indexHtmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexHtmlPath)) {
  console.error('dist/index.html not found, skipping prerender.');
  process.exit(0);
}

const template = fs.readFileSync(indexHtmlPath, 'utf8');

function extractYamlValue(yaml, fieldPattern) {
  const dbl = yaml.match(new RegExp(`(?:^|\\n)(?:${fieldPattern}):\\s*"([^"\\r\\n]*)"`, 'i'));
  if (dbl) return dbl[1].trim();
  const sgl = yaml.match(new RegExp(`(?:^|\\n)(?:${fieldPattern}):\\s*'([^'\\r\\n]*)'`, 'i'));
  if (sgl) return sgl[1].trim();
  const unq = yaml.match(new RegExp(`(?:^|\\n)(?:${fieldPattern}):\\s*([^\\r\\n#]+)`, 'i'));
  if (unq) return unq[1].trim().replace(/^["']|["']$/g, '');
  return '';
}

function resolveImage(img) {
  if (!img) return '/web/logo-apercu.png';
  let clean = img.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  if (clean.startsWith('./')) clean = clean.replace(/^\.\//, '/');
  else if (!clean.startsWith('/')) clean = `/${clean}`;
  if (!/\.(jpe?g|png|svg|webp|gif|avif)$/i.test(clean)) clean = `${clean}.jpg`;
  return clean;
}

const repoPrefix = '/LaRadioTech';
const baseUrl = (process.env.APP_URL || process.env.VITE_APP_URL || 'https://lucasgallone.github.io').replace(/\/+$/, '');

function toFullUrl(urlPath) {
  if (!urlPath) return urlPath;
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) return urlPath;
  const clean = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  const base = baseUrl.endsWith(repoPrefix) ? baseUrl : `${baseUrl}${repoPrefix}`;
  return `${base}${clean.startsWith('/') ? clean : '/' + clean}`;
}

function createPageHtml(title, description, image, type = 'website', pageUrl = '') {
  let html = template;
  const fullImage = toFullUrl(image);
  const fullPageUrl = toFullUrl(pageUrl);

  // Title
  html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);

  // Meta description
  html = html.replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/i, `<meta name="description" content="${description}" />`);

  // OG tags
  html = html.replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i, `<meta property="og:title" content="${title}" />`);
  html = html.replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i, `<meta property="og:description" content="${description}" />`);
  html = html.replace(/<meta\s+property="og:image"\s+content=".*?"\s*\/?>/i, `<meta property="og:image" content="${fullImage}" />`);
  html = html.replace(/<meta\s+property="og:type"\s+content=".*?"\s*\/?>/i, `<meta property="og:type" content="${type}" />`);
  if (fullPageUrl) {
    if (html.includes('property="og:url"')) {
      html = html.replace(/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i, `<meta property="og:url" content="${fullPageUrl}" />`);
    } else {
      html = html.replace(/<meta\s+property="og:type"/i, `<meta property="og:url" content="${fullPageUrl}" />\n    <meta property="og:type"`);
    }
  }

  // Twitter tags
  html = html.replace(/<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:title" content="${title}" />`);
  html = html.replace(/<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:description" content="${description}" />`);
  html = html.replace(/<meta\s+name="twitter:image"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:image" content="${fullImage}" />`);

  return html;
}

// 1. Mettre à jour dist/index.html avec la configuration générale
const defaultTitle = 'La RadioTech';
const defaultDesc = 'Pour découvrir, apprendre, comprendre.';
const defaultImg = '/web/logo-apercu.png';
const homeHtml = createPageHtml(defaultTitle, defaultDesc, defaultImg, 'website', '/');
fs.writeFileSync(indexHtmlPath, homeHtml);

// 2. Créer dist/404.html pour GitHub Pages
fs.writeFileSync(path.join(distDir, '404.html'), homeHtml);

// 3. Créer dist/a-propos/index.html
const aboutDir = path.join(distDir, 'a-propos');
fs.mkdirSync(aboutDir, { recursive: true });
fs.writeFileSync(path.join(aboutDir, 'index.html'), homeHtml);

// 4. Parcourir tous les articles pour générer les pages avec aperçu Discord/Facebook
if (fs.existsSync(articlesDir)) {
  const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(articlesDir, file), 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) continue;

    const yaml = match[1];
    const fileSlug = file.replace(/\.md$/, '');
    const customSlug = extractYamlValue(yaml, 'slug');
    const slug = customSlug || fileSlug;

    const rawTitle = extractYamlValue(yaml, 'title') || slug;
    const title = `${rawTitle} | La RadioTech`;
    const description = extractYamlValue(yaml, 'description') || defaultDesc;
    const image = resolveImage(extractYamlValue(yaml, 'image'));

    const articleHtml = createPageHtml(title, description, image, 'article', `/${slug}`);

    // Dossier slug/index.html (idéal pour GitHub Pages avec URL propre /<slug>)
    const articleDir = path.join(distDir, slug);
    fs.mkdirSync(articleDir, { recursive: true });
    fs.writeFileSync(path.join(articleDir, 'index.html'), articleHtml);

    // Fichier slug.html de secours
    fs.writeFileSync(path.join(distDir, `${slug}.html`), articleHtml);

    console.log(`[prerender] Généré aperçu social pour: /${slug} -> "${title}" (image: ${image})`);
  }
}

console.log('[prerender] Pré-rendu des métadonnées OpenGraph et Twitter terminé.');
