import './index.css'

type Trip = {
  slug: string
  title: string
  dates: string
  where: string
  locked: boolean
}

// One entry per sealed page under public/<slug>/index.html.
const trips: Trip[] = [
  {
    slug: 'napa-2026',
    title: 'Napa, with Wall E',
    dates: 'September 5 to 6, 2026',
    where: 'Palo Alto to Benicia, Yountville, Larkspur, Fort Baker',
    locked: true,
  },
]

const list = document.getElementById('trips')
if (list) {
  list.innerHTML = trips
    .map(
      (t) => `
      <a href="/${t.slug}/" class="group block rounded-[22px] bg-white p-7 transition hover:bg-white/70 sm:p-8">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-[24px] font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">${t.title}</h2>
            <p class="mt-1 text-[15px] text-ink-2">${t.dates}</p>
            <p class="mt-3 max-w-[40ch] text-[15px] leading-snug text-ink-3">${t.where}</p>
          </div>
          ${t.locked ? '<span class="shrink-0 rounded-md bg-black/[.06] px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-ink-2">Passphrase</span>' : ''}
        </div>
        <p class="mt-6 text-[15px] text-blue">Open<span class="ml-1 inline-block transition group-hover:translate-x-0.5">&rsaquo;</span></p>
      </a>`,
    )
    .join('')
}
