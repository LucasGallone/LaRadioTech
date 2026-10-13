import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Radio,
  Sun,
  Moon,
  Calendar,
  Tag,
  ArrowLeft,
  ChevronRight,
  Clock,
  FileText,
  Search,
  X,
  Info,
  ListOrdered,
  ArrowUp,
  Share2,
  Check,
  ZoomIn,
  User
} from 'lucide-react';

interface Article {
  slug: string;
  title: string;
  description: string;
  date: string;
  updateDate?: string;
  author?: string;
  image: string;
  tags: string[];
  content: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

// Fonction de génération d'identifiant d'ancrage URL
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Extraction automatique des titres (H2, H3) pour la table des matières
// Aucun sommaire ne doit apparaître s'il n'y a pas d'éléments avec ## dans le md
function extractHeadings(content: string): TocItem[] {
  const lines = content.split('\n');
  const hasH2 = lines.some((line) => line.trim().startsWith('## '));
  if (!hasH2) {
    return [];
  }

  const headings: TocItem[] = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      const raw = trimmed.slice(3).replace(/\*\*/g, '').trim();
      headings.push({ id: slugify(raw), text: raw, level: 2 });
    } else if (trimmed.startsWith('### ')) {
      const raw = trimmed.slice(4).replace(/\*\*/g, '').trim();
      headings.push({ id: slugify(raw), text: raw, level: 3 });
    }
  });
  return headings;
}

// Estimation dynamique du temps de lecture (base standard de 200 mots/min sur le texte réel à lire uniquement)
function estimateReadingTime(content: string): number {
  let clean = content.replace(/^---[\s\S]*?---\r?\n?/, '');
  // Supprimer les codes d'intégration des images ![alt](url)
  clean = clean.replace(/!\[.*?\]\(.*?\)/g, '');
  // Supprimer les blocs de code et code inline
  clean = clean.replace(/```[\s\S]*?```/g, '');
  clean = clean.replace(/`[^`]+`/g, '');
  // Conserver le libellé des liens [texte](url) mais supprimer l'URL
  clean = clean.replace(/\[(.*?)\]\(.*?\)/g, '$1');
  // Supprimer les balises HTML éventuelles
  clean = clean.replace(/<[^>]+>/g, ' ');
  // Supprimer les symboles de structure markdown (titres #, puces -, citations >)
  clean = clean.replace(/(?:^|\n)\s*[#*>\-]+\s+/g, ' ');
  // Supprimer les lignes de séparation ---
  clean = clean.replace(/(?:^|\n)\s*---+\s*(?:\n|$)/g, ' ');
  // Supprimer les séparateurs de tableau et marqueurs de style
  clean = clean.replace(/[*_~|]/g, ' ');

  const words = clean.trim().split(/\s+/).filter((w) => w.length > 0).length;
  return Math.max(1, Math.ceil(words / 200));
}

// Extraction robuste d'un champ YAML (prend en charge les guillemets doubles, simples ou sans guillemets, même avec apostrophes)
function extractYamlValue(yaml: string, fieldPattern: string): string {
  // 1) Entre guillemets doubles : ex: title: "Les différents types d'antennes"
  const dbl = yaml.match(new RegExp(`(?:^|\\n)(?:${fieldPattern}):\\s*"([^"\\r\\n]*)"`, 'i'));
  if (dbl) return dbl[1].trim();

  // 2) Entre guillemets simples : ex: title: 'Les différents types d\'antennes'
  const sgl = yaml.match(new RegExp(`(?:^|\\n)(?:${fieldPattern}):\\s*'([^'\\r\\n]*)'`, 'i'));
  if (sgl) return sgl[1].trim();

  // 3) Sans guillemets : ex: title: Les différents types d'antennes
  const unq = yaml.match(new RegExp(`(?:^|\\n)(?:${fieldPattern}):\\s*([^\\r\\n#]+)`, 'i'));
  if (unq) {
    return unq[1].trim().replace(/^["']|["']$/g, '');
  }

  return '';
}

// Analyseur de Frontmatter pour les fichiers Markdown
function parseFrontmatter(filePath: string, rawContent: string): Article {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  let title = '';
  let description = '';
  let author = '';
  let date = '';
  let updateDate = '';
  let image = '';
  let customSlug = '';
  let tags: string[] = [];
  let content = rawContent;

  if (match) {
    const yaml = match[1];
    content = match[2].trim();

    title = extractYamlValue(yaml, 'title');
    description = extractYamlValue(yaml, 'description');
    author = extractYamlValue(yaml, 'author|auteur');
    date = extractYamlValue(yaml, 'date');
    updateDate = extractYamlValue(yaml, 'updated|update_date|updateDate|updated_at|last_updated|update|date_mise_a_jour|mise_a_jour|maj');
    image = extractYamlValue(yaml, 'image');
    customSlug = extractYamlValue(yaml, 'slug');

    const tagsInlineMatch = yaml.match(/tags:\s*\[([^\]]*)\]/);
    if (tagsInlineMatch) {
      tags = tagsInlineMatch[1]
        .split(',')
        .map((t) => t.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      const tagListMatch = yaml.match(/tags:\s*\n((?:\s*-\s*[^\n\r]+\r?\n?)+)/);
      if (tagListMatch) {
        tags = tagListMatch[1]
          .split('\n')
          .map((l) => l.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      }
    }
  }

  const fileSlug = filePath.split('/').pop()?.replace(/\.md$/, '') || '';
  const slug = customSlug || fileSlug;

  return {
    slug,
    title: title || slug,
    description,
    date,
    updateDate,
    author: author || undefined,
    image,
    tags,
    content,
  };
}

// Formatage de la date au format JJ/MM/AAAA (ex: "13/10/2026")
function formatDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  
  // Format DD/MM/YYYY ou D/M/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('/');
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  // Format YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  try {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return trimmed;
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return trimmed;
  }
}

