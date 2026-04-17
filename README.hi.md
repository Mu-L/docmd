<div align="right">
  <a href="./README.md">English</a> &nbsp;|&nbsp; <a href="./README.zh.md">中文</a> &nbsp;|&nbsp; <b>हिन्दी</b>
</div>

<div align="center">

  <!-- प्रोजेक्ट शीर्षक -->
  <h3>
    <a href="https://docmd.io">
      <img src="https://github.com/docmd-io/docmd/blob/main/packages/ui/assets/images/docmd-logo-dark.png?raw=true" alt="docmd logo" width="210" />
    </a>
  </h3>
  
  <!-- एक-लाइन सारांश -->
  <p>
    <b>Markdown से सेकंडों में प्रोडक्शन-रेडी डॉक्यूमेंटेशन बनाएँ।</b>
    <br/>
    शुरुआत में ज़ीरो सेटअप। ज़रूरत पड़ने पर पूरा नियंत्रण।
  </p>
  
  <!-- बैजेज़ -->
  <p>
    <a href="https://www.npmjs.com/package/@docmd/core"><img src="https://img.shields.io/npm/v/@docmd/core.svg?style=flat-square&color=CB3837" alt="npm संस्करण"></a>
    <a href="https://www.npmjs.com/package/@docmd/core?activeTab=versions"><img src="https://img.shields.io/npm/dm/@docmd/core.svg?style=flat-square&color=38bd24" alt="डाउनलोड"></a>
    <a href="https://github.com/docmd-io/docmd"><img src="https://img.shields.io/github/stars/docmd-io/docmd?style=flat-square&logo=github" alt="स्टार्स"></a>
    <a href="https://github.com/docmd-io/docmd/blob/main/LICENSE"><img src="https://img.shields.io/github/license/docmd-io/docmd.svg?style=flat-square&color=A31F34" alt="लाइसेंस"></a>
  </p>

  <!-- मेनू -->
  <p>
    <h4>
      <a href="https://docmd.io">वेबसाइट</a> • 
      <a href="https://docs.docmd.io">दस्तावेज़ीकरण</a> • 
      <a href="https://live.docmd.io">लाइव एडिटर</a> •
      <a href="https://github.com/docmd-io/docmd/issues">बग रिपोर्ट करें</a>
    </h4>
  </p>

  <!-- प्रीव्यू -->
  <p>
    <br/>
    <img width="800" alt="docmd preview" src="https://github.com/user-attachments/assets/b65782ee-01e5-4f82-a204-4965a8f12402" />
    <br/>
    <sup><i>docmd `default` थीम — लाइट अपीयरेंस</i></sup>
  </p>

</div>

## क्विक स्टार्ट

**किसी भी Markdown फ़ाइलों वाले फ़ोल्डर में docmd तुरंत चलाएँ:**

```bash
npx @docmd/core dev
```
शुरू होता है: `http://localhost:3000`

**बस इतना ही।**

- नेविगेशन अपने-आप बनता है
- पेज तुरंत रेंडर होते हैं
- डॉक्स डिफ़ॉल्ट रूप से प्रोडक्शन-रेडी हैं

साइट बनाएँ:

```bash
npx @docmd/core build
```

### नियमित उपयोग के लिए इंस्टॉल करें

```bash
npm install -g @docmd/core
```

```bash
docmd dev    # डेव सर्वर शुरू करें
docmd build  # डिप्लॉयमेंट के लिए बिल्ड करें
```

## विशेषताएँ

बिना किसी रुकावट के तुरंत शुरू करने और स्केल करने के लिए बनाया गया।

### डिफ़ॉल्ट रूप से तात्कालिक

* आपकी फ़ाइलों से अपने-आप नेविगेशन
* कोई कॉन्फ़िगरेशन ज़रूरी नहीं
* सीधे Markdown के साथ काम करता है

### प्रोडक्शन-रेडी आउटपुट

* स्टैटिक HTML जनरेशन
* SEO ऑप्टिमाइज़्ड (sitemap, canonical, redirects)
* बहुत कम JavaScript पेलोड

### बिल्ट-इन क्षमताएँ

* अंतर्राष्ट्रीयकरण (i18n)
* वर्शनिंग
* ऑफ़लाइन सर्च
* PWA सपोर्ट
* एनालिटिक्स
* AI कॉन्टेक्स्ट (`llms.txt`)

### ज़रूरत पड़ने पर एक्सटेंसिबल

* प्लगइन सपोर्ट
* कस्टम कॉन्फ़िगरेशन और नेविगेशन
* थीमिंग
* प्रोग्रामेटिक API

