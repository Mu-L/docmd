<div align="right">
  <a href="./README.md">EN</a> &nbsp;|&nbsp; <b>ES</b> &nbsp;|&nbsp; <a href="./README.de.md">DE</a> &nbsp;|&nbsp; <a href="./README.ja.md">日本語</a> &nbsp;|&nbsp; <a href="./README.fr.md">FR</a> &nbsp;|&nbsp; <a href="./README.zh.md">中文</a>
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
    <b>Crea documentación lista para producción desde Markdown en segundos.</b>
    <br/>
    Configuración cero al empezar. Control total cuando lo necesites.
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
      <a href="https://docmd.io">Sitio web</a> • 
      <a href="https://docs.docmd.io">Documentación</a> • 
      <a href="https://live.docmd.io">Editor en vivo</a> •
      <a href="https://github.com/docmd-io/docmd/issues">Reportar error</a>
    </h4>
  </p>

  <!-- PREVIEW -->
  <p>
    <br/>
    <img width="800" alt="docmd preview" src="https://raw.githubusercontent.com/docmd-io/docmd/refs/heads/main/assets/docmd-cover.webp" />
    <br/>
    <sup><i>Vista previa del tema `default` de docmd en modo claro y oscuro</i></sup>
  </p>

</div>

## Inicio Rápido

**Ejecuta docmd instantáneamente en cualquier carpeta con archivos Markdown:**

```bash
npx @docmd/core dev
```
Inicia en: `http://localhost:3000`

**Eso es todo.**

- La navegación se genera automáticamente
- Las páginas se renderizan instantáneamente
- Tus documentos están listos para producción por defecto

Construye tu sitio:

```bash
npx @docmd/core build
```

### Instalar para uso regular

```bash
npm install -g @docmd/core
```

```bash
docmd dev    # iniciar servidor de desarrollo
docmd build  # construir para despliegue
```

## Características

Diseñado para empezar al instante y escalar sin fricciones.

### Instantáneo por defecto

* Navegación automática desde tus archivos
* Configuración cero requerida
* Funciona directamente con Markdown

### Salida lista para producción

* Generación de HTML estático
* Optimizado para SEO (sitemap, canonical, redirecciones)
* Carga de JavaScript mínima

### Capacidades integradas

* Internacionalización (i18n)
* Versiones
* Búsqueda fuera de línea
* Soporte PWA
* Analítica
* Contexto para AI (`llms.txt`)

### Extensible cuando sea necesario

* Soporte para plugins
* Configuración y navegación personalizada
* Temas personalizados
* API programática