// Nettoyage et résolution du chemin de l'image
function resolveImageUrl(img: string | undefined): string | null {
  if (!img) return null;
  let clean = img.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  const baseUrl = import.meta.env.BASE_URL || './';
  clean = clean.replace(/^\.\//, '').replace(/^\//, '');
  let resolved = `${baseUrl === './' ? './' : baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}${clean}`;
  // Si aucune extension de fichier standard n'est spécifiée, ajouter .jpg par défaut
  if (!/\.(jpe?g|png|svg|webp|gif|avif)$/i.test(resolved)) {
    resolved = `${resolved}.jpg`;
  }
  return resolved;
}

// Ratios d'aspect connus des images pour un rendu immédiat et sans saut d'affichage
const KNOWN_IMAGE_RATIOS: Record<string, number> = {
  '/img/circulaire-design-americain.jpg': 100 / 160,
  '/img/circulaires-dipoles-croises.jpg': 173 / 256,
  '/img/dipole-fm-sommital.jpg': 170 / 256,
  '/img/dipoles-dab-couples.jpg': 149 / 160,
  '/img/doublet-sur-mat.jpg': 107 / 160,
  '/img/img-principale-article-types-antennes.jpg': 160 / 90,
};

// Composant de groupe d'images avec alignement proportionnel rigoureux
function ArticleImageGroup({
  images,
  isDark,
  onImageClick
}: {
  images: Array<{ src: string; alt: string; caption: string; key: string }>;
  isDark: boolean;
  onImageClick?: (src: string, caption?: string) => void;
}) {
  const [loadedRatios, setLoadedRatios] = useState<Record<string, number>>({});

  const getRatio = (src: string) => {
    if (loadedRatios[src]) return loadedRatios[src];
    const cleanSrc = src.replace(/^https?:\/\/[^/]+/, '');
    if (KNOWN_IMAGE_RATIOS[cleanSrc]) return KNOWN_IMAGE_RATIOS[cleanSrc];
    const match = Object.keys(KNOWN_IMAGE_RATIOS).find(
      (k) => cleanSrc.endsWith(k) || k.endsWith(cleanSrc)
    );
    if (match) return KNOWN_IMAGE_RATIOS[match];
    return 1;
  };

  const handleImageLoad = (src: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      const ratio = img.naturalWidth / img.naturalHeight;
      setLoadedRatios((prev) => {
        if (prev[src] === ratio) return prev;
        return { ...prev, [src]: ratio };
      });
    }
  };

  if (images.length === 1) {
    const img = images[0];
    return (
      <figure className="my-8 flex flex-col items-center w-full">
        <div className="w-full flex items-center justify-center">
          <div
            onClick={() => onImageClick?.(img.src, img.caption)}
            className={`group/img relative inline-block overflow-hidden rounded-2xl border cursor-zoom-in transition-all duration-300 hover:shadow-xl max-w-full ${
              isDark
                ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                : 'border-[#cbd3dd] bg-transparent hover:border-[#b8c2ce]'
            }`}
          >
            <img
              src={img.src}
              alt={img.caption || img.alt}
              className="w-auto max-w-full h-auto max-h-[520px] object-contain mx-auto block transition-transform duration-300 group-hover/img:scale-[1.01]"
              loading="lazy"
            />
            {/* Badge d'agrandissement affiché uniquement au survol direct sur l'image */}
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/65 text-white text-xs font-medium opacity-0 group-hover/img:opacity-100 transition-opacity backdrop-blur-xs flex items-center gap-1.5 pointer-events-none shadow-md">
              <ZoomIn className="w-3.5 h-3.5 text-sky-400" />
              <span>Agrandir</span>
            </div>
          </div>
        </div>
        {img.caption && (
          <figcaption
            className={`text-center text-xs sm:text-sm mt-3 font-medium not-italic max-w-2xl px-2 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            {img.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // Pour 2 ou plusieurs images côte à côte :
  // Distribution proportionnelle selon le ratio de chaque image (flex-grow = ratio)
  // afin que TOUTES les images de la rangée partagent STRICTEMENT la même hauteur,
  // sans aucun rognage, sans aucune bande blanche, avec un alignement parfait des photos et de leurs légendes.
  const sumRatios = images.reduce((acc, img) => acc + getRatio(img.src), 0);
  const targetMaxHeight = 440;
  const gapPx = 24;
  const calculatedMaxWidth = Math.min(
    920,
    Math.round(targetMaxHeight * sumRatios + (images.length - 1) * gapPx)
  );

  const groupId = useMemo(() => `img-row-${Math.random().toString(36).substring(2, 9)}`, []);

  return (
    <div
      className={`my-6 sm:my-8 flex ${
        images.length === 2 ? 'flex-row gap-3 sm:gap-6' : 'flex-col sm:flex-row gap-6'
      } items-start justify-center mx-auto w-full ${groupId}`}
      style={{ maxWidth: `${calculatedMaxWidth}px` }}
    >
      <style>{`
        ${images
          .map(
            (img, idx) => `
          .${groupId} .article-col-${idx} {
            flex: ${getRatio(img.src)} 1 0px !important;
            min-width: 0 !important;
            max-width: 100% !important;
          }
        `
          )
          .join('\n')}
      `}</style>

      {images.map((img, idx) => (
        <figure
          key={img.key || idx}
          className={`article-col-${idx} flex flex-col items-center w-full min-w-0 ${
            images.length === 2 ? '' : 'max-w-md mx-auto sm:max-w-none'
          }`}
        >
          {/* Cadre de l'image : épouse directement l'image sans bandes blanches et sans couper */}
          <div
            onClick={() => onImageClick?.(img.src, img.caption)}
            className={`group/img relative block w-full overflow-hidden rounded-xl sm:rounded-2xl border cursor-zoom-in transition-all duration-300 hover:shadow-xl ${
              isDark
                ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                : 'border-[#cbd3dd] bg-transparent hover:border-[#b8c2ce]'
            }`}
          >
            <img
              src={img.src}
              alt={img.caption || img.alt}
              onLoad={(e) => handleImageLoad(img.src, e)}
              className="w-full h-auto block transition-transform duration-300 group-hover/img:scale-[1.01]"
              loading="lazy"
            />
            {/* Badge discret d'agrandissement affiché UNIQUEMENT au survol direct sur l'image */}
            <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg bg-black/65 text-white text-[10px] sm:text-xs font-medium opacity-0 group-hover/img:opacity-100 transition-opacity backdrop-blur-xs flex items-center gap-1 sm:gap-1.5 pointer-events-none shadow-md">
              <ZoomIn className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-400" />
              <span>Agrandir</span>
            </div>
          </div>
          {/* Légende sous l'image, parfaitement alignée horizontalement */}
          {img.caption && (
            <figcaption
              className={`text-center text-[11px] sm:text-xs md:text-sm mt-2 sm:mt-3 font-medium not-italic w-full px-1 sm:px-2 leading-tight sm:leading-normal ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {img.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

// Composant de rendu Markdown avec ancres d'identification automatiques et support des images agrandissables
function MarkdownRenderer({
  content,
  isDark,
  onImageClick
}: {
  content: string;
  isDark: boolean;
  onImageClick?: (src: string, caption?: string) => void;
}) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let tableRows: string[] = [];
  let inTable = false;
  let listItems: string[] = [];
  let inList = false;
  const skippedIndices = new Set<number>();

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      elements.push(
        <ul
          key={key}
          className={`list-disc pl-6 space-y-2.5 my-4 font-normal ${
            isDark ? 'text-slate-200' : 'text-slate-800'
          }`}
        >
          {listItems.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderFormattedText(item, isDark)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = (key: string) => {
    if (tableRows.length > 0) {
      const headerLine = tableRows[0];
      const dataLines = tableRows.slice(2);

      const parseCells = (line: string) =>
        line
          .split('|')
          .map((c) => c.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

      const headers = parseCells(headerLine);

      elements.push(
        <div
          key={key}
          className={`overflow-x-auto my-6 rounded-2xl border shadow-xs ${
            isDark ? 'border-slate-800 bg-slate-900/60' : 'border-[#cbd3dd] bg-[#f8f9fb]'
          }`}
        >
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr
                className={`border-b ${
                  isDark
                    ? 'bg-slate-800/60 border-slate-700/60 text-white'
                    : 'bg-[#e2e6ec] border-[#cbd3dd] text-slate-950 font-bold'
                }`}
              >
                {headers.map((h, i) => (
                  <th key={i} className="py-3 px-4 font-bold text-xs sm:text-sm uppercase tracking-wider">
                    {renderFormattedText(h, isDark)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody
              className={`divide-y ${
                isDark
                  ? 'divide-slate-800 text-slate-200'
                  : 'divide-[#dce2ec] text-slate-800'
              }`}
            >
              {dataLines.map((rowLine, rowIdx) => {
                const cells = parseCells(rowLine);
                return (
                  <tr
                    key={rowIdx}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-slate-800/40' : 'hover:bg-[#eaedf2]'
                    }`}
                  >
                    {cells.map((c, cellIdx) => (
                      <td key={cellIdx} className="py-3 px-4 text-xs sm:text-sm leading-relaxed">
                        {renderFormattedText(c, isDark)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  lines.forEach((line, index) => {
    if (skippedIndices.has(index)) {
      return;
    }
    const trimmed = line.trim();

    // Tableau (| ... |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (inList) flushList(`list-before-table-${index}`);
      inTable = true;
      tableRows.push(trimmed);
      return;
    } else if (inTable) {
      flushTable(`table-${index}`);
    }

    // Liste à puces (- ...)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true;
      listItems.push(trimmed.slice(2));
      return;
    } else if (inList) {
      flushList(`list-${index}`);
    }

    // Titres H1, H2, H3 avec identifiant ancré pour le sommaire
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1
          key={index}
          className={`text-2xl sm:text-3xl font-extrabold mt-8 mb-4 tracking-tight ${
            isDark ? 'text-white' : 'text-slate-950'
          }`}
        >
          {trimmed.slice(2)}
        </h1>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      const rawText = trimmed.slice(3).replace(/\*\*/g, '').trim();
      const headingId = slugify(rawText);
      elements.push(
        <h2
          id={headingId}
          key={index}
          className={`scroll-mt-24 text-xl sm:text-2xl font-bold mt-8 mb-3 tracking-tight border-b pb-2.5 ${
            isDark
              ? 'text-white border-slate-800'
              : 'text-slate-950 border-[#cbd3dd]'
          }`}
        >
          {trimmed.slice(3)}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith('### ')) {
      const rawText = trimmed.slice(4).replace(/\*\*/g, '').trim();
      const headingId = slugify(rawText);
      elements.push(
        <h3
          id={headingId}
          key={index}
          className={`scroll-mt-24 text-lg sm:text-xl font-semibold mt-6 mb-2.5 ${
            isDark ? 'text-white' : 'text-slate-950'
          }`}
        >
          {trimmed.slice(4)}
        </h3>
      );
      return;
    }

    // Ligne de séparation
    if (trimmed === '---') {
      elements.push(
        <hr
          key={index}
          className={`my-7 ${isDark ? 'border-slate-800' : 'border-[#cbd3dd]'}`}
        />
      );
      return;
    }

    // Citations / avertissements
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={index}
          className={`border-l-4 p-4 my-5 rounded-r-xl text-sm leading-relaxed ${
            isDark
              ? 'border-sky-400 bg-sky-950/30 text-slate-200'
              : 'border-sky-600 bg-[#e0e7f1] text-slate-900'
          }`}
        >
          {renderFormattedText(trimmed.slice(2), isDark)}
        </blockquote>
      );
      return;
    }

    // Images multiples sur une seule ligne : ![alt1](src1) ![alt2](src2)
    const inlineMatches = Array.from(trimmed.matchAll(/!\[(.*?)\]\((.*?)\)/g));
    if (inlineMatches.length >= 2) {
      if (inList) flushList(`list-before-img-${index}`);
      if (inTable) flushTable(`table-before-img-${index}`);
      const group = inlineMatches.map((m, mIdx) => {
        const alt = m[1].trim();
        const src = resolveImageUrl(m[2].trim()) || m[2].trim();
        let caption = alt.replace(/^\*+|\*+$/g, '').replace(/^_+|_+$/g, '').replace(/<\/?em>/gi, '').replace(/<\/?i>/gi, '').trim();
        return { src, alt, caption, key: `img-${index}-${mIdx}` };
      });
      elements.push(
        <ArticleImageGroup
          key={`img-grid-${index}`}
          images={group}
          isDark={isDark}
          onImageClick={onImageClick}
        />
      );
      return;
    }

    // Images Markdown : ![alt](src) avec détection consécutive pour mise en page côte à côte automatique
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      if (inList) flushList(`list-before-img-${index}`);
      if (inTable) flushTable(`table-before-img-${index}`);
      const altText = imgMatch[1].trim();
      const rawSrc = imgMatch[2].trim();
      const imgSrc = resolveImageUrl(rawSrc) || rawSrc;

      // Détection automatique de la légende sur la ligne suivante (ex: *Figure 1 : Antenne circulaire...*)
      let captionText = '';
      let nextIdx = index + 1;
      while (nextIdx < lines.length && lines[nextIdx].trim() === '') {
        nextIdx++;
      }
      if (nextIdx < lines.length) {
        const nextTrimmed = lines[nextIdx].trim();
        // Reconnaît une ligne en italique simple (*...* ou _..._) ou balise <em>
        const italicMatch = nextTrimmed.match(/^(\*|_)(.*?)\1$/);
        if (italicMatch && !nextTrimmed.startsWith('**') && !nextTrimmed.startsWith('__')) {
          captionText = italicMatch[2].trim();
          skippedIndices.add(nextIdx); // Évite de l'afficher une seconde fois comme paragraphe ordinaire
          nextIdx++;
        } else if (nextTrimmed.startsWith('<em>') && nextTrimmed.endsWith('</em>')) {
          captionText = nextTrimmed.replace(/^<em>/, '').replace(/<\/em>$/, '').trim();
          skippedIndices.add(nextIdx);
          nextIdx++;
        }
      }
      // Si aucune légende séparée n'a été spécifiée mais qu'un altText existe, l'utiliser comme légende
      if (!captionText && altText) {
        captionText = altText;
      }
      // S'assurer que la légende ne conserve aucun marqueur d'italique résiduel
      if (captionText) {
        captionText = captionText.replace(/^\*+|\*+$/g, '').replace(/^_+|_+$/g, '').replace(/<\/?em>/gi, '').replace(/<\/?i>/gi, '').trim();
      }

      // Regrouper les images consécutives (ex: deux images côte à côte)
      const imageGroup: Array<{ src: string; alt: string; caption: string; key: string }> = [
        { src: imgSrc, alt: altText, caption: captionText, key: `img-${index}` }
      ];

      let lookaheadIdx = nextIdx;
      while (lookaheadIdx < lines.length && lines[lookaheadIdx].trim() === '') {
        lookaheadIdx++;
      }
      while (lookaheadIdx < lines.length) {
        const nextLineTrimmed = lines[lookaheadIdx].trim();
        const nextMatch = nextLineTrimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
        if (!nextMatch) break;

        const currentImgIdx = lookaheadIdx;
        skippedIndices.add(currentImgIdx);
        const nextAlt = nextMatch[1].trim();
        const nextSrc = resolveImageUrl(nextMatch[2].trim()) || nextMatch[2].trim();
        let nextCaption = '';

        let scanCaptionIdx = currentImgIdx + 1;
        while (scanCaptionIdx < lines.length && lines[scanCaptionIdx].trim() === '') {
          scanCaptionIdx++;
        }
        if (scanCaptionIdx < lines.length) {
          const candidate = lines[scanCaptionIdx].trim();
          const itMatch = candidate.match(/^(\*|_)(.*?)\1$/);
          if (itMatch && !candidate.startsWith('**') && !candidate.startsWith('__')) {
            nextCaption = itMatch[2].trim();
            skippedIndices.add(scanCaptionIdx);
            scanCaptionIdx++;
          } else if (candidate.startsWith('<em>') && candidate.endsWith('</em>')) {
            nextCaption = candidate.replace(/^<em>/, '').replace(/<\/em>$/, '').trim();
            skippedIndices.add(scanCaptionIdx);
            scanCaptionIdx++;
          }
        }
        if (!nextCaption && nextAlt) {
          nextCaption = nextAlt;
        }
        if (nextCaption) {
          nextCaption = nextCaption.replace(/^\*+|\*+$/g, '').replace(/^_+|_+$/g, '').replace(/<\/?em>/gi, '').replace(/<\/?i>/gi, '').trim();
        }

        imageGroup.push({
          src: nextSrc,
          alt: nextAlt,
          caption: nextCaption,
          key: `img-${currentImgIdx}`
        });

        lookaheadIdx = scanCaptionIdx;
        while (lookaheadIdx < lines.length && lines[lookaheadIdx].trim() === '') {
          lookaheadIdx++;
        }
      }

      elements.push(
        <ArticleImageGroup
          key={`img-group-${index}`}
          images={imageGroup}
          isDark={isDark}
          onImageClick={onImageClick}
        />
      );
      return;
    }

    // Paragraphes classiques
    if (trimmed.length > 0) {
      elements.push(
        <p
          key={index}
          className={`my-3.5 font-normal leading-relaxed text-sm sm:text-base ${
            isDark ? 'text-slate-200' : 'text-slate-800'
          }`}
        >
          {renderFormattedText(trimmed, isDark)}
        </p>
      );
    }
  });

  if (inTable) flushTable('table-final');
  if (inList) flushList('list-final');

  return <div className="space-y-1">{elements}</div>;
}

// Mise en valeur gras et code
function renderFormattedText(text: string, isDark: boolean): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong
          key={i}
          className={`font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className={`px-1.5 py-0.5 rounded-md font-mono text-xs border ${
            isDark
              ? 'bg-slate-800/80 text-sky-300 border-slate-700/60'
              : 'bg-[#dde3ec] text-slate-900 border-[#cbd3dd] font-medium'
          }`}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// Conversion d'une date en timestamp pour le tri chronologique (compatible DD/MM/YYYY et YYYY-MM-DD)
function parseDateToTimestamp(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const trimmed = dateStr.trim();
  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  const t = new Date(trimmed).getTime();
  return isNaN(t) ? 0 : t;
}

// Chargement dynamique des articles Markdown (.md)
function loadAllArticles(): Article[] {
  const modules = import.meta.glob([
    '/src/content/articles/*.md',
    '/src/content/*.md',
    '/content/articles/*.md',
    '/content/*.md',
    '/*.md'
  ], { query: '?raw', eager: true }) as Record<string, any>;
  const list: Article[] = [];
  const seenSlugs = new Set<string>();

  for (const path in modules) {
    // Ignorer les fichiers de documentation système ou markdown généraux
    if (path.toLowerCase().endsWith('readme.md')) continue;

    const raw = typeof modules[path] === 'string' ? modules[path] : modules[path].default || '';
    if (raw) {
      const parsed = parseFrontmatter(path, raw);
      if (!seenSlugs.has(parsed.slug)) {
        seenSlugs.add(parsed.slug);
        list.push(parsed);
      }
    }
  }

  // Tri chronologique décroissant : l'article le plus récent en premier
  return list.sort((a, b) => {
    const timeA = parseDateToTimestamp(a.date);
    const timeB = parseDateToTimestamp(b.date);
    return timeB - timeA;
  });
}

const initialArticles = loadAllArticles();

const repoBase = (() => {
  if (typeof window === 'undefined') return '';
  const pathname = window.location.pathname;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0 && parts[0] !== 'a-propos' && !initialArticles.some(a => a.slug === parts[0])) {
    return `/${parts[0]}`;
  }
  return '';
})();

function getRouteState(pathname: string, articles: Article[]) {
  let clean = pathname;
  if (repoBase && clean.startsWith(repoBase)) {
    clean = clean.slice(repoBase.length);
  }
  clean = clean.replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '') {
    return { tab: 'articles' as const, article: null };
  }
  if (clean === '/a-propos') {
    return { tab: 'about' as const, article: null };
  }
  const slug = clean.replace(/^\//, '');
  const found = articles.find((a) => a.slug === slug || encodeURIComponent(a.slug) === slug);
  if (found) {
    return { tab: 'articles' as const, article: found };
  }
  return { tab: 'articles' as const, article: null };
}

export default function App() {
  const allArticles = initialArticles;

  // Mode clair par défaut sauf si 'dark' a été sélectionné précédemment
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('radiotech-theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  // Navigation synchronisée avec l'URL (/ pour Articles, /a-propos pour À propos, /<slug> pour les articles)
  const [activeTab, setActiveTab] = useState<'articles' | 'about'>(() => {
    return getRouteState(window.location.pathname, initialArticles).tab;
  });

  // Terme de recherche par mot-clé, tag ou titre
  const [searchQuery, setSearchQuery] = useState('');

  // Filtre rapide par tag sélectionné
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Article actuellement ouvert en lecture
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(() => {
    return getRouteState(window.location.pathname, initialArticles).article;
  });

  // Image agrandie dans la fenêtre modale (Lightbox)
  const [lightboxImage, setLightboxImage] = useState<{ src: string; caption?: string } | null>(null);

  // Gestion de la fermeture de la Lightbox avec la touche Échap et blocage du défilement d'arrière-plan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
      }
    };
    if (lightboxImage) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [lightboxImage]);

  // Navigation fluide avec pushState
  const navigateTo = useCallback((path: string) => {
    const route = getRouteState(path, allArticles);
    setActiveTab(route.tab);
    setSelectedArticle(route.article);
    const cleanPath = path === '/' ? '/' : path;
    const fullPath = repoBase ? `${repoBase}${cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath}` : cleanPath;
    if (window.location.pathname !== fullPath) {
      window.history.pushState(null, '', fullPath);
    }
  }, [allArticles]);

  // Écoute des boutons Précédent / Suivant du navigateur
  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteState(window.location.pathname, allArticles);
      setActiveTab(route.tab);
      setSelectedArticle(route.article);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [allArticles]);

  // Si l'utilisateur accède à une URL non reconnue, retour propre sur l'accueil
  useEffect(() => {
    const clean = window.location.pathname.replace(/\/+$/, '') || '/';
    if (clean !== '/' && clean !== '/a-propos') {
      const slug = clean.replace(/^\//, '');
      const found = allArticles.find((a) => a.slug === slug || encodeURIComponent(a.slug) === slug);
      if (!found) {
        window.history.replaceState(null, '', '/');
      }
    }
  }, [allArticles]);

  // Synchronisation dynamique du titre du document et des balises d'aperçu de lien (Discord, Facebook, OpenGraph, Twitter)
  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    const setMeta = (nameOrProp: string, value: string, isProp = false) => {
      const attr = isProp ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${nameOrProp}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, nameOrProp);
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
    };

    if (selectedArticle) {
      const title = `${selectedArticle.title} | La RadioTech`;
      const description = selectedArticle.description || 'Pour découvrir, apprendre, comprendre.';
      const rawImage = resolveImageUrl(selectedArticle.image) || '/web/logo-apercu.png';
      const image = rawImage.startsWith('http') ? rawImage : `${origin}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;
      const url = `${origin}/${selectedArticle.slug}`;

      document.title = title;
      setMeta('description', description);
      setMeta('og:title', title, true);
      setMeta('og:description', description, true);
      setMeta('og:image', image, true);
      setMeta('og:url', url, true);
      setMeta('og:type', 'article', true);
      setMeta('twitter:title', title);
      setMeta('twitter:description', description);
      setMeta('twitter:image', image);
      setMeta('twitter:card', 'summary_large_image');
    } else {
      const title = 'La RadioTech';
      const description = 'Pour découvrir, apprendre, comprendre.';
      const image = `${origin}/web/logo-apercu.png`;
      const url = activeTab === 'about' ? `${origin}/a-propos` : `${origin}/`;

      document.title = title;
      setMeta('description', description);
      setMeta('og:title', title, true);
      setMeta('og:description', description, true);
      setMeta('og:image', image, true);
      setMeta('og:url', url, true);
      setMeta('og:type', 'website', true);
      setMeta('twitter:title', title);
      setMeta('twitter:description', description);
      setMeta('twitter:image', image);
      setMeta('twitter:card', 'summary_large_image');
    }
  }, [selectedArticle, activeTab]);

  // État du tiroir Sommaire sur mobile / tablette
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  // Progression de lecture dynamique (0 - 100%)
  const [readingProgress, setReadingProgress] = useState(0);

  // Titre de section actif pour le sommaire (scrollspy interactif)
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');

  // Affichage du bouton retour en haut
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Feedback de copie du lien de l'article
  const [copiedLink, setCopiedLink] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Synchronisation du thème avec le DOM et localStorage
  useEffect(() => {
    try {
      localStorage.setItem('radiotech-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch (e) {
      console.error(e);
    }
  }, [theme]);

  // Défilement automatique vers le haut de page à chaque changement de page ou chargement d'article
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setMobileTocOpen(false);
    setReadingProgress(0);
    setCopiedLink(false);
  }, [activeTab, selectedArticle]);

  // Raccourci clavier pratique : "/" pour focaliser la recherche immédiatement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && !selectedArticle && activeTab === 'articles') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedArticle, activeTab]);

  // Détection du scroll pour la barre de progression, le scrollspy et le bouton retour en haut
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setShowScrollTop(scrollY > 280);

      if (selectedArticle) {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (totalHeight > 0) {
          const progress = Math.min(100, Math.max(0, (scrollY / totalHeight) * 100));
          setReadingProgress(progress);
        }

        // Détection précise et robuste de la section active pour le sommaire
        const headings = extractHeadings(selectedArticle.content);
        if (headings.length > 0) {
          // Si l'utilisateur est vers le bas de page, activer la dernière section
          const isAtBottom = window.innerHeight + scrollY >= document.documentElement.scrollHeight - 70;
          if (isAtBottom) {
            setActiveHeadingId(headings[headings.length - 1].id);
          } else {
            // Seuil d'activation dynamique adapté à l'écran
            const triggerY = Math.min(260, window.innerHeight * 0.35);
            let current = headings[0].id;
            for (const item of headings) {
              const el = document.getElementById(item.id);
              if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.top <= triggerY) {
                  current = item.id;
                }
              }
            }
            setActiveHeadingId(current);
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [selectedArticle]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleCopyLink = () => {
    try {
      const slug = selectedArticle?.slug || '';
      const fullPath = repoBase ? `${repoBase}/${slug}` : `/${slug}`;
      const url = `${window.location.origin}${fullPath}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  // Liste de tous les tags uniques et calcul du nombre d'articles associés
  const { allTags, tagCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    allArticles.forEach((a) => {
      a.tags.forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return {
      allTags: Object.keys(counts).sort(),
      tagCounts: counts,
    };
  }, [allArticles]);

  // Filtrage combiné : tag sélectionné + mot-clé de recherche
  const filteredArticles = useMemo(() => {
    let list = allArticles;

    if (selectedTag) {
      list = list.filter((article) => article.tags.includes(selectedTag));
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((article) => {
      const inTitle = article.title.toLowerCase().includes(q);
      const inDesc = article.description.toLowerCase().includes(q);
      const inTags = article.tags.some((t) => t.toLowerCase().includes(q));
      const inContent = article.content.toLowerCase().includes(q);
      return inTitle || inDesc || inTags || inContent;
    });
  }, [allArticles, selectedTag, searchQuery]);

  // Table des matières automatique de l'article en cours de lecture
  const articleToc = useMemo(() => {
    if (!selectedArticle) return [];
    return extractHeadings(selectedArticle.content);
  }, [selectedArticle]);

  // Détection des articles ayant au moins un tag en commun avec l'article courant
  const relatedArticles = useMemo(() => {
    if (!selectedArticle || !selectedArticle.tags || selectedArticle.tags.length === 0) return [];
    return allArticles.filter(
      (article) =>
        article.slug !== selectedArticle.slug &&
        article.tags.some((tag) => selectedArticle.tags.includes(tag))
    );
  }, [selectedArticle, allArticles]);

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-[#0b0f17] text-slate-100' : 'bg-[#eaedf1] text-slate-900'}`}>
      
      {/* Barre de navigation épurée, moderne et pratique */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur-md transition-colors ${
        isDark ? 'bg-[#0e1422]/90 border-slate-800/80' : 'bg-[#e2e6eb]/90 border-[#cbd3dd]/90'
      }`}>
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Logo & Titre */}
          <div
            onClick={() => navigateTo('/')}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group min-w-0 shrink"
          >
            <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <Radio className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <span className={`font-bold text-base sm:text-lg tracking-tight block truncate ${isDark ? 'text-white' : 'text-slate-950'}`}>
                La RadioTech
              </span>
              <p className={`text-[11px] font-medium leading-none hidden sm:block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Pour découvrir, apprendre, comprendre.
              </p>
            </div>
          </div>

          {/* Navigation & Thème */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <nav className={`flex items-center p-1 rounded-xl border shrink-0 ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-[#d8dfe8] border-[#cbd3dd]'
            }`}>
              <button
                onClick={() => navigateTo('/')}
                className={`whitespace-nowrap px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'articles' && !selectedArticle
                    ? isDark
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-[#f4f6f9] text-slate-950 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Articles
              </button>

              <button
                onClick={() => navigateTo('/a-propos')}
                className={`whitespace-nowrap px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'about' && !selectedArticle
                    ? isDark
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-[#f4f6f9] text-slate-950 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                À propos
              </button>
            </nav>

            {/* Bouton de bascule Mode Clair / Mode Sombre (Icône Lune en clair, Soleil en sombre) */}
            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
              title={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
              className={`flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold shrink-0 transition-all ${
                isDark
                  ? 'bg-slate-900/80 border-slate-800 text-amber-300 hover:bg-slate-800'
                  : 'bg-[#d8dfe8] border-[#cbd3dd] text-slate-800 hover:bg-[#ccd4df] shadow-xs'
              }`}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-sky-600" />}
              <span className="hidden sm:inline">
                {isDark ? 'Mode clair' : 'Mode sombre'}
              </span>
            </button>
          </div>
        </div>

        {/* Barre fine de progression de lecture (uniquement lors de la consultation d'un article) */}
        {selectedArticle && (
          <div className="w-full h-0.5 bg-transparent overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-sky-400 transition-all duration-75 ease-out"
              style={{ width: `${readingProgress}%` }}
            />
          </div>
        )}
      </header>

      {/* Contenu principal */}
      <main className={`mx-auto px-3.5 sm:px-6 lg:px-8 py-6 sm:py-12 ${
        selectedArticle ? 'max-w-[1600px] w-full' : 'max-w-7xl'
      }`}>
        {selectedArticle ? (
          /* Vue détaillée de lecture de l'article avec Sommaire latéral toujours visible */
          <div className="w-full">
            
            {/* Barre d'outils pratique en haut de l'article */}
            <div className="w-full max-w-5xl mx-auto mb-6 flex items-center justify-between flex-wrap gap-3">
              <button
                onClick={() => navigateTo('/')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  isDark
                    ? 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-200'
                    : 'bg-[#e2e6ec] border-[#cbd3dd] hover:bg-[#d8dfe8] text-slate-800 shadow-xs'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Retour aux articles</span>
              </button>

              <button
                onClick={handleCopyLink}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                  copiedLink
                    ? isDark
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                      : 'bg-emerald-100 border-emerald-300 text-emerald-800'
                    : isDark
                    ? 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-300'
                    : 'bg-[#e2e6ec] border-[#cbd3dd] hover:bg-[#d8dfe8] text-slate-700'
                }`}
                title="Copier le lien direct vers cet article"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Lien copié !' : 'Copier le lien'}</span>
              </button>
            </div>

            {/* Disposition réfléchie : article bien centré, tout en ayant un sommaire à droite */}
            <div className="w-full flex justify-center items-start gap-8 lg:gap-10">
              
              {/* Espaceur fantôme gauche pour équilibrer la largeur du sommaire et garder l'article strictement centré sur grand écran */}
              {articleToc.length > 0 && (
                <div className="hidden 2xl:block w-64 shrink-0 pointer-events-none" aria-hidden="true" />
              )}

              {/* Contenu principal de l'article : centré et généreux en largeur */}
              <article className={`w-full max-w-5xl min-w-0 rounded-2xl sm:rounded-3xl border p-4 sm:p-10 lg:p-12 pb-14 sm:pb-24 shadow-sm ${
                isDark ? 'bg-[#111726] border-slate-800/80' : 'bg-[#f3f5f8] border-[#cbd3dd]'
              }`}>
                
                {/* En-tête : Date de publication, Date de mise à jour & Durée de lecture estimée */}
                <div className={`flex flex-wrap items-center gap-3 ${selectedArticle.author ? 'mb-2' : 'mb-4'} text-xs font-medium ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {selectedArticle.date && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-sky-500" />
                      <time>Publié le {formatDate(selectedArticle.date)}</time>
                    </span>
                  )}
                  {selectedArticle.updateDate && (
                    <>
                      {selectedArticle.date && <span>•</span>}
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-sky-500" />
                        <time>Mis à jour le {formatDate(selectedArticle.updateDate)}</time>
                      </span>
                    </>
                  )}
                  {(selectedArticle.date || selectedArticle.updateDate) && <span>•</span>}
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-500" />
                    <span>Durée de lecture : {estimateReadingTime(selectedArticle.content)} minute{estimateReadingTime(selectedArticle.content) > 1 ? 's' : ''} environ</span>
                  </span>
                </div>

                {/* Auteur de l'article : police, taille et style strictement identiques à la durée de lecture */}
                {selectedArticle.author && (
                  <div className={`flex items-center gap-1.5 mb-4 text-xs font-medium ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <User className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span>Rédigé par {selectedArticle.author}</span>
                  </div>
                )}

                {/* Titre de l'article */}
                <h1 className={`text-2xl sm:text-4xl font-extrabold tracking-tight mb-4 leading-tight ${
                  isDark ? 'text-white' : 'text-slate-950'
                }`}>
                  {selectedArticle.title}
                </h1>

                {/* Description */}
                {selectedArticle.description && (
                  <p className={`text-base sm:text-lg font-normal mb-6 leading-relaxed ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {selectedArticle.description}
                  </p>
                )}

                {/* Badges de tags */}
                {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                  <div className={`flex flex-wrap gap-2 mb-8 pb-6 border-b ${
                    isDark ? 'border-slate-800' : 'border-[#cbd3dd]'
                  }`}>
                    {selectedArticle.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border ${
                          isDark
                            ? 'bg-slate-800/60 border-slate-700/60 text-sky-300'
                            : 'bg-[#e2e7ef] border-[#cbd3dd] text-sky-800'
                        }`}
                      >
                        <Tag className="w-3 h-3 text-sky-500" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Image principale (cover/thumbnail) affichée intégralement sans coupure */}
                {selectedArticle.image && (
                  <div className={`relative rounded-2xl overflow-hidden mb-8 border flex items-center justify-center ${
                    isDark ? 'border-slate-800 bg-slate-950' : 'border-[#cbd3dd] bg-slate-900'
                  }`}>
                    <img
                      src={resolveImageUrl(selectedArticle.image) || selectedArticle.image}
                      alt={selectedArticle.title}
                      className="w-full h-auto max-h-[650px] object-contain mx-auto block"
                    />
                  </div>
                )}

                {/* Corps de l'article */}
                <div>
                  <MarkdownRenderer
                    content={selectedArticle.content}
                    isDark={isDark}
                    onImageClick={(src, caption) => setLightboxImage({ src, caption })}
                  />
                </div>

                {/* Section d'articles dans le même style (affichée uniquement si au moins 2 articles partagent au moins un tag en commun) */}
                {relatedArticles.length >= 2 && (
                  <section className={`mt-14 pt-10 border-t ${
                    isDark ? 'border-slate-800' : 'border-[#cbd3dd]'
                  }`}>
                    <h2 className={`text-xl sm:text-2xl font-bold tracking-tight mb-6 ${
                      isDark ? 'text-white' : 'text-slate-950'
                    }`}>
                      Ces articles pourraient également vous plaire...
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {relatedArticles.map((relArticle) => {
                        const relPubDate = formatDate(relArticle.date);
                        const relCoverImage = resolveImageUrl(relArticle.image);

                        return (
                          <div
                            key={relArticle.slug}
                            onClick={() => navigateTo(`/${relArticle.slug}`)}
                            className={`group cursor-pointer rounded-2xl border overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                              isDark
                                ? 'bg-[#0e1422] border-slate-800/80 hover:border-slate-700 hover:shadow-lg'
                                : 'bg-[#e2e7ef] border-[#cbd3dd] hover:border-[#b8c2ce] hover:shadow-md'
                            }`}
                          >
                            <div className="relative aspect-video w-full overflow-hidden bg-slate-950 flex items-center justify-center">
                              {relCoverImage ? (
                                <>
                                  <img
                                    src={relCoverImage}
                                    alt=""
                                    aria-hidden="true"
                                    className="absolute inset-0 w-full h-full object-cover blur-md opacity-30 scale-110 pointer-events-none"
                                  />
                                  <img
                                    src={relCoverImage}
                                    alt={relArticle.title}
                                    className="relative w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                                  />
                                </>
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400">
                                  <Radio className="w-8 h-8 mb-2 text-sky-500 opacity-60" />
                                  <span className="text-xs font-medium text-slate-300">Signal RF</span>
                                </div>
                              )}
                            </div>

                            <div className="p-4 sm:p-5 flex flex-col flex-1">
                              {relPubDate && (
                                <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${
                                  isDark ? 'text-slate-400' : 'text-slate-600'
                                }`}>
                                  <Calendar className="w-3.5 h-3.5 text-sky-500" />
                                  <time>{relPubDate}</time>
                                </div>
                              )}

                              <h3 className={`text-base font-bold tracking-tight mb-2 transition-colors ${
                                isDark
                                  ? 'text-white group-hover:text-sky-400'
                                  : 'text-slate-950 group-hover:text-sky-700'
                              }`}>
                                {relArticle.title}
                              </h3>

                              {relArticle.description && (
                                <p className={`text-xs sm:text-sm line-clamp-2 mb-3 flex-1 leading-relaxed ${
                                  isDark ? 'text-slate-300' : 'text-slate-700'
                                }`}>
                                  {relArticle.description}
                                </p>
                              )}

                              {relArticle.tags && relArticle.tags.length > 0 && (
                                <div className={`pt-2.5 border-t flex flex-wrap gap-1.5 ${
                                  isDark ? 'border-slate-800' : 'border-[#cbd3dd]'
                                }`}>
                                  {relArticle.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                                        selectedArticle.tags.includes(tag)
                                          ? isDark
                                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                            : 'bg-sky-100 text-sky-800 border-sky-300'
                                          : isDark
                                          ? 'bg-slate-800/80 border-slate-700/80 text-slate-400'
                                          : 'bg-[#d0d7e2] border-[#cbd3dd] text-slate-700'
                                      }`}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </article>

              {/* Sommaire latéral à droite (sans affichage du nombre total d'éléments) */}
              {articleToc.length > 0 && (
                <aside className="hidden xl:block w-64 shrink-0 sticky top-24">
                  <div className={`rounded-3xl border p-5 shadow-sm backdrop-blur-md transition-colors ${
                    isDark ? 'bg-[#111726]/95 border-slate-800/80' : 'bg-[#f3f5f8]/95 border-[#cbd3dd]'
                  }`}>
                    <div className={`flex items-center gap-2 pb-3 mb-3 border-b ${
                      isDark ? 'border-slate-800' : 'border-[#cbd3dd]'
                    }`}>
                      <ListOrdered className="w-4 h-4 text-sky-500" />
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        isDark ? 'text-white' : 'text-slate-950'
                      }`}>
                        Sommaire
                      </span>
                    </div>

                    <nav className="space-y-1 max-h-[calc(100vh-10rem)] overflow-y-auto pr-1 text-xs">
                      {articleToc.map((item, idx) => {
                        const isActive = activeHeadingId === item.id;
                        const alreadyNumbered = /^\d+[\.\)]\s/.test(item.text);

                        return (
                          <a
                            key={item.id}
                            href={`#${item.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              setActiveHeadingId(item.id);
                              document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={`block py-1.5 px-2 rounded-lg transition-all leading-relaxed ${
                              item.level === 3 ? 'pl-5 text-[11px]' : 'font-medium'
                            } ${
                              isActive
                                ? isDark
                                  ? 'bg-sky-500/20 text-sky-300 font-bold border-l-2 border-sky-400 pl-2'
                                  : 'bg-sky-600/15 text-sky-900 font-bold border-l-2 border-sky-600 pl-2'
                                : isDark
                                ? 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                                : 'text-slate-700 hover:text-slate-950 hover:bg-[#e2e6ec]'
                            }`}
                          >
                            {!alreadyNumbered && (
                              <span className="text-[10px] font-mono text-sky-500 mr-1.5 font-bold">{idx + 1}.</span>
                            )}
                            <span>{item.text}</span>
                          </a>
                        );
                      })}
                    </nav>
                  </div>
                </aside>
              )}

              {/* Bouton d'accès rapide au Sommaire sur mobile / tablette (< xl) */}
              {articleToc.length > 0 && (
                <div className="xl:hidden fixed bottom-6 right-6 z-40">
                  <button
                    onClick={() => setMobileTocOpen(!mobileTocOpen)}
                    aria-label="Afficher le sommaire"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-500 transition-all border border-sky-400/30"
                  >
                    <ListOrdered className="w-4 h-4" />
                    <span>Sommaire</span>
                  </button>

                  {mobileTocOpen && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
                      <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${
                        isDark ? 'bg-[#111726] border-slate-800' : 'bg-[#f3f5f8] border-[#cbd3dd]'
                      }`}>
                        <div className={`flex items-center justify-between pb-3 mb-4 border-b ${
                          isDark ? 'border-slate-800' : 'border-[#cbd3dd]'
                        }`}>
                          <div className="flex items-center gap-2">
                            <ListOrdered className="w-4 h-4 text-sky-500" />
                            <span className={`text-xs font-bold uppercase tracking-wider ${
                              isDark ? 'text-white' : 'text-slate-950'
                            }`}>
                              Sommaire
                            </span>
                          </div>
                          <button
                            onClick={() => setMobileTocOpen(false)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <nav className="space-y-1 max-h-[60vh] overflow-y-auto pr-1 text-xs">
                          {articleToc.map((item, idx) => {
                            const isActive = activeHeadingId === item.id;
                            const alreadyNumbered = /^\d+[\.\)]\s/.test(item.text);

                            return (
                              <a
                                key={item.id}
                                href={`#${item.id}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setMobileTocOpen(false);
                                  setActiveHeadingId(item.id);
                                  document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className={`block py-2 px-2.5 rounded-xl transition-all leading-relaxed ${
                                  item.level === 3 ? 'pl-5 text-[11px]' : 'font-medium'
                                } ${
                                  isActive
                                    ? isDark
                                      ? 'bg-sky-500/20 text-sky-300 font-bold border-l-2 border-sky-400 pl-2'
                                      : 'bg-sky-600/15 text-sky-900 font-bold border-l-2 border-sky-600 pl-2'
                                    : isDark
                                    ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                                    : 'text-slate-700 hover:text-slate-950 hover:bg-[#e2e6ec]'
                                }`}
                              >
                                {!alreadyNumbered && (
                                  <span className="text-[10px] font-mono text-sky-500 mr-2 font-bold">{idx + 1}.</span>
                                )}
                                <span>{item.text}</span>
                              </a>
                            );
                          })}
                        </nav>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'about' ? (
          /* Section À propos avec le texte exact demandé */
          <div className="w-full max-w-5xl mx-auto">
            <div className={`rounded-3xl border p-8 sm:p-12 lg:p-14 shadow-sm ${
              isDark ? 'bg-[#111726] border-slate-800/80' : 'bg-[#f3f5f8] border-[#cbd3dd]'
            }`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                    isDark ? 'text-white' : 'text-slate-950'
                  }`}>
                    À propos de La RadioTech
                  </h1>
                </div>
              </div>

              <div className={`space-y-5 text-sm sm:text-base leading-relaxed ${
                isDark ? 'text-slate-200' : 'text-slate-800'
              }`}>
                <p className="font-medium text-base sm:text-lg">
                  Bienvenue dans le monde passionnant de la technique radiophonique, des ondes et de la diffusion. Bienvenue sur La RadioTech.
                </p>

                <p>
                  Créé en 2026 par Lucas Gallone, passionné de radio et technicien bénévole pour plusieurs radios associatives, ce mini-site propose aux lecteurs une sélection d’articles et de documentations techniques en rapport avec divers sujets traitant de la technique radiophonique, afin d’y voir plus clair et d’apporter une compréhension concrète des sujets traités.
                </p>

                <p>
                  Que ce soit en FM ou en DAB+, la diffusion d’une station de radio requiert un acheminement parfois complexe que l’auditeur n’imagine souvent pas !
                </p>

                <p>
                  Prenez le temps d’explorer les différents articles, découvrez et apprenez.
                </p>

                <p>
                  Tous les articles disponibles sur ce site sont entièrement rédigés par un humain (à savoir moi-même !), et s’appuient sur des connaissances personnelles, des regroupements de diverses documentations en anglais, ainsi que sur des observations et expériences de terrain.
                </p>

                <div className={`p-5 rounded-2xl border ${
                  isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-[#e7ebf1] border-[#cbd3dd]'
                }`}>
                  <p className="text-sm">
                    Un article vous plaît et vous souhaitez le partager ?<br />
                    Le contenu disponible sur ce site est sous licence Creative Commons BY-NC 4.0 : il est libre de reproduction à des fins non commerciales, à condition de mentionner l’auteur et d’intégrer un lien vers la source.<br /><br />
                    Les termes de cette licence sont consultables en <a href="https://creativecommons.org/licenses/by-nc/4.0/deed.fr" target="_blank" rel="noopener noreferrer" className="text-sky-600 dark:text-sky-400 underline hover:opacity-80 font-medium">cliquant ici</a>.
                  </p>
                </div>

                <p className="font-semibold pt-2 text-sky-600 dark:text-sky-400">
                  Bonne lecture !
                </p>
              </div>

              <div className={`mt-8 pt-6 border-t flex justify-end ${
                isDark ? 'border-slate-800/80' : 'border-[#cbd3dd]'
              }`}>
                <button
                  onClick={() => navigateTo('/')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                      : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xs'
                  }`}
                >
                  <span>Explorer les articles</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Page d'accueil dynamique listant chronologiquement les articles Markdown */
          <>
            {/* Barre de recherche étendue et moderne */}
            <div className="space-y-4 mb-8">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4.5 h-4.5 text-sky-500" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un article par titre ou mot-clé..."
                  className={`w-full pl-11 pr-12 py-3.5 rounded-2xl text-sm font-medium transition-all outline-none border shadow-xs ${
                    isDark
                      ? 'bg-[#111726] border-slate-800 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
                      : 'bg-[#f3f5f8] border-[#cbd3dd] text-slate-900 placeholder-slate-500 focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20'
                  }`}
                />
                
                {searchQuery && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                      aria-label="Effacer la recherche"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Filtre rapide par tags en un clic avec compteur dynamique */}
              {allTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className={`text-xs font-medium mr-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Filtrage par mot-clé :
                  </span>

                  <button
                    onClick={() => setSelectedTag(null)}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                      selectedTag === null
                        ? isDark
                          ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                          : 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : isDark
                        ? 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                        : 'bg-[#e2e6ec] border-[#cbd3dd] text-slate-700 hover:bg-[#d8dfe8]'
                    }`}
                  >
                    <span>Tous</span>
                    <span className="opacity-70 text-[10px]">({allArticles.length})</span>
                  </button>

                  {allTags.map((tag) => {
                    const isSelected = selectedTag === tag;
                    return (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(isSelected ? null : tag)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                          isSelected
                            ? isDark
                              ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                              : 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : isDark
                            ? 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                            : 'bg-[#e2e6ec] border-[#cbd3dd] text-slate-700 hover:bg-[#d8dfe8]'
                        }`}
                      >
                        <Tag className="w-3 h-3 text-sky-500" />
                        <span>{tag}</span>
                        <span className="opacity-70 text-[10px]">({tagCounts[tag] || 0})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* En-tête de la liste */}
            <div className={`flex items-center justify-between pb-4 mb-6 border-b ${
              isDark ? 'border-slate-800' : 'border-[#cbd3dd]'
            }`}>
              <div>
                <h2 className={`text-lg sm:text-xl font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-950'
                }`}>
                  Derniers articles
                </h2>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {selectedTag ? (
                    <span>Affichage des articles contenant le mot-clé « <strong>{selectedTag}</strong> »</span>
                  ) : searchQuery ? (
                    <span>Résultats pour « {searchQuery} »</span>
                  ) : (
                    <span>Classés par ordre chronologique décroissant</span>
                  )}
                </p>
              </div>
              <div className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-300'
                  : 'bg-[#e2e6ec] border-[#cbd3dd] text-slate-700'
              }`}>
                {filteredArticles.length} article{filteredArticles.length > 1 ? 's' : ''}
              </div>
            </div>

            {/* Grille dynamique des articles */}
            {filteredArticles.length === 0 ? (
              <div className={`text-center py-16 px-6 rounded-3xl border ${
                isDark ? 'border-slate-800/80 bg-[#111726]/50' : 'border-[#cbd3dd] bg-[#f3f5f8]'
              }`}>
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-950'}`}>
                  {searchQuery || selectedTag ? 'Aucun article ne correspond à votre filtre' : 'Aucun article publié pour le moment'}
                </h3>
                <p className={`max-w-md mx-auto text-xs leading-relaxed ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {searchQuery || selectedTag ? (
                    <span>Essayez un autre mot-clé ou réinitialisez le filtre.</span>
                  ) : (
                    <span>Ajoutez vos fichiers <code>.md</code> dans le dossier <code>src/content/articles/</code> pour les voir apparaître automatiquement ici.</span>
                  )}
                </p>
                {(searchQuery || selectedTag) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedTag(null);
                    }}
                    className="mt-4 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 transition-colors"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredArticles.map((article) => {
                  const pubDate = formatDate(article.date);
                  const coverImage = resolveImageUrl(article.image);

                  return (
                    <div
                      key={article.slug}
                      onClick={() => navigateTo(`/${article.slug}`)}
                      className={`group cursor-pointer rounded-2xl border overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                        isDark
                          ? 'bg-[#111726] border-slate-800/80 hover:border-slate-700 hover:shadow-lg'
                          : 'bg-[#f3f5f8] border-[#cbd3dd] hover:border-[#b8c2ce] hover:shadow-md'
                      }`}
                    >
                      {/* Image principale (thumbnail/cover issue du Frontmatter) affichée intégralement sans coupure */}
                      <div className="relative aspect-video w-full overflow-hidden bg-slate-950 flex items-center justify-center">
                        {coverImage ? (
                          <>
                            {/* Fond d'ambiance flouté pour harmoniser les marges sans bandes vides */}
                            <img
                              src={coverImage}
                              alt=""
                              aria-hidden="true"
                              className="absolute inset-0 w-full h-full object-cover blur-md opacity-30 scale-110 pointer-events-none"
                            />
                            {/* Image nette affichée à 100% de sa totalité sans aucun rognage */}
                            <img
                              src={coverImage}
                              alt={article.title}
                              className="relative w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400">
                            <Radio className="w-8 h-8 mb-2 text-sky-500 opacity-60" />
                            <span className="text-xs font-medium text-slate-300">Signal RF</span>
                          </div>
                        )}
                      </div>

                      {/* Corps de la carte */}
                      <div className="p-5 flex flex-col flex-1">
                        
                        {/* Date de publication */}
                        {pubDate && (
                          <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${
                            isDark ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            <Calendar className="w-3.5 h-3.5 text-sky-500" />
                            <time>{pubDate}</time>
                          </div>
                        )}

                        {/* Titre de l'article */}
                        <h3 className={`text-base font-bold tracking-tight mb-2 transition-colors ${
                          isDark
                            ? 'text-white group-hover:text-sky-400'
                            : 'text-slate-950 group-hover:text-sky-700'
                        }`}>
                          {article.title}
                        </h3>

                        {/* Description */}
                        {article.description && (
                          <p className={`text-xs sm:text-sm line-clamp-2 mb-4 flex-1 leading-relaxed ${
                            isDark ? 'text-slate-300' : 'text-slate-700'
                          }`}>
                            {article.description}
                          </p>
                        )}

                        {/* Tags (étiquettes avec filtre rapide en un clic) */}
                        <div className={`pt-3 border-t flex flex-wrap gap-1.5 ${
                          isDark ? 'border-slate-800' : 'border-[#cbd3dd]'
                        }`}>
                          {article.tags && article.tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTag(selectedTag === tag ? null : tag);
                              }}
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors ${
                                selectedTag === tag
                                  ? isDark
                                    ? 'bg-sky-500 text-white border-sky-500'
                                    : 'bg-sky-600 text-white border-sky-600'
                                  : isDark
                                  ? 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-600'
                                  : 'bg-[#e2e6ec] border-[#cbd3dd] text-slate-700 hover:bg-[#d8dfe8]'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Bouton pratique flottant "Remonter en haut de page" avec animation fluide d'apparition et de disparition */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Remonter en haut de page"
        title="Remonter en haut de page"
        aria-hidden={!showScrollTop}
        tabIndex={showScrollTop ? 0 : -1}
        className={`fixed ${
          selectedArticle && articleToc.length > 0
            ? 'bottom-20 right-5 sm:bottom-20 sm:right-6 xl:bottom-6 xl:right-8'
            : 'bottom-6 right-5 sm:right-6 xl:right-8'
        } z-30 p-2.5 rounded-xl shadow-lg border transition-all duration-300 ease-in-out transform ${
          showScrollTop
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-4 scale-75 pointer-events-none'
        } hover:scale-110 active:scale-95 ${
          isDark
            ? 'bg-slate-900/90 text-sky-400 border-slate-700/80 hover:bg-slate-800'
            : 'bg-[#d8dfe8] text-slate-900 border-[#cbd3dd] hover:bg-[#ccd4df]'
        }`}
      >
        <ArrowUp className="w-4 h-4" />
      </button>

      {/* Pied de page sobre */}
      <footer className={`border-t py-8 px-4 sm:px-6 lg:px-8 text-center text-xs space-y-2 transition-colors ${
        isDark ? 'border-slate-800/80 text-slate-500' : 'border-[#cbd3dd] text-slate-600'
      }`}>
        <p>© {new Date().getFullYear()} <strong>La RadioTech</strong> — Documentation pour la compréhension de la technique radiophonique</p>
        <p>
          Les articles disponibles sur ce site sont reproductibles à des fins non commerciales, sous réserve d'en mentionner l'auteur et la source. Pour en savoir plus,{' '}
          <button
            onClick={() => {
              navigateTo('/a-propos');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="underline hover:text-sky-500 transition-colors font-medium cursor-pointer"
          >
            cliquez ici
          </button>
          .
        </p>
      </footer>

      {/* Fenêtre modale d'agrandissement de l'image (Lightbox) */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image agrandie"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/85 backdrop-blur-md transition-opacity duration-200"
          onClick={() => setLightboxImage(null)}
        >
          {/* Bouton de fermeture en haut à droite */}
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white/90 hover:text-white border border-slate-700/80 shadow-2xl transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            aria-label="Fermer la fenêtre d'agrandissement"
            title="Fermer (Échap)"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Conteneur de l'image agrandie */}
          <div
            className="relative flex flex-col items-center max-w-[95vw] max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* L'image agrandie */}
            <div className="relative overflow-hidden rounded-2xl shadow-2xl bg-slate-950 border border-slate-800/80 max-w-full flex items-center justify-center">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.caption || 'Image agrandie'}
                className="w-auto h-auto max-w-[90vw] max-h-[72vh] sm:max-h-[78vh] object-contain block mx-auto select-none"
              />
            </div>

            {/* Légende affichée en bas de la photo sur la fenêtre d'agrandissement si disponible (non-italique) */}
            {lightboxImage.caption && (
              <div className="mt-3.5 max-w-2xl px-5 py-2.5 rounded-xl bg-slate-900/95 border border-slate-700/80 text-slate-100 text-center text-xs sm:text-sm font-medium not-italic shadow-2xl backdrop-blur-md leading-relaxed select-text">
                {lightboxImage.caption}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
