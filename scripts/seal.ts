// seal.ts: turn a plaintext, self-contained trip page into a sealed page.
//
//   TRIPS_PASSPHRASE_FILE=~/.config/trips/passphrase bun run seal -- \
//     --in  /path/to/plain.html \
//     --out public/napa-2026/index.html \
//     --title "Napa, with Wall E"
//
// The output is one static HTML file: an unlock screen plus the ciphertext.
// Key: PBKDF2-SHA256, 600k iterations, 16-byte salt. Cipher: AES-256-GCM,
// 12-byte IV. The passphrase is read from TRIPS_PASSPHRASE or from the file
// named by TRIPS_PASSPHRASE_FILE and is never written anywhere.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const KDF_ITERATIONS = 600_000

type Args = { in: string; out: string; title: string; slug: string }

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const inPath = get('--in')
  const out = get('--out')
  const title = get('--title') ?? 'Trip'
  if (!inPath || !out) {
    console.error('usage: bun run seal -- --in <plain.html> --out <public/<slug>/index.html> [--title "..."]')
    process.exit(2)
  }
  const slug = get('--slug') ?? out.split('/').filter(Boolean).slice(-2, -1)[0] ?? 'trip'
  return { in: inPath, out, title, slug }
}

function readPassphrase(): string {
  const direct = process.env.TRIPS_PASSPHRASE
  if (direct && direct.trim()) return direct
  const file = process.env.TRIPS_PASSPHRASE_FILE
  if (file) {
    const expanded = file.replace(/^~(?=$|\/)/, process.env.HOME ?? '')
    const text = readFileSync(expanded, 'utf8').replace(/\r?\n$/, '')
    if (text.trim()) return text
  }
  console.error('set TRIPS_PASSPHRASE or TRIPS_PASSPHRASE_FILE (the file holds the passphrase on one line)')
  process.exit(2)
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

export async function deriveKey(passphrase: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: KDF_ITERATIONS },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  )
}

export async function encrypt(plain: string, passphrase: string): Promise<{ salt: string; iv: string; data: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, ['encrypt'])
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(plain))
  return { salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(ct)) }
}

export async function decrypt(payload: { salt: string; iv: string; data: string }, passphrase: string): Promise<string> {
  const salt = new Uint8Array(Buffer.from(payload.salt, 'base64'))
  const iv = new Uint8Array(Buffer.from(payload.iv, 'base64'))
  const data = new Uint8Array(Buffer.from(payload.data, 'base64'))
  const key = await deriveKey(passphrase, salt, ['decrypt'])
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource)
  return new TextDecoder().decode(pt)
}

// Appended to the decrypted page so a remembered phone can forget the passphrase.
export function forgetFooter(slug: string): string {
  return `<div id="trips-forget" style="font:13px -apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#86868b;text-align:center;padding:0 20px 44px;background:#f5f5f7;">` +
    `<a href="#" style="color:#6e6e73;" onclick="try{localStorage.removeItem('trips:pass:${slug}')}catch(e){};this.textContent='Forgotten. The passphrase will be asked next time.';this.onclick=function(){return false};return false;">Forget the passphrase on this phone</a></div>`
}