Mira el [roadmap](https://github.com/orgs/docmd-io/discussions/2) completo.

## Estructura del Proyecto

Mantiene tu proyecto simple.

```bash
my-docs/
├── docs/
├── assets/
├── docmd.config.js (opcional)
└── package.json
```

## Editor en Vivo

Un editor basado en navegador para escribir y previsualizar documentos al instante. Sin configuración.

**Pruébalo: [live.docmd.io](https://live.docmd.io)**

## Configuración (opcional)

No se requiere configuración para empezar.

Añade un archivo de configuración (`docmd.config.js` en la raíz del proyecto) solo cuando necesites más control.

```js
const { defineConfig } = require('@docmd/core');

module.exports = defineConfig({
  title: 'Mi Proyecto',
  url: 'https://docs.miproyecto.com',
});
```

### Opciones comunes

```js
module.exports = defineConfig({
  // Versiones
  versions: {
    current: 'v2',
    all: [
      { id: 'v2', dir: 'docs' },
      { id: 'v1', dir: 'docs-v1' }
    ]
  },

  // Internacionalización
  i18n: {
    default: 'en',
    locales: [
      { id: 'en', label: 'English' },
      { id: 'zh', label: '中文' },
    ]
  }
});
```

*Soporte integrado para: Inglés, Hindi, Chino, Español, Alemán, Japonés y Francés. Puedes añadir y soportar fácilmente cualquier otro idioma.*

Otros ajustes comunes incluyen `src`, `out`, navegación, plugins y temas.

### Uso programático

Uso en scripts o flujos de CI:

```js
const { build, buildLive } = require('@docmd/core');

await build('./docmd.config.js', { isDev: false });
await buildLive();
```

### ¿Necesitas más?

Configuración completa, plugins y uso avanzado: **[docs.docmd.io](https://docs.docmd.io)**

## Ecosistema de Plugins

La funcionalidad principal se incluye por defecto.

Todo funciona de inmediato.

Los plugins solo son necesarios cuando quieres extender la funcionalidad.

| Plugin      | Incluido | Descripción                                           |
| :---------- | :------- | :---------------------------------------------------- |
| `search`    | ✓        | Búsqueda de texto completo con coincidencia difusa    |
| `seo`       | ✓        | Etiquetas SEO y metadatos Open Graph                  |
| `sitemap`   | ✓        | Genera `sitemap.xml`                                  |
| `analytics` | ✓        | Integración de analítica ligera                       |
| `llms`      | ✓        | Generación de contexto para AI (`llms.txt`)           |
| `mermaid`   | ✓        | Diagramas Mermaid en Markdown                         |
| `pwa`       | Opcional | Soporte PWA para navegación fuera de línea            |
| `threads`   | Opcional | Hilos de discusión en línea *(por @svallory)*         |
| `math`      | Opcional | Renderizado matemático KaTeX/LaTeX                   |

Instalar plugins opcionales:

```bash
docmd add <plugin-name>
```

## ¿Por qué docmd?

| Característica   | docmd                     | Docusaurus           | MkDocs Material | VitePress        | Mintlify         |
| :--------------- | :------------------------ | :------------------- | :-------------- | :--------------- | :--------------- |
| **Lenguaje**     | **Node.js**               | React.js             | Python          | Vue              | SaaS             |
| **Config. req.** | **Ninguna**               | `docusaurus.config.js` | `mkdocs.yml`  | `config.mts`     | `mint.json`      |
| **Carga inicial**| **~18kb**                 | ~250kb               | ~40kb           | ~50kb            | ~120kb           |
| **Navegación**   | **SPA Instantánea**       | React SPA            | Recarga total   | Vue SPA          | SPA Alojada      |
| **Versiones**    | **Integrada**             | Nativa (compleja)    | mike plugin     | Manual           | Nativa           |
| **i18n**         | **Integrada**             | Nativa (compleja)    | Basada en plugins| Manual           | Nativa           |
| **Búsqueda**     | **Integrada (offline)**   | Algolia (nube)       | Integrada       | MiniSearch        | Nube             |
| **Contexto AI**  | **Integrada (`llms.txt`)**| Manual               | Ninguno         | Ninguno          | Propietario      |
| **PWA**          | **Plugin Oficial**        | Plugin comunidad     | Ninguno         | Ninguno          | Alojado          |
| **Autohospedado**| **Sí**                    | Sí                   | Sí              | Sí               | No               |
| **Zero-config**  | **`npx @docmd/core dev`** | No                   | No              | No               | No               |
| **Costo**        | **Gratis (OSS)**          | Gratis (OSS)         | Gratis (OSS)    | Gratis (OSS)     | Freemium         |

Empieza simple. Escala sin fricción.

## Filosofía

Las herramientas de documentación deberían desaparecer.

Concéntrate en escribir, no en la configuración.

Sin sobrecarga de configuración. Sin complejidad de frameworks. Solo documentación.

## Comunidad y Soporte

* Las contribuciones son bienvenidas. Ver [CONTRIBUTING.md](.github/CONTRIBUTING.md)
* Si te resulta útil, considera [patrocinar](https://github.com/sponsors/mgks) o dar una estrella al repositorio ⭐

## Licencia

Licencia MIT. Ver `LICENSE` para más detalles.
