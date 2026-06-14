<div align="right">
  <sup>
    <a href="./README.md">EN</a> &nbsp;|&nbsp; <a href="./README.es.md">ES</a> &nbsp;|&nbsp; <a href="./README.de.md">DE</a> &nbsp;|&nbsp; <a href="./README.ja.md">日本語</a> &nbsp;|&nbsp; <b>FR</b> &nbsp;|&nbsp; <a href="./README.zh.md">中文</a>
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
    <b>Créez une documentation prête pour la production à partir de Markdown en quelques secondes.</b>
    <br/>
    Moteur de documentation AI-First & Zero-Config pour les développeurs et les agents LLM.
  </p>
  
  <!-- BADGES -->
  <p>
    <a href="https://www.npmjs.com/package/@docmd/core"><img src="https://img.shields.io/npm/v/@docmd/core.svg?style=flat-square&color=CB3837" alt="version npm"></a>
    <a href="https://www.npmjs.com/package/@docmd/core?activeTab=versions"><img src="https://img.shields.io/npm/dm/@docmd/core.svg?style=flat-square&color=38bd24" alt="téléchargements"></a>
    <a href="https://github.com/docmd-io/docmd"><img src="https://img.shields.io/github/stars/docmd-io/docmd?style=flat-square&logo=github" alt="étoiles"></a>
    <a href="https://github.com/docmd-io/docmd/blob/main/LICENSE"><img src="https://img.shields.io/github/license/docmd-io/docmd.svg?style=flat-square&color=A31F34" alt="licence"></a>
  </p>

  <!-- MENU -->
  <p>
    <h4>
      <a href="https://docmd.io">Site Web</a> • 
      <a href="https://docs.docmd.io">Documentation</a> • 
      <a href="https://live.docmd.io">Éditeur en direct</a> •
      <a href="https://github.com/docmd-io/docmd-skills">Agent Skills</a> •
      <a href="https://github.com/docmd-io/docmd/issues">Signaler un bug</a>
    </h4>
  </p>

  <!-- PREVIEW -->
  <p>
    <br/>
    <a href="https://docs.docmd.io">
      <img width="800" alt="docmd preview" src="https://raw.githubusercontent.com/docmd-io/docmd/refs/heads/main/assets/docmd-cover.webp" />
    </a>
    <br/>
    <sup><i>Aperçu du thème `default` de docmd en modes clair et sombre</i></sup>
  </p>

</div>

## Démarrage Rapide

**Exécutez docmd instantanément dans n'importe quel dossier contenant des fichiers Markdown :**

```bash
npx @docmd/core dev
```
Démarre sur : `http://localhost:3000`

**C'est tout.**

- La navigation est générée automatiquement
- Les pages sont rendues instantanément
- Vos documents sont prêts pour la production par défaut

Construisez votre site :

```bash
npx @docmd/core build
```

### Installation pour un usage régulier

```bash
npm install -g @docmd/core
```

Ou exécuter via Docker :

```bash
docker run -p 3000:3000 ghcr.io/docmd-io/docmd:0.8.6
```

```bash
docmd dev     # démarrer le serveur de développement
docmd build   # construire pour le déploiement
docmd migrate # migrer depuis d'autres outils (comme Docusaurus, VitePress, MkDocs, etc.)
docmd deploy  # générer des configs docker, nginx ou caddy
```

## Caractéristiques

Conçu pour démarrer instantanément et évoluer sans friction.

### Instantané par défaut

* Navigation automatique à partir de vos fichiers
* Zéro configuration requise
* Fonctionne directement avec Markdown

### Sortie prête pour la production

* Génération de HTML statique
* Optimisé pour le SEO (sitemap, canonical, redirections)
* Charge JavaScript minuscule

### Capacités intégrées

* Internationalisation (i18n)
* Versionnage
* Recherche hors ligne
* Support PWA
* Analytique
* Contexte pour l'IA (`llms.txt`)

### Intégration AI-First

* **Serveur MCP** Natif (`docmd mcp`) — Les agents IA cherchent, lisent et valident des documents via stdio
* Ensemble de compétences de l'agent ([docmd-skills](https://github.com/docmd-io/docmd-skills)) — compétences modulaires pour les LLM et agents d'IDE
* `llms.txt` / `llms-full.txt` — contexte de documentation complet généré lors de la construction
* Widgets Copier Markdown / Copiar Context — boutons du navigateur optimisés pour le chat IA

### Extensible au besoin

* Support des plugins
* Configuration et navigation personnalisées
* Personnalisation du thème
* API programmatique

