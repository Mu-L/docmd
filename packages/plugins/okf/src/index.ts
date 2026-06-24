/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

import path from 'path';
import fs from 'fs/promises';
import type { PluginDescriptor } from '@docmd/api';
import { outputPathToPathname, sanitizeUrl } from '@docmd/api';

export const plugin: PluginDescriptor = {
  name: 'okf',
  version: '0.8.7',
  capabilities: ['post-build']
};

// ---- helpers --------------------------------------------------------------

const PATH_TYPE_MAP: Array<[RegExp, string]> = [
  [/^\/guides\//, 'guide'],
  [/^\/api\//, 'api'],
  [/^\/reference\//, 'reference'],
  [/^\/concepts\//, 'concept'],
  [/^\/runbooks\//, 'runbook'],
  [/^\/datasets\//, 'dataset'],
  [/^\/metrics\//, 'metric'],
  [/^\/tables\//, 'table']
];

function slugify(input: string): string {
  return String(input || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'bundle';
}

function resolveType(fm: any, pathname: string, defaultType: string, typeField = 'type') {
  // Precedence: okf.type (nested) → top-level type → custom typeField → okfType → path inference
  const fmType = (fm?.okf?.type)
    || (typeField && typeField !== 'type' ? fm?.[typeField] : null)
    || (typeField === 'type' ? fm?.type : null)
    || fm?.okfType
    || null;
  if (fmType) return { type: String(fmType), fallback: false };
  for (const [re, t] of PATH_TYPE_MAP) if (re.test(pathname)) return { type: t, fallback: false };
  return { type: defaultType, fallback: true };
}

function matchesPattern(text: string, patterns: string[]): boolean {
  if (!patterns || !patterns.length) return false;
  for (const p of patterns) {
    if (!p) continue;
    try {
      const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      if (re.test(text)) return true;
    } catch { if (text.includes(p)) return true; }
  }
  return false;
}

function extractInternalLinks(md: string, ownSlug: string, known: Set<string>): string[] {
  const out: string[] = [];
  if (!md) return out;
  const re = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    let href = m[1].trim();
    if (!href || href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
    href = href.split('#')[0];
    if (!href) continue;
    const slug = slugify(href.replace(/\.md$/i, ''));
    if (!slug || slug === ownSlug) continue;
    if (known.has(slug)) out.push(slug);
  }
  return out;
}

function yamlQuote(s: any): string {
  const v = s === null || s === undefined ? '' : String(s);
  if (/^[a-zA-Z0-9_\-\.\/]+$/.test(v) && v !== '') return v;
  return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function toYaml(obj: any, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return pad + 'null';
  if (typeof obj === 'boolean' || typeof obj === 'number') return pad + String(obj);
  if (typeof obj === 'string') return pad + yamlQuote(obj);
  if (Array.isArray(obj)) {
    if (!obj.length) return pad + '[]';
    return obj.map(item => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const inner = toYaml(item, indent + 1).trimStart();
        return pad + '- ' + inner;
      }
      return pad + '- ' + (typeof item === 'string' ? yamlQuote(item) : String(item));
    }).join('\n');
  }
  if (typeof obj === 'object') {
    const lines: string[] = [];
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      const isComplex = v && typeof v === 'object';
      if (isComplex && (Array.isArray(v) ? v.length : Object.keys(v).length)) {
        lines.push(`${pad}${k}:`);
        lines.push(toYaml(v, indent + 1));
      } else {
        lines.push(`${pad}${k}: ${v === null || v === undefined ? 'null' : (typeof v === 'string' ? yamlQuote(v) : String(v))}`);
      }
    }
    return lines.join('\n');
  }
  return pad + String(obj);
}

// ---- graph viewer assets (inline strings) ---------------------------------

const GRAPH_CSS = `:root{--okf-fg:#1f2937;--okf-bg:#fafafa;--okf-panel-bg:#fff;--okf-border:#e5e7eb;--okf-link:#cbd5e1;--okf-node-stroke:#fff;--okf-chip:#eef2ff;--okf-chip-fg:#3730a3;--okf-muted:#6b7280}
.okf-graph{position:relative;width:100%;height:100vh;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--okf-fg);background:var(--okf-bg)}
.okf-graph svg{display:block;width:100%;height:100%}
.okf-graph .node{cursor:pointer;stroke:var(--okf-node-stroke);stroke-width:1.5}
.okf-graph .node:hover{stroke-width:3}
.okf-graph .label{font-size:11px;fill:var(--okf-fg);pointer-events:none;text-anchor:middle}
.okf-graph .link{stroke:var(--okf-link);stroke-opacity:.6}
.okf-panel{position:absolute;top:0;right:0;bottom:0;width:340px;background:var(--okf-panel-bg);border-left:1px solid var(--okf-border);padding:20px;overflow:auto;box-shadow:-4px 0 12px rgba(0,0,0,.05);font-size:13px}
.okf-panel h2{margin:0 0 8px;font-size:18px;line-height:1.3}
.okf-panel .okf-type{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;background:var(--okf-chip);color:var(--okf-chip-fg);margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px}
.okf-panel a{color:#2563eb;text-decoration:none;display:inline-block;margin-right:10px;margin-top:8px}
.okf-panel .okf-empty{color:var(--okf-muted);font-style:italic}
.okf-topbar{position:absolute;top:0;left:0;right:340px;padding:12px 16px;background:linear-gradient(180deg,var(--okf-panel-bg) 0%,transparent 100%);z-index:2}
.okf-topbar h1{margin:0;font-size:14px;font-weight:600}
.okf-topbar .okf-sub{font-size:11px;color:var(--okf-muted);margin-top:2px}
@media (prefers-color-scheme:dark){:root{--okf-fg:#e5e7eb;--okf-bg:#0f172a;--okf-panel-bg:#1e293b;--okf-border:#334155;--okf-link:#475569;--okf-node-stroke:#0f172a;--okf-chip:#312e81;--okf-chip-fg:#c7d2fe;--okf-muted:#94a3b8}}`;

const GRAPH_JS = `(function(){
var data=window.OKF_GRAPH||{nodes:[],links:[]};
var cmap={concept:'#6366f1',guide:'#10b981',api:'#f59e0b',reference:'#0ea5e9',runbook:'#ef4444',dataset:'#a855f7',metric:'#ec4899',table:'#14b8a6'};
var root=document.getElementById('okf-graph'),panel=document.getElementById('okf-panel');
var NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');
svg.setAttribute('viewBox','0 0 800 600');root.appendChild(svg);
var W=800,H=600,nodes=data.nodes.map(function(n){return n;}),links=data.links;
var idx={};nodes.forEach(function(n){idx[n.id]=n;});
links.forEach(function(l){if(typeof l.source==='string')l.source=idx[l.source];if(typeof l.target==='string')l.target=idx[l.target];});
nodes.forEach(function(n){n.x=Math.random()*W;n.y=Math.random()*H;n.vx=0;n.vy=0;});
for(var s=0;s<200;s++){for(var i=0;i<nodes.length;i++){var a=nodes[i];for(var j=0;j<nodes.length;j++){if(i===j)continue;var b=nodes[j],dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy||1;a.vx+=dx/Math.sqrt(d2)*1800/d2*0.01;a.vy+=dy/Math.sqrt(d2)*1800/d2*0.01;}}for(var k=0;k<links.length;k++){var l=links[k],so=l.source,ta=l.target;if(typeof so!=='object'||typeof ta!=='object')continue;var dx2=ta.x-so.x,dy2=ta.y-so.y,d=Math.sqrt(dx2*dx2+dy2*dy2)||1,f=(d-120)*0.05*0.05;so.vx+=dx2/d*f;so.vy+=dy2/d*f;ta.vx-=dx2/d*f;ta.vy-=dy2/d*f;}for(var m=0;m<nodes.length;m++){var nn=nodes[m];nn.vx*=0.82;nn.vy*=0.82;nn.vx+=(W/2-nn.x)*0.001;nn.vy+=(H/2-nn.y)*0.001;nn.x+=nn.vx;nn.y+=nn.vy;if(nn.x<20)nn.x=20;if(nn.x>W-20)nn.x=W-20;if(nn.y<20)nn.y=20;if(nn.y>H-20)nn.y=H-20;}}
var gL=document.createElementNS(NS,'g');links.forEach(function(l){if(typeof l.source!=='object'||typeof l.target!=='object')return;var ln=document.createElementNS(NS,'line');ln.setAttribute('class','link');ln.setAttribute('x1',l.source.x);ln.setAttribute('y1',l.source.y);ln.setAttribute('x2',l.target.x);ln.setAttribute('y2',l.target.y);gL.appendChild(ln);});svg.appendChild(gL);
var gN=document.createElementNS(NS,'g');nodes.forEach(function(n){var c=document.createElementNS(NS,'circle');c.setAttribute('class','node');c.setAttribute('cx',n.x);c.setAttribute('cy',n.y);c.setAttribute('r',8);c.setAttribute('fill',cmap[n.type]||'#6b7280');c.addEventListener('click',function(){showDetail(panel,n);});gN.appendChild(c);var t=document.createElementNS(NS,'text');t.setAttribute('class','label');t.setAttribute('x',n.x);t.setAttribute('y',n.y-12);t.textContent=n.title||n.id;gN.appendChild(t);});svg.appendChild(gN);

// Render a node's details into the side panel without using innerHTML.
// All user-supplied strings (title, type, description, source) flow into
// DOM nodes via textContent, so a malicious OKF bundle cannot inject HTML
// or scripts. The two hrefs use a scheme allow-list and encodeURIComponent
// to neutralise javascript:, data:, and path-traversal payloads.
function showDetail(panel,n){
  while(panel.firstChild) panel.removeChild(panel.firstChild);
  var h=document.createElement('h2');h.textContent=n.title||n.id;panel.appendChild(h);
  var sp=document.createElement('span');sp.className='okf-type';sp.textContent=n.type||'concept';panel.appendChild(sp);
  var p=document.createElement('p');
  if(n.description){p.textContent=n.description;}
  else{var em=document.createElement('span');em.className='okf-empty';em.textContent='No description.';p.appendChild(em);}
  panel.appendChild(p);
  var a1=document.createElement('a');
  a1.href='concepts/'+encodeURIComponent(n.id)+'.md';
  a1.target='_blank';a1.rel='noopener noreferrer';
  a1.textContent='Open in OKF bundle';
  panel.appendChild(a1);
  panel.appendChild(document.createTextNode(' '));
  var a2=document.createElement('a');
  a2.href=safeHref(n.source);
  a2.target='_blank';a2.rel='noopener noreferrer';
  a2.textContent='Open source page';
  panel.appendChild(a2);
}

// Allow only the URL schemes that appear in the OKF spec examples
// (http/https, repo://, dashboard://, docs://, wp-admin:, mailto:, tel:)
// plus site-relative paths. Anything else collapses to "#" so javascript:
// and data: URLs cannot execute.
function safeHref(u){
  if(!u) return '#';
  if(/^(?:https?|mailto|tel|repo|dashboard|docs|wp-admin):/i.test(u)) return u;
  if(u.charAt(0)==='/') return u;
  return '#';
}
})();`;

function graphHtml(name: string, count: number): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} — OKF Graph</title><link rel="stylesheet" href="graph.css"></head><body><div class="okf-graph" id="okf-graph"><div class="okf-topbar"><h1>${name}</h1><div class="okf-sub">${count} concepts · Open Knowledge Format graph view</div></div><div class="okf-panel" id="okf-panel"><p class="okf-empty">Click a node to see details.</p></div></div><script src="graph.js"></script></body></html>`;
}

// ---- onPostBuild ----------------------------------------------------------

export async function onPostBuild({ config, pages, outputDir, log }: any) {
  const _opts = config.plugins?.okf;

  // Opt-out paths. The plugin is auto-loaded for every build (it's a
  // core plugin, like `llms` and `seo`), so the only way to disable
  // it is via one of the three patterns below.
  if (_opts === false) return;                          // `"okf": false`
  if (_opts && _opts.enabled === false) return;         // `"okf": { "enabled": false }`
  if (Array.isArray(_opts?.capabilities)
      && !_opts.capabilities.includes('post-build')) return; // capability filter

  const opts = _opts && typeof _opts === 'object' ? _opts : {};

  const outputRel = opts.outputDir || 'okf';
  const bundleName = opts.bundleName ? slugify(opts.bundleName) : slugify(config.title || 'knowledge-bundle');
  const defaultType = opts.defaultType || 'concept';
  const typeField = opts.typeField || 'type';
  const warnOnMissingType = opts.warnOnMissingType !== false;
  const includeFullMarkdown = opts.includeFullMarkdown !== false;
  const generateGraphViewer = opts.generateGraphViewer !== false;

  const localeStrategy = opts.localeStrategy || 'default-only';
  const versionStrategy = opts.versionStrategy || 'latest-only';
  const excludePatterns: string[] = Array.isArray(opts.excludePatterns) ? opts.excludePatterns : [];

  const siteUrl = (config.url || '').replace(/\/$/, '');
  const warnings: string[] = [];

  if (!config.url) {
    const msg = `OKF: config.url is missing — generated \`source:\` fields will be relative paths only`;
    warnings.push(`[WARN] missing-site-url  (source: fields will be relative)`);
    if (log) log(msg, 'SKIP');
  }

  if (log) log(`Generating OKF bundle: ${bundleName}`);

  const localeIds: string[] = (config.i18n?.locales || []).map((l: any) => l.id);
  const versionIds: string[] = (config.versions?.all || []).map((v: any) => v.id);
  const defaultLocale = config.i18n?.default || localeIds[0] || '';
  const currentVersion = config.versions?.current || versionIds[0] || '';

  const bundleRoot = path.join(outputDir, outputRel);
  await fs.mkdir(path.join(bundleRoot, 'concepts'), { recursive: true });
  await fs.mkdir(path.join(bundleRoot, '_meta'), { recursive: true });

  const filtered = pages.filter((p: any) => {
    const fm = p.frontmatter || {};
    if (fm.noindex || fm.okf === false) return false;
    const pathname = outputPathToPathname(p.outputPath);
    if (matchesPattern(pathname, excludePatterns)) return false;
    if (matchesPattern(p.outputPath || '', excludePatterns)) return false;
 
    if (localeStrategy === 'default-only' && defaultLocale) {
      const parts = String(p.outputPath || '').split('/').filter(Boolean);
      const pageLoc = (localeIds.length && parts.length && localeIds.includes(parts[0])) ? parts[0] : defaultLocale;
      if (pageLoc !== defaultLocale) return false;
    }
    return true;
  });

  const slugMap = new Map<string, any>();
  for (const p of filtered) {
    const pathname = outputPathToPathname(p.outputPath);
    slugMap.set(slugify(pathname.replace(/^\//, '').replace(/\/$/, '') || 'root'), p);
  }
  const known = new Set(slugMap.keys());

  const pageLocale = (p: any) => {
    const parts = String(p.outputPath || '').split('/').filter(Boolean);
    return (localeIds.length && parts.length && localeIds.includes(parts[0])) ? parts[0] : defaultLocale;
  };
  const pageVersion = (p: any) => {
    const fm = p.frontmatter || {};
    if (fm.version) return String(fm.version);
    const parts = String(p.outputPath || '').split('/').filter(Boolean);
    return (versionIds.length && parts.length && versionIds.includes(parts[0])) ? parts[0] : currentVersion;
  };

  const concepts: any[] = [];
  const nodeList: any[] = [];
  const linkList: Array<{ source: string; target: string }> = [];
  const linkSet = new Set<string>();
  const inbound = new Map<string, number>();

  for (const p of filtered) {
    const fm = p.frontmatter || {};
    const pathname = outputPathToPathname(p.outputPath);
    const { type, fallback } = resolveType(fm, pathname, defaultType, typeField);

    if (fallback && warnOnMissingType) {
      warnings.push(`[WARN] missing-type ${pathname}  (using fallback '${defaultType}')`);
      if (log) log(`OKF: missing type for ${pathname} → fallback '${defaultType}'`, 'SKIP');
    }

    const locale = pageLocale(p);
    const version = pageVersion(p);
    const subParts: string[] = [];
    // 0.8.8: nest non-default locales under `<locale>/` so the default
    // locale's files stay at the bundle root (no breaking change for
    // existing consumers). Only the `folders` strategy is affected;
    // `default-only` (the new default) writes everything at the root.
    if (localeStrategy === 'folders' && locale && locale !== defaultLocale && localeIds.length > 1) subParts.push(locale);
    if (versionStrategy === 'folders' && version && versionIds.length > 1) subParts.push(version);
    const subRel = subParts.join('/');

    const slug = slugify(pathname.replace(/^\//, '').replace(/\/$/, '') || 'root');
    const fileRel = subRel ? path.posix.join(subRel, 'concepts', slug + '.md') : path.posix.join('concepts', slug + '.md');
    const fileAbs = path.join(bundleRoot, fileRel);
    await fs.mkdir(path.dirname(fileAbs), { recursive: true });

    const fullUrl = sanitizeUrl(siteUrl + pathname);
    const updated = fm.lastmod || new Date().toISOString().slice(0, 10);

    const conceptFm: Record<string, any> = { [typeField]: type };
    if (fm.title) conceptFm.title = fm.title;
    if (fm.description) conceptFm.description = fm.description;
    conceptFm.source = fullUrl;
    conceptFm.path = pathname;
    if (locale) conceptFm.locale = locale;
    if (version) conceptFm.version = version;
    if (Array.isArray(fm.tags) && fm.tags.length) conceptFm.tags = fm.tags;
    conceptFm.updated = updated;
    conceptFm.okf = { generated_by: '@docmd/plugin-okf', generated_at: new Date().toISOString() };

    let body = '';
    if (includeFullMarkdown) {
      if (p.sourcePath) { try { body = await fs.readFile(p.sourcePath, 'utf8'); } catch { body = ''; } }
    }
    if (!body && typeof p.rawMarkdown === 'string') body = p.rawMarkdown;

    const fmLines = ['---'];
    for (const k of Object.keys(conceptFm)) {
      const v = conceptFm[k];
      if (Array.isArray(v)) {
        if (!v.length) { fmLines.push(`${k}: []`); continue; }
        fmLines.push(`${k}:`);
        for (const it of v) fmLines.push(`  - ${typeof it === 'string' ? yamlQuote(it) : String(it)}`);
      } else if (v && typeof v === 'object') {
        fmLines.push(`${k}:`);
        for (const kk of Object.keys(v)) fmLines.push(`  ${kk}: ${typeof v[kk] === 'string' ? yamlQuote(v[kk]) : String(v[kk])}`);
      } else if (v === null || v === undefined) {
        fmLines.push(`${k}:`);
      } else {
        fmLines.push(`${k}: ${typeof v === 'string' ? yamlQuote(v) : String(v)}`);
      }
    }
    fmLines.push('---', '');
    await fs.writeFile(fileAbs, fmLines.join('\n') + body + (body && !body.endsWith('\n') ? '\n' : ''));

    concepts.push({
      id: slug, type, title: fm.title || 'Untitled', path: pathname, file: fileRel,
      locale, version, tags: Array.isArray(fm.tags) ? fm.tags : [], source: fullUrl
    });
    nodeList.push({ id: slug, title: fm.title || 'Untitled', type, path: pathname, source: fullUrl, description: fm.description || '' });

    if (body) {
      for (const t of extractInternalLinks(body, slug, known)) {
        const key = slug + '->' + t;
        if (linkSet.has(key)) continue;
        linkSet.add(key);
        linkList.push({ source: slug, target: t });
        inbound.set(t, (inbound.get(t) || 0) + 1);
      }
    }
  }

  const allSlugs = new Set(concepts.map(c => c.id));
  for (const c of concepts) if (!inbound.has(c.id)) warnings.push(`[WARN] orphan-concept ${c.id}  (no inbound links)`);
  for (const l of linkList) if (!allSlugs.has(l.target)) warnings.push(`[WARN] broken-link ${l.source} -> ${l.target}`);

  const byType: Record<string, number> = {};
  for (const c of concepts) byType[c.type] = (byType[c.type] || 0) + 1;

  const manifest = {
    okf_version: '0.1',
    bundle: {
      name: bundleName, title: config.title || bundleName, description: config.description || '',
      url: config.url || '', generated_by: '@docmd/plugin-okf', generated_at: new Date().toISOString(),
      default_type: defaultType
    },
    stats: { concepts: concepts.length, by_type: byType, locales: localeIds, versions: versionIds },
    concepts: concepts.map(c => ({ id: c.id, type: c.type, title: c.title, path: c.path, file: c.file, locale: c.locale, version: c.version, tags: c.tags }))
  };

  await fs.writeFile(path.join(bundleRoot, 'okf.yaml'), toYaml(manifest));
  await fs.writeFile(path.join(bundleRoot, '_meta', 'bundle.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(bundleRoot, '_meta', 'lint-report.txt'), warnings.length === 0 ? 'OK — 0 issues\n' : warnings.join('\n') + '\n');

  // index.md (Karpathy-style catalog)
  const idxLines: string[] = [`# ${manifest.bundle.title} — Knowledge Catalog`, '', `> Generated by ${manifest.bundle.generated_by} on ${manifest.bundle.generated_at}`, ''];
  if (manifest.bundle.description) idxLines.push(manifest.bundle.description, '');
  idxLines.push(`**${manifest.stats.concepts} concepts** across **${Object.keys(manifest.stats.by_type).length} types**.`, '',
    '- [Manifest](okf.yaml)', '- [Bundle summary (JSON)](_meta/bundle.json)', '- [Graph viewer](graph.html)', '- [Lint report](_meta/lint-report.txt)', '');
  const groups = new Map<string, any[]>();
  for (const c of concepts) { if (!groups.has(c.type)) groups.set(c.type, []); groups.get(c.type)!.push(c); }
  for (const type of Array.from(groups.keys()).sort()) {
    const items = groups.get(type)!.sort((a, b) => a.title.localeCompare(b.title));
    idxLines.push(`## ${type}`, '');
    for (const c of items) {
      const tag = c.tags && c.tags.length ? ` _(${c.tags.join(', ')})_` : '';
      idxLines.push(`- [${c.title}](${c.file})${tag}`);
    }
    idxLines.push('');
  }
  const untyped = concepts.filter(c => c.type === defaultType);
  if (untyped.length && Object.keys(byType).length > 1) {
    idxLines.push(`## Untyped (using fallback \`${defaultType}\`)`, '',
      'These pages did not declare an explicit OKF type. Consider adding `type:` to their frontmatter:', '');
    for (const c of untyped) idxLines.push(`- [${c.title}](${c.file})`);
    idxLines.push('');
  }
  await fs.writeFile(path.join(bundleRoot, 'index.md'), idxLines.join('\n'));

  if (generateGraphViewer) {
    await fs.writeFile(path.join(bundleRoot, 'graph.json'), JSON.stringify({ nodes: nodeList, links: linkList }, null, 2));
    await fs.writeFile(path.join(bundleRoot, 'graph.css'), GRAPH_CSS);
    await fs.writeFile(path.join(bundleRoot, 'graph.js'), GRAPH_JS);
    await fs.writeFile(path.join(bundleRoot, 'graph.html'), graphHtml(bundleName, concepts.length));
  }

  if (log) log(`OKF bundle written to /${outputRel}/ (${concepts.length} concepts, ${warnings.length} warnings)`);
}