export function template(opts: { title: string; slug: string; payload: { salt: string; iv: string; data: string } }): string {
  const { title, slug, payload } = opts
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#f5f5f7">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<title>${esc(title)}</title>
<style>
  :root { --ink:#1d1d1f; --ink-2:#6e6e73; --ink-3:#86868b; --blue:#0071e3; --blue-2:#0066cc; --fog:#f5f5f7; --hair:rgba(0,0,0,.09); }
  * { box-sizing:border-box; }
  html,body { height:100%; }
  body { margin:0; background:var(--fog); color:var(--ink); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif; font-size:17px; line-height:1.47; letter-spacing:-0.022em; -webkit-font-smoothing:antialiased; }
  main { min-height:100%; display:flex; align-items:center; justify-content:center; padding:32px 20px; }
  .card { width:min(100%,440px); background:#fff; border-radius:22px; padding:36px 32px 28px; }
  .eyebrow { font-size:15px; font-weight:600; color:var(--ink-2); margin:0 0 6px; }
  h1 { margin:0; font-size:32px; line-height:1.08; letter-spacing:-0.03em; font-weight:600; }
  p.lead { margin:12px 0 0; color:var(--ink-2); font-size:16px; }
  form { margin-top:24px; }
  label.f { display:block; font-size:13px; font-weight:600; color:var(--ink-2); margin-bottom:6px; }
  input[type=password] { width:100%; font:inherit; font-size:17px; padding:12px 14px; border:1px solid var(--hair); border-radius:12px; background:#fff; color:var(--ink); outline:none; -webkit-appearance:none; }
  input[type=password]:focus { border-color:var(--blue); box-shadow:0 0 0 3px rgba(0,113,227,.18); }
  .row { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:14px; flex-wrap:wrap; }
  label.r { display:flex; align-items:center; gap:10px; font-size:15px; color:var(--ink-2); cursor:pointer; -webkit-tap-highlight-color:transparent; }
  label.r input { position:absolute; opacity:0; width:0; height:0; }
  label.r .box { width:22px; height:22px; border-radius:50%; border:1.5px solid rgba(0,0,0,.28); position:relative; flex:0 0 auto; }
  label.r .box::after { content:""; position:absolute; inset:0; background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M6 12.5l4 4 8-9'/></svg>") center/13px no-repeat; opacity:0; }
  label.r input:checked + .box { background:var(--blue); border-color:var(--blue); }
  label.r input:checked + .box::after { opacity:1; }
  button { font:inherit; font-size:17px; min-height:44px; padding:8px 22px; border:0; border-radius:980px; background:var(--blue); color:#fff; cursor:pointer; width:100%; margin-top:18px; }
  button:hover { background:var(--blue-2); }
  button[disabled] { opacity:.55; cursor:default; }
  .err { min-height:22px; margin-top:12px; font-size:15px; color:#e0392f; }
  .foot { margin-top:22px; font-size:12px; color:var(--ink-3); }
  .foot a { color:var(--ink-2); }
</style>
</head>
<body>
<main>
  <div class="card">
    <p class="eyebrow">Trips</p>
    <h1>${esc(title)}</h1>
    <p class="lead">This page is for the people on the trip. Enter the passphrase to open it.</p>
    <form id="f" autocomplete="off">
      <label class="f" for="p">Passphrase</label>
      <input id="p" type="password" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="current-password" required>
      <div class="row">
        <label class="r"><input id="r" type="checkbox"><span class="box"></span><span>Remember on this phone</span></label>
      </div>
      <button id="b" type="submit">Unlock</button>
      <div class="err" id="e" role="alert"></div>
    </form>
    <p class="foot">Unlocks on this device only. Nothing is sent anywhere. <a href="../">All trips</a></p>
  </div>
</main>
<script id="payload" type="application/json">${JSON.stringify(payload)}</script>
<script>
(function () {
  var KEY = 'trips:pass:${slug}';
  var ITER = ${KDF_ITERATIONS};
  var payload = JSON.parse(document.getElementById('payload').textContent);
  var f = document.getElementById('f'), p = document.getElementById('p'), r = document.getElementById('r'), b = document.getElementById('b'), e = document.getElementById('e');
  var FOOTER = ${JSON.stringify(forgetFooter(slug))};
  function bytes(s) { var bin = atob(s), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  function open(pass) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(payload.salt), iterations: ITER }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    }).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(payload.iv) }, key, bytes(payload.data));
    }).then(function (pt) {
      var html = new TextDecoder().decode(pt);
      var i = html.lastIndexOf('</body>');
      if (i > 0) html = html.slice(0, i) + FOOTER + html.slice(i);
      document.open(); document.write(html); document.close();
    });
  }
  function fail(msg) { e.textContent = msg; b.disabled = false; b.textContent = 'Unlock'; p.focus(); p.select(); }
  f.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var pass = p.value;
    if (!pass) return;
    b.disabled = true; b.textContent = 'Unlocking'; e.textContent = '';
    open(pass).then(function () {
      if (r.checked) { try { localStorage.setItem(KEY, pass); } catch (x) {} }
    }, function () { fail('That passphrase did not open the page. Try again.'); });
  });
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (x) {}
  if (!crypto || !crypto.subtle) { fail('This browser cannot open the page. Use Safari or Chrome.'); b.disabled = true; }
  else if (saved) { b.disabled = true; b.textContent = 'Unlocking'; open(saved).catch(function () { try { localStorage.removeItem(KEY); } catch (x) {} fail(''); }); }
  else { p.focus(); }
})();
</script>
</body>
</html>
`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const passphrase = readPassphrase()
  if (passphrase.length < 8) {
    console.error('passphrase must be at least 8 characters')
    process.exit(2)
  }
  const plain = readFileSync(args.in, 'utf8')
  const payload = await encrypt(plain, passphrase)
  // Verify the round trip before writing anything.
  const check = await decrypt(payload, passphrase)
  if (check !== plain) throw new Error('round-trip verification failed')
  const html = template({ title: args.title, slug: args.slug, payload })
  mkdirSync(dirname(args.out), { recursive: true })
  writeFileSync(args.out, html)
  console.log(`sealed ${args.in} (${(plain.length / 1024).toFixed(0)} KB) -> ${args.out} (${(html.length / 1024).toFixed(0)} KB), slug ${args.slug}`)
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