पूरा [रोडमैप](https://github.com/orgs/docmd-io/discussions/2) देखें।

## प्रोजेक्ट स्ट्रक्चर

आपके प्रोजेक्ट को सरल रखता है।

```bash
my-docs/
├── docs/
├── assets/
├── docmd.config.js (ऑप्शनल)
└── package.json
```

## लाइव एडिटर

डॉक्स लिखने और तुरंत प्रीव्यू करने के लिए एक ब्राउज़र-आधारित एडिटर। कोई सेटअप ज़रूरी नहीं।

**आज़माएँ: https://live.docmd.io**

## कॉन्फ़िगरेशन (ऑप्शनल)

शुरू करने के लिए कोई कॉन्फ़िगरेशन ज़रूरी नहीं।

कॉन्फ़िग फ़ाइल (`docmd.config.js` प्रोजेक्ट रूट में) तभी जोड़ें जब आपको अधिक नियंत्रण चाहिए।

```js
const { defineConfig } = require('@docmd/core');

module.exports = defineConfig({
  title: 'मेरा प्रोजेक्ट',
  url: 'https://docs.myproject.com',
});
```

### सामान्य विकल्प

```js
module.exports = defineConfig({
  // वर्शनिंग
  versions: {
    current: 'v2',
    all: [
      { id: 'v2', dir: 'docs' },
      { id: 'v1', dir: 'docs-v1' }
    ]
  },

  // अंतर्राष्ट्रीयकरण
  i18n: {
    default: 'en',
    locales: [
      { id: 'en', label: 'English' },
      { id: 'hi', label: 'हिन्दी' },
    ]
  }
});
```

अन्य सामान्य सेटिंग्स: `src`, `out`, navigation, plugins, और theming।

### प्रोग्रामेटिक उपयोग

स्क्रिप्ट या CI पाइपलाइन में उपयोग करें:

```js
const { build, buildLive } = require('@docmd/core');

await build('./docmd.config.js', { isDev: false });
await buildLive();
```

### और चाहिए?

पूरी कॉन्फ़िगरेशन, प्लगइन, और एडवांस्ड उपयोग: **[docs.docmd.io](https://docs.docmd.io)**

## प्लगइन इकोसिस्टम

कोर फ़ंक्शनालिटी डिफ़ॉल्ट रूप से शामिल है।

सब कुछ डिफ़ॉल्ट रूप से काम करता है।

प्लगइन केवल तभी ज़रूरी हैं जब आप फ़ंक्शनालिटी बढ़ाना चाहते हैं।

| प्लगइन | शामिल | विवरण |
| :---------- | :------- | :------------------------------------------------- |
| `search` | ✓ | फ़ज़ी मैचिंग के साथ ऑफ़लाइन फुल-टेक्स्ट सर्च |
| `seo` | ✓ | SEO टैग्स और Open Graph मेटाडेटा |
| `sitemap` | ✓ | `sitemap.xml` जनरेट करता है |
| `analytics` | ✓ | हल्का एनालिटिक्स इंटीग्रेशन |
| `llms` | ✓ | AI कॉन्टेक्स्ट जनरेशन (`llms.txt`) |
| `mermaid` | ✓ | Markdown में Mermaid डायग्राम |
| `pwa` | ऑप्शनल | ऑफ़लाइन नेविगेशन के लिए Progressive Web App सपोर्ट |
| `threads` | ऑप्शनल | इनलाइन डिस्कशन थ्रेड्स *(by @svallory)* |
| `math` | ऑप्शनल | KaTeX/LaTeX मैथ रेंडरिंग |

ऑप्शनल प्लगइन इंस्टॉल करें:

```bash
docmd plugin add <plugin-name>
```

## docmd क्यों?

| विशेषता | docmd | Docusaurus | MkDocs Material | VitePress | Mintlify |
| :--------------- | :------------------------ | :------------------- | :-------------- | :--------------- | :--------------- |
| **भाषा** | **Node.js** | React.js | Python | Vue | SaaS |
| **कॉन्फ़िग आवश्यक** | **कोई नहीं** | `docusaurus.config.js` | `mkdocs.yml` | `config.mts` | `mint.json` |
| **प्रारंभिक पेलोड** | **~18kb** | ~250kb | ~40kb | ~50kb | ~120kb |
| **नेविगेशन** | **इंस्टैंट SPA** | React SPA | पेज रिलोड | Vue SPA | होस्टेड SPA |
| **वर्शनिंग** | **बिल्ट-इन** | नेटिव (जटिल) | mike प्लगइन | मैनुअल | नेटिव |
| **i18n** | **बिल्ट-इन** | नेटिव (जटिल) | प्लगइन-आधारित | मैनुअल | नेटिव |
| **सर्च** | **बिल्ट-इन (ऑफ़लाइन)** | Algolia (क्लाउड) | बिल्ट-इन | MiniSearch | क्लाउड |
| **AI कॉन्टेक्स्ट** | **बिल्ट-इन (`llms.txt`)** | मैनुअल | कोई नहीं | कोई नहीं | प्रोप्राइटरी |
| **PWA** | **ऑफिशियल प्लगइन** | कम्युनिटी प्लगइन | कोई नहीं | कोई नहीं | होस्टेड |
| **सेल्फ-होस्टेड** | **हाँ** | हाँ | हाँ | हाँ | नहीं |
| **ज़ीरो-कॉन्फ़िग** | **`npx @docmd/core dev`** | नहीं | नहीं | नहीं | नहीं |
| **लागत** | **मुफ़्त (OSS)** | मुफ़्त (OSS) | मुफ़्त (OSS) | मुफ़्त (OSS) | फ्रीमियम |

सरलता से शुरू। बिना रुकावट के स्केल।

## फ़िलॉसफ़ी

डॉक्यूमेंटेशन टूल्स को गायब हो जाना चाहिए।

लिखने पर ध्यान दें, सेटअप पर नहीं।

कोई कॉन्फ़िगरेशन ओवरहेड नहीं। कोई फ्रेमवर्क जटिलता नहीं। बस डॉक्स।

## कम्युनिटी और सपोर्ट

* योगदान का स्वागत है। [CONTRIBUTING.md](.github/CONTRIBUTING.md) देखें
* अगर आपको उपयोगी लगे, तो [स्पॉन्सर करें](https://github.com/sponsors/mgks) या रेपो को ⭐ दें

## लाइसेंस

MIT लाइसेंस। विवरण के लिए `LICENSE` देखें।