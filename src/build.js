// Unisci PDF
// Copyright (C) 2026 magnuspub
//
// This program is free software: you can redistribute it and/or modify it under the terms of the
// GNU General Public License as published by the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
// even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
// General Public License for more details.
//
// You should have received a copy of the GNU General Public License along with this program.
// If not, see https://www.gnu.org/licenses/.

// Builds Unisci_PDF.html from src/index.html: the same app with its libraries placed inside the
// file, so the single file works offline and makes no network requests. It also writes
// THIRD-PARTY-NOTICES.txt and puts the same notices, with the text of the GNU GPL, inside the file.
//
// The folder docs/ is the same app as a site that can be installed (GitHub Pages serves it):
// docs/index.html is a copy of Unisci_PDF.html, next to the manifest that lets the installed app
// open PDF files and the service worker that keeps it working without a network.
//
// Usage: npm install, then: node src/build.js [node_modules folder] [output file]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const modules = path.resolve(process.argv[2] || path.join(root, 'node_modules'));
const outFile = path.resolve(process.argv[3] || path.join(root, 'Unisci_PDF.html'));
const noticesFile = path.join(path.dirname(outFile), 'THIRD-PARTY-NOTICES.txt');
const site = path.join(path.dirname(outFile), 'docs');

const read = (p) => fs.readFileSync(path.join(modules, p), 'utf8');
const pkg = (p) => JSON.parse(read(p + '/package.json'));
const text = (s) => s.replace(/\r\n/g, '\n').trim();
const wrap = (s, indent) => s.replace(/(?![^\n]{1,92}$)([^\n]{1,92})\s/g, '$1\n' + indent);

// Library code must not close the <script> element it is placed in. This is the only change made
// to the library files, and the notices say how many times it was needed in each.
const escaped = {};
function safe(name, js) {
  let n = 0;
  const out = js.replace(/<\/script/gi, () => { n++; return '<\\/script'; }).replace(/<!--/g, () => { n++; return '<\\!--'; });
  escaped[name] = n;
  return out;
}

let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function swap(find, put) {
  const parts = html.split(find);
  if (parts.length !== 2) throw new Error('expected exactly one match for: ' + find.slice(0, 70));
  html = parts[0] + put + parts[1];   // not String.replace: library code contains "$" sequences
}

const vLib = pkg('@cantoo/pdf-lib').version, vPdfjs = pkg('pdfjs-dist').version, vSort = pkg('sortablejs').version;
const cdnLib = '<script src="https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@' + vLib + '/dist/pdf-lib.min.js"></script>';
const cdnPdfjs = '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + vPdfjs + '/pdf.min.js"></script>';
const cdnSort = '<script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/' + vSort + '/Sortable.min.js"></script>';
for (const tag of [cdnLib, cdnPdfjs, cdnSort]) {
  if (!html.includes(tag)) throw new Error('the installed library versions do not match src/index.html: missing ' + tag);
}

// Starts the PDF worker from the code embedded in the file. If the browser refuses to run it
// (some do for pages opened from disk), PDF.js falls back to working on the page itself.
const WORKER_BOOT = `window.__pdfWorkerReady = new Promise(function (resolve) {
  var src = URL.createObjectURL(new Blob([document.getElementById('pdf-worker').textContent], { type: 'text/javascript' }));
  pdfjsLib.GlobalWorkerOptions.workerSrc = src;
  var done = false, worker = null;
  function finish(ok) {
    if (done) return;
    done = true;
    if (ok) pdfjsLib.GlobalWorkerOptions.workerPort = worker;
    else if (worker) worker.terminate();
    resolve();
  }
  try {
    worker = new Worker(src);
    worker.addEventListener('message', function onReply(e) {
      if (e.data && e.data.action === 'test') { worker.removeEventListener('message', onReply); finish(true); }
    });
    worker.addEventListener('error', function () { finish(false); });
    worker.postMessage({ sourceName: 'main', targetName: 'worker', action: 'test', data: new Uint8Array(1) });
    setTimeout(function () { finish(false); }, 2500);
  } catch (e) { finish(false); }
});`;

swap('<title>Unisci PDF</title>\n', '<title>Unisci PDF</title>\n<link rel="manifest" href="manifest.webmanifest">\n');
swap('<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">\n', '');
swap(cdnLib, '<script>' + safe('pdf-lib', read('@cantoo/pdf-lib/dist/pdf-lib.min.js')) + '</script>');
swap(cdnPdfjs,
  '<script>' + safe('PDF.js', read('pdfjs-dist/build/pdf.min.js')) + '</script>\n' +
  '<script type="text/plain" id="pdf-worker">' + safe('PDF.js worker', read('pdfjs-dist/build/pdf.worker.min.js')) + '</script>\n' +
  '<script>\n' + WORKER_BOOT + '\n</script>');
swap(cdnSort, '<script>' + safe('SortableJS', read('sortablejs/Sortable.min.js')) + '</script>');
swap("  pdfjsLib.GlobalWorkerOptions.workerSrc =\n    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + vPdfjs + "/pdf.worker.min.js';\n", '');
swap('Non riesco a caricare i componenti della pagina. Controlla la connessione a internet e ricarica.',
  'Questo file sembra incompleto: scaricalo di nuovo.');

// ---- notices of the libraries inside the file ------------------------------
const RULE = '='.repeat(80), LINE = '-'.repeat(80);
const section = (title, license, url, body) =>
  RULE + '\n' + title + '\nLicense: ' + license + (url ? '\n' + url : '') + '\n' + LINE + '\n' + text(body) + '\n';

const fonts = '@cantoo/pdf-lib/src/packages/standard-fonts/';
const afmDir = path.join(modules, fonts, 'font_metrics');
const adobeLines = new Set();
for (const f of fs.readdirSync(afmDir).filter((n) => n.endsWith('.afm')).sort()) {
  for (const line of fs.readFileSync(path.join(afmDir, f), 'latin1').split(/\r?\n/).slice(0, 40)) {
    const m = /^(?:Comment|Notice) (Copyright .*)$/.exec(line.trim());
    if (m) adobeLines.add(m[1].replace(/\s+/g, ' ').trim());
  }
}
const mustRead = fs.readFileSync(path.join(afmDir, 'MustRead.html'), 'latin1')
  .replace(/<[^>]+>/g, ' ').replace(/&reg;/g, '(R)').replace(/\s+/g, ' ');
const adobeTerms = (/This file and the 14 PostScript.*?support the use of the AFM files\./.exec(mustRead) || [''])[0];
if (!adobeTerms || !adobeLines.size) throw new Error('could not read the Adobe notice of the standard font metrics');

const changes = Object.keys(escaped).map((k) => '  ' + k + ': ' + escaped[k]).join('\n');
const notices = [
  'THIRD-PARTY NOTICES',
  '',
  'Unisci_PDF.html contains the libraries listed below. Each one is distributed under its own',
  'license, reproduced here. The library files are included as published. The only change is the',
  'escaping of character sequences that would end an HTML script element; number of sequences',
  'escaped in each file:',
  changes,
  '',
  section('@cantoo/pdf-lib ' + vLib, 'MIT', 'https://github.com/cantoo-scribe/pdf-lib', read('@cantoo/pdf-lib/LICENSE.md')),
  'The published build of pdf-lib contains the components that follow, up to the PDF.js section.',
  '',
  section('Standard font metrics (@cantoo/standard-fonts, from @pdf-lib/standard-fonts)', 'MIT, with font metrics from Adobe',
    'https://github.com/cantoo-scribe/pdf-lib',
    read(fonts + 'LICENSE.md') + '\n\n' +
    'The metrics come from the Adobe Core 14 AFM files, which carry these notices:\n\n' +
    Array.from(adobeLines).map((l) => '  ' + wrap(l, '    ')).join('\n') + '\n\n' + wrap(adobeTerms, '') + '\n\n' +
    'The base64 decoding in this component is from base64-arraybuffer\n' +
    '(https://github.com/niklasvh/base64-arraybuffer), Copyright (c) 2012 Niklas von Hertzen,\nlicensed under the MIT license.'),
  section('UPNG (@cantoo/upng, based on photopea/UPNG.js)', 'MIT', 'https://github.com/photopea/UPNG.js',
    read('@cantoo/pdf-lib/src/packages/upng/LICENSE')),
  section('fflate', 'MIT', 'https://github.com/101arrowz/fflate', read('fflate/LICENSE')),
  section('culori', 'MIT', 'https://github.com/Evercoder/culori', read('culori/LICENSE')),
  section('node-html-better-parser', 'MIT', 'https://github.com/taoqf/node-html-parser', read('node-html-better-parser/LICENSE')),
  section('html-entities', 'MIT', 'https://github.com/mdevils/html-entities', read('html-entities/LICENSE')),
  section('tslib', '0BSD', 'https://github.com/microsoft/tslib', read('tslib/LICENSE.txt')),
  section('PDF.js ' + vPdfjs + ' (pdfjs-dist)', 'Apache License 2.0', 'https://github.com/mozilla/pdf.js',
    'Copyright 2023 Mozilla Foundation\n\n' + read('pdfjs-dist/LICENSE').replace(/\r\n/g, '\n').replace(/^\n+|\s+$/g, '')),
  section('SortableJS ' + vSort, 'MIT', 'https://github.com/SortableJS/Sortable', read('sortablejs/LICENSE'))
].join('\n');

// ---- the text shown by "Licenze e crediti" inside the built file ------------
const gpl = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/, '');
const open = '<script type="text/plain" id="licenses">\n';
const a = html.indexOf(open), b = html.indexOf('</script>', a);
const marker = 'This page loads the following libraries, each under its own license:';
const own = html.slice(a + open.length, b);
if (a < 0 || b < 0 || !own.includes(marker)) throw new Error('the licenses block of src/index.html was not found');
const legal = own.slice(0, own.indexOf(marker)) +
  'This file contains third-party libraries under their own licenses. Their notices follow the\n' +
  'text of the GNU General Public License.\n\n\n' + gpl + '\n\n\n' + notices;
html = html.slice(0, a + open.length) + safe('licenses', legal) + '\n' + html.slice(b);
delete escaped.licenses;

swap('  Source code: https://github.com/magnuspub/Unisci-PDF\n-->',
  '  Source code: https://github.com/magnuspub/Unisci-PDF\n\n' +
  '  This single file also contains third-party libraries (pdf-lib ' + vLib + ', PDF.js ' + vPdfjs + ',\n' +
  '  SortableJS ' + vSort + ') under their own licenses. Their notices and the full text of the GNU\n' +
  '  General Public License are in the element with id "licenses" further down, and can be read\n' +
  '  from the page itself: "Licenze e crediti".\n-->');

for (const host of ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com']) {
  if (html.includes(host)) throw new Error('still refers to ' + host);
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);
fs.writeFileSync(noticesFile, notices + '\n');

// ---- the installable site ----------------------------------------------------
const manifest = {
  name: 'Unisci PDF',
  short_name: 'Unisci PDF',
  description: 'Legge, modifica e unisce i PDF sul tuo computer: testo, firme, evidenziazioni e note.',
  lang: 'it',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#e8ecf1',
  theme_color: '#e8ecf1',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ],
  // once installed, the system can open PDF files with the app
  file_handlers: [{ action: './', accept: { 'application/pdf': ['.pdf'] } }]
};
// The version changes whenever the app changes, so an installed copy picks up the new one.
const version = crypto.createHash('sha1').update(html).update(JSON.stringify(manifest)).digest('hex').slice(0, 12);
const worker = `// Unisci PDF: keeps the installed app working without a network. Written by src/build.js.
const CACHE = 'unisci-pdf-${version}';
const SHELL = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('unisci-pdf-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => {
    if (hit) return hit;
    return fetch(request).catch(() => (request.mode === 'navigate' ? caches.match('./') : Response.error()));
  }));
});
`;
fs.mkdirSync(site, { recursive: true });
fs.writeFileSync(path.join(site, 'index.html'), html);
fs.writeFileSync(path.join(site, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(site, 'sw.js'), worker);
fs.writeFileSync(path.join(site, '.nojekyll'), '');
for (const icon of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
  if (!fs.existsSync(path.join(site, 'icons', icon))) throw new Error('missing docs/icons/' + icon + ': run python3 src/make-icons.py');
}
console.log('wrote', outFile, (html.length / 1048576).toFixed(2) + ' MB');
console.log('wrote', noticesFile, 'escapes:', JSON.stringify(escaped));
console.log('wrote', site, 'version', version);
