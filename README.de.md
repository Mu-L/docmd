<div align="right">
  <sup>
    <a href="./README.md">EN</a> &nbsp;|&nbsp; <a href="./README.es.md">ES</a> &nbsp;|&nbsp; <b>DE</b> &nbsp;|&nbsp; <a href="./README.ja.md">日本語</a> &nbsp;|&nbsp; <a href="./README.fr.md">FR</a> &nbsp;|&nbsp; <a href="./README.zh.md">中文</a>
  </sup>
</div>

<div align="center">

  <!-- PROJECT TITLE -->
  <h3>
    <a href="https://docmd.io">
      <img src="https://github.com/docmd-io/docmd/blob/main/packages/ui/assets/images/docmd-logo-dark.png?raw=true" alt="docmd logo" width="210" />
    </a>
  </h3>
  
  <!-- ONE LINE SUMMARY -->
  <p>
    <b>Erstellen Sie in Sekundenschnelle produktionsreife Dokumentationen aus Markdown.</b>
    <br/>
    Zero Setup am Anfang. Volle Kontrolle, wenn Sie sie brauchen.
  </p>
  
  <!-- BADGES -->
  <p>
    <a href="https://www.npmjs.com/package/@docmd/core"><img src="https://img.shields.io/npm/v/@docmd/core.svg?style=flat-square&color=CB3837" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/@docmd/core?activeTab=versions"><img src="https://img.shields.io/npm/dm/@docmd/core.svg?style=flat-square&color=38bd24" alt="downloads"></a>
    <a href="https://github.com/docmd-io/docmd"><img src="https://img.shields.io/github/stars/docmd-io/docmd?style=flat-square&logo=github" alt="stars"></a>
    <a href="https://github.com/docmd-io/docmd/blob/main/LICENSE"><img src="https://img.shields.io/github/license/docmd-io/docmd.svg?style=flat-square&color=A31F34" alt="license"></a>
  </p>

  <!-- MENU -->
  <p>
    <h4>
      <a href="https://docmd.io">Website</a> • 
      <a href="https://docs.docmd.io">Dokumentation</a> • 
      <a href="https://live.docmd.io">Live-Editor</a> •
      <a href="https://github.com/docmd-io/docmd-skills">Agent Skills</a> •
      <a href="https://github.com/docmd-io/docmd/issues">Fehler melden</a>
    </h4>
  </p>

  <!-- PREVIEW -->
  <p>
    <br/>
    <a href="https://docs.docmd.io">
      <img width="800" alt="docmd preview" src="https://raw.githubusercontent.com/docmd-io/docmd/refs/heads/main/assets/docmd-cover.webp" />
    </a>
    <br/>
    <sup><i>docmd `default` Theme  -  Vorschau im Hell- und Dunkelmodus</i></sup>
  </p>

</div>

## Schnelleinstieg

**Führen Sie docmd sofort in jedem Ordner mit Markdown-Dateien aus:**

```bash
npx @docmd/core dev
```
Startet unter: `http://localhost:3000`

**Das ist alles.**

- Die Navigation wird automatisch generiert
- Seiten werden sofort gerendert
- Ihre Dokumente sind standardmäßig bereit für den Produktiveinsatz

Erstellen Sie Ihre Website:

```bash
npx @docmd/core build
```

### Installation für den regelmäßigen Gebrauch

```bash
npm install -g @docmd/core
```

Oder über Docker ausführen:

```bash
docker run -p 3000:3000 ghcr.io/docmd-io/docmd:latest
```

```bash
docmd dev     # Entwicklungsserver starten
docmd build   # Build für die Bereitstellung erstellen
docmd migrate # Von anderen Dokumentationswerkzeugen migrieren (wie Docusaurus, VitePress, MkDocs, etc.)
docmd deploy  # Docker-, Nginx- oder Caddy-Konfig. generieren
```

## Funktionen

Entwickelt, um sofort zu starten und ohne Reibungsverluste zu skalieren.

### Standardmäßig sofort einsatzbereit

* Automatische Navigation basierend auf Ihren Dateien
* Keine Konfiguration erforderlich
* Funktioniert direkt mit Markdown

### Produktionsreife Ausgabe

* Statische HTML-Generierung
* SEO-optimiert (Sitemap, Canonical, Weiterleitungen)
* Winziger JavaScript-Payload

### Integrierte Funktionen

* Internationalisierung (i18n)
* Versionierung
* Offline-Suche
* PWA-Unterstützung
* Analytik
* KI-Kontext (`llms.txt`)

### KI-First-Integration

