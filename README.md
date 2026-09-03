# trips-vite

Itineraries at [trips.waynewen.com](https://trips.waynewen.com). One static page per trip, each sealed behind a passphrase.

## Shape

```
index.html + src/          hub: the list of trips (Vite + TypeScript + Tailwind v4)
public/<slug>/index.html   sealed trip page: unlock screen + AES-GCM ciphertext
scripts/seal.ts            plaintext page -> sealed page
```

Trip pages sit in `public/` so Vite copies them verbatim. The hub is the only thing Vite builds. Vercel deploys `main` on push; there is no CI.

## Sealing a trip

The plaintext page lives in the trip's own planning repo and never enters this one (`*.plain.html` and `/plain/` are ignored). The passphrase is read from `TRIPS_PASSPHRASE` or from the one-line file named by `TRIPS_PASSPHRASE_FILE` and is never written by the script.

```bash
TRIPS_PASSPHRASE_FILE=~/.config/trips/passphrase bun run seal -- \
  --in  ../vacay/napa-with-wally-2026/napa-timeline-2026-09-01.html \
  --out public/napa-2026/index.html \
  --title "Napa, with Wall E"
git commit -am "napa-2026: update" && git push   # Vercel deploys
```

Key: PBKDF2-SHA256, 600k iterations, fresh 16-byte salt. Cipher: AES-256-GCM, fresh 12-byte IV. The browser decrypts with WebCrypto and replaces the document. "Remember on this phone" stores the passphrase in that browser's localStorage only; the decrypted page carries a "Forget" link that clears it.

## Adding a trip

1. Seal the page into `public/<slug>/index.html`.
2. Add a card to `trips` in `src/main.ts`.
3. `bun run build` must pass. Push.

## Develop

```bash
bun install
bun run dev
bun run build        # tsc + vite build: must pass before commit
bun run lint
bun test scripts
```

Stack: Vite + TypeScript · Tailwind CSS v4 · Bun · Vercel. Robots are disallowed and every page carries `noindex`.
