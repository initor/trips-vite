import { describe, expect, test } from 'bun:test'
import { decrypt, encrypt, forgetFooter, template } from './seal.ts'

const PASS = 'correct horse battery staple'
const PAGE = '<!doctype html><html><head><title>t</title></head><body><p>hello wall e</p></body></html>'

describe('seal', () => {
  test('round trip', async () => {
    const payload = await encrypt(PAGE, PASS)
    expect(await decrypt(payload, PASS)).toBe(PAGE)
  })

  test('wrong passphrase fails', async () => {
    const payload = await encrypt(PAGE, PASS)
    await expect(decrypt(payload, 'wrong horse')).rejects.toBeDefined()
  })

  test('fresh salt and iv every seal', async () => {
    const a = await encrypt(PAGE, PASS)
    const b = await encrypt(PAGE, PASS)
    expect(a.salt).not.toBe(b.salt)
    expect(a.iv).not.toBe(b.iv)
    expect(a.data).not.toBe(b.data)
  })

  test('template embeds payload, title, slug and never the plaintext', async () => {
    const payload = await encrypt(PAGE, PASS)
    const html = template({ title: 'Napa, with Wall E', slug: 'napa-2026', payload })
    expect(html).toContain('<title>Napa, with Wall E</title>')
    expect(html).toContain("trips:pass:napa-2026")
    expect(html).toContain(payload.data)
    expect(html).toContain('noindex')
    expect(html).not.toContain('hello wall e')
    expect(forgetFooter('napa-2026')).toContain("trips:pass:napa-2026")
  })
})