Voir la [roadmap](https://github.com/orgs/docmd-io/discussions/2) complète.

## Structure du Projet

Garde votre projet simple.

```bash
my-docs/
├── docs/
├── assets/
├── docmd.config.json (optionnel)
└── package.json
```

## Éditeur en Direct

Un éditeur par navigateur pour écrire et prévisualiser des documents instantanément. Aucune configuration requise.

**Essayez-le : [live.docmd.io](https://live.docmd.io)**

## Configuration (optionnelle)

Aucune configuration n'est requise pour commencer.

Ajoutez un fichier de configuration (`docmd.config.json` à la racine du projet) uniquement lorsque vous avez besoin de plus de contrôle.

```js
const { defineConfig } = require('@docmd/core');

module.exports = defineConfig({
  title: 'Mon Projet',
  url: 'https://docs.monprojet.fr',
});
```

### Options courantes

```js
module.exports = defineConfig({
  // Versionnage
  versions: {
    current: 'v2',
    all: [
      { id: 'v2', dir: 'docs' },
      { id: 'v1', dir: 'docs-v1' }
    ]
  },

  // Internationalisation
  i18n: {
    default: 'en',
    locales: [
      { id: 'en', label: 'English' },
      { id: 'zh', label: '中文' },
    ]
  }
});
```

*Support intégré pour : Anglais, Hindi, Chinois, Espagnol, Allemand, Japonais et Français. Vous pouvez facilement ajouter et supporter n'importe quelle autre langue.*

D'autres réglages courants incluent `src`, `out`, la navigation, les plugins et les thèmes.

### Utilisation programmatique

Utilisation dans des scripts ou des pipelines CI :

```js
const { build, buildLive } = require('@docmd/core');

await build('./docmd.config.json', { isDev: false });
await buildLive();
```

### Besoin de plus ?

Configuration complète, plugins et usage avancé : **[docs.docmd.io](https://docs.docmd.io)**

## Écosystème de Plugins

Les fonctionnalités de base sont incluses par défaut.

Tout fonctionne dès la sortie de la boîte.

Les plugins ne sont nécessaires que lorsque vous souhaitez étendre les fonctionnalités.

| Plugin      | Inclus   | Description                                          |
| :---------- | :------- | :--------------------------------------------------- |
| `search`    | ✓        | Recherche plein texte hors ligne                     |
| `seo`       | ✓        | Balises SEO et métadonnées Open Graph                |
| `sitemap`   | ✓        | Génère `sitemap.xml`                                 |
| `git`       | ✓        | Journal d'historique des commits Git                 |
| `analytics` | ✓        | Intégration d'analyse légère                         |
| `llms`      | ✓        | Génération de contexte pour IA (`llms.txt`)          |
| `mermaid`   | ✓        | Diagrammes Mermaid en Markdown                       |
| `openapi`   | ✓        | Rendu OpenAPI 3.x au moment de la construction       |
| `pwa`       | Optional | Support PWA pour la navigation hors ligne            |
| `threads`   | Optional | Fils de discussion en ligne *(par @svallory)*        |
| `math`      | Optional | Rendu mathématique KaTeX/LaTeX                       |

Installer des plugins optionnels :

```bash
docmd add <plugin-name>
```

## Pourquoi docmd ?

| Fonctionnalité   | docmd                     | Docusaurus           | MkDocs Material | VitePress        | Mintlify         |
| :--------------- | :------------------------ | :------------------- | :-------------- | :--------------- | :--------------- |
| **Langage**      | **Node.js**               | React.js             | Python          | Vue              | SaaS             |
| **Config. req.** | **Aucune**                | `docusaurus.config.js` | `mkdocs.yml`  | `config.mts`     | `mint.json`      |
| **Multi-projet**  | **Natif**                 | Plugin               | Plugin          | Non              | Non              |
| **Charge init.** | **~18kb**                 | ~250kb               | ~40kb           | ~50kb            | ~120kb           |
| **Navigation**   | **SPA Instantanée**       | React SPA            | Rechargements complets | Vue SPA   | SPA Hébergée     |
| **Versionnage**  | **Intégré**               | Natif (complexe)     | plugin mike     | Manuel           | Natif            |
| **i18n**         | **Intégré**               | Natif (complexe)     | Via plugin      | Manuel           | Natif            |
| **Recherche**    | **Intégré (hors ligne)**  | Algolia (cloud)      | Intégré         | MiniSearch        | Cloud            |
| **Contexte IA**  | **Intégré (`llms.txt`)**  | Manuel               | Aucun           | Aucun            | Propriétaire     |
| **Serveur MCP**  | **Intégré**               | Aucun                | Aucun           | Aucun            | Intégré          |
| **Agent Skills**  | **Intégré**               | Aucun                | Aucun           | Aucun            | Intégré          |
| **Image Docker** | **Officiel**              | Aucun                | Officiel        | Aucun            | N/A              |
| **PWA**          | **Plugin Officiel**       | Plugin communautaire | Aucun           | Aucun            | Hébergé          |
| **Auto-hébergé** | **Oui**                   | Oui                  | Oui             | Oui              | Non              |
| **Coût**         | **Gratuit (OSS)**         | Gratuit (OSS)        | Gratuit (OSS)   | Gratuit (OSS)     | Freemium         |

Démarrez simplement. Évoluez sans friction.

## Philosophie

Les outils de documentation devraient s'effacer.

Concentrez-vous sur l'écriture, pas sur la configuration.

Pas de surcharge de configuration. Pas de complexité de framework. Juste de la doc.

## Communauté et Support

* Les contributions sont les bienvenues. Voir [CONTRIBUTING.md](.github/CONTRIBUTING.md)
* Si vous le trouvez utile, envisagez de [parrainer](https://github.com/sponsors/mgks) ou de mettre une étoile au dépôt ⭐

## Licence

Licence MIT. Voir `LICENSE` pour plus de détails.
