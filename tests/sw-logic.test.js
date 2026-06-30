import { describe, it, expect } from 'vitest';
import { isFontRequest, staleCacheKeys, FONT_HOSTS, STATIC_ASSETS } from '../src/sw-logic.js';

// ── isFontRequest ─────────────────────────────────────────────────────────────
describe('isFontRequest', () => {
  it.each(FONT_HOSTS)('reconnaît %s comme hôte de polices', host => {
    expect(isFontRequest(`https://${host}/css2?family=Cinzel`)).toBe(true);
  });

  it('retourne false pour une URL applicative', () => {
    expect(isFontRequest('https://example.com/index.html')).toBe(false);
    expect(isFontRequest('https://cdn.jsdelivr.net/some-lib.js')).toBe(false);
  });

  it('retourne false pour localhost', () => {
    expect(isFontRequest('http://localhost:3000/manifest.json')).toBe(false);
  });
});

// ── staleCacheKeys ────────────────────────────────────────────────────────────
describe('staleCacheKeys', () => {
  const V       = 'ldm-v4';
  const FONTS   = 'ldm-fonts-v1';

  it('conserve la version courante et les polices', () => {
    const keys = [V, FONTS];
    expect(staleCacheKeys(keys, V, FONTS)).toEqual([]);
  });

  it('supprime les anciennes versions', () => {
    const keys = ['ldm-v1', 'ldm-v2', 'ldm-v3', V, FONTS];
    expect(staleCacheKeys(keys, V, FONTS)).toEqual(['ldm-v1', 'ldm-v2', 'ldm-v3']);
  });

  it('retourne un tableau vide si rien à purger', () => {
    expect(staleCacheKeys([V, FONTS], V, FONTS)).toEqual([]);
  });

  it('retourne toutes les clés si aucune ne correspond', () => {
    const keys = ['ldm-v1', 'ldm-v2'];
    expect(staleCacheKeys(keys, V, FONTS)).toEqual(keys);
  });
});

// ── STATIC_ASSETS ─────────────────────────────────────────────────────────────
describe('STATIC_ASSETS', () => {
  it('inclut index.html', () => {
    expect(STATIC_ASSETS).toContain('./index.html');
  });

  it('inclut manifest.json', () => {
    expect(STATIC_ASSETS).toContain('./manifest.json');
  });

  it('inclut favicon.png', () => {
    expect(STATIC_ASSETS).toContain('./favicon.png');
  });
});