* Nativer **MCP-Server** (`docmd mcp`) — KI-Agenten suchen, lesen und validieren Docs über stdio
* Agent-Skill-Set ([docmd-skills](https://github.com/docmd-io/docmd-skills)) — modulare Skills für LLMs und IDE-Agenten
* `llms.txt` / `llms-full.txt` — vollständiger Dokumentationskontext zur Build-Zeit generiert
* Markdown/Kontext kopieren — Browser-Buttons optimiert für KI-Chat

### Bei Bedarf erweiterbar

* Plugin-Unterstützung
* Eigene Konfiguration und Navigation
* Theming
* Programmatische API

Sehen Sie sich die vollständige [Roadmap](https://github.com/orgs/docmd-io/discussions/2) an.

## Projektstruktur

Hält Ihr Projekt einfach.

```bash
my-docs/
├── docs/
├── assets/
├── docmd.config.json (optional)
└── package.json
```

## Live-Editor

Ein browserbasierter Editor zum sofortigen Schreiben und Vorschauen von Dokumenten. Kein Setup erforderlich.

**Probieren Sie es aus: [live.docmd.io](https://live.docmd.io)**

## Konfiguration (optional)

Für den Anfang ist keine Konfiguration erforderlich.

Fügen Sie eine Konfigurationsdatei (`docmd.config.json` im Projektwurzelverzeichnis) nur hinzu, wenn Sie mehr Kontrolle benötigen.

```js
const { defineConfig } = require('@docmd/core');

module.exports = defineConfig({
  title: 'Mein Projekt',
  url: 'https://docs.meinprojekt.de',
});
```

### Gemeinsame Optionen

```js
module.exports = defineConfig({
  // Versionierung
  versions: {
    current: 'v2',
    all: [
      { id: 'v2', dir: 'docs' },
      { id: 'v1', dir: 'docs-v1' }
    ]
  },

  // Internationalisierung
  i18n: {
    default: 'en',
    locales: [
      { id: 'en', label: 'English' },
      { id: 'zh', label: '中文' },
    ]
  }
});
```

*Integrierte Unterstützung für: Englisch, Hindi, Chinesisch, Spanisch, Deutsch, Japanisch und Französisch. Sie können ganz einfach jede andere Sprache hinzufügen und unterstützen.*

Andere gängige Einstellungen sind `src`, `out`, Navigation, Plugins und Theming.

### Programmatische Verwendung

Verwendung in Skripten oder CI-Pipelines:

```js
const { build, buildLive } = require('@docmd/core');

await build('./docmd.config.json', { isDev: false });
await buildLive();
```

### Benötigen Sie mehr?

Vollständige Konfiguration, Plugins und fortgeschrittene Nutzung: **[docs.docmd.io](https://docs.docmd.io)**

## Plugin-Ökosystem

Kernfunktionen sind standardmäßig enthalten.

Alles funktioniert out-of-the-box.

Plugins werden nur benötigt, wenn Sie die Funktionalität erweitern möchten.

| Plugin      | Enthalten | Beschreibung                                            |
| :---------- | :------- | :------------------------------------------------------ |
| `search`    | ✓        | Offline-Volltextsuche mit Fuzzy-Matching                |
| `seo`       | ✓        | SEO-Tags und Open-Graph-Metadaten                       |
| `sitemap`   | ✓        | Generiert `sitemap.xml`                                 |
| `git`       | ✓        | Git-Commit-Historie Logger                              |
| `analytics` | ✓        | Leichtgewichtige Analytik-Integration                   |
| `llms`      | ✓        | KI-Kontextgenerierung (`llms.txt`)                      |
| `mermaid`   | ✓        | Mermaid-Diagramme in Markdown                           |
| `openapi`   | ✓        | OpenAPI 3.x-Spezifikations-Renderer zur Build-Zeit      |
| `pwa`       | Optional | PWA-Unterstützung für Offline-Navigation                |
| `threads`   | Optional | Inline-Diskussions-Threads *(von @svallory)*            |
| `math`      | Optional | KaTeX/LaTeX-Mathe-Rendering                             |

Optionale Plugins installieren:

```bash
docmd add <plugin-name>
```

## Warum docmd?

| Merkmal           | docmd                     | Docusaurus           | MkDocs Material | VitePress        | Mintlify         |
| :---------------- | :------------------------ | :------------------- | :-------------- | :--------------- | :--------------- |
| **Sprache**       | **Node.js**               | React.js             | Python          | Vue              | SaaS             |
| **Konfig. erf.**  | **Keine**                 | `docusaurus.config.js` | `mkdocs.yml`  | `config.mts`     | `mint.json`      |
| **Multi-Projekt** | **Nativ**                 | Plugin               | Plugin          | Nein             | Nein             |
| **Start-Payload** | **~18kb**                 | ~250kb               | ~40kb           | ~50kb            | ~120kb           |
| **Navigation**    | **Instant SPA**           | React SPA            | Vollständiger Reload | Vue SPA     | Gehostete SPA    |
| **Versionierung** | **Eingebaut**             | Nativ (komplex)      | mike Plugin     | Manuell          | Nativ            |
| **i18n**          | **Eingebaut**             | Nativ (komplex)      | Plugin-basiert  | Manuell          | Nativ            |
| **Suche**         | **Eingebaut (offline)**   | Algolia (Cloud)      | Eingebaut       | MiniSearch        | Cloud            |
| **KI-Kontext**    | **Eingebaut (`llms.txt`)**| Keiner               | Keiner          | Keiner           | Eingebaut        |
| **MCP-Server**    | **Eingebaut**             | Keiner               | Keiner          | Keiner           | Eingebaut        |
| **Agent Skills**  | **Eingebaut**             | Keine                | Keine           | Keine            | Eingebaut        |
| **Docker-Image**  | **Offiziell**             | Keines               | Offiziell       | Keines           | N/A              |
| **PWA**           | **Offizielles Plugin**    | Community-Plugin     | Keines          | Keines           | Gehostet         |
| **Self-hosted**   | **Ja**                    | Ja                   | Ja              | Ja               | Nein             |
| **Kosten**        | **Kostenlos (OSS)**       | Kostenlos (OSS)      | Kostenlos (OSS) | Kostenlos (OSS)  | Freemium         |

Fängt einfach an. Skaliert ohne Reibungsverluste.

## Philosophie

Dokumentationstools sollten verschwinden.

Fokus auf das Schreiben, nicht auf das Setup.

Kein Konfigurationsaufwand. Keine Komplexität durch Frameworks. Nur Dokumentation.

## Gemeinschaft & Support

* Beiträge sind willkommen. Siehe [CONTRIBUTING.md](.github/CONTRIBUTING.md)
* Wenn Sie es nützlich finden, ziehen Sie ein [Sponsoring](https://github.com/sponsors/mgks) in Betracht oder geben Sie dem Repo ein ⭐

## Lizenz

MIT-Lizenz. Siehe `LICENSE` für Details.
