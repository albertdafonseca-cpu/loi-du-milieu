// Logique pure du service worker, découplée de l'API `self` pour être testable.

export const STATIC_ASSETS = ['./', './index.html', './manifest.json', './favicon.png'];
export const FONT_HOSTS    = ['fonts.googleapis.com', 'fonts.gstatic.com'];

/** Retourne true si l'URL appartient à un hôte de polices Google. */
export function isFontRequest(url) {
  return FONT_HOSTS.includes(new URL(url).hostname);
}

/**
 * Sélectionne les clés de cache obsolètes à supprimer lors de l'activation.
 * Garde cacheVersion et fontsCache, supprime tout le reste.
 */
export function staleCacheKeys(allKeys, cacheVersion, fontsCache) {
  return allKeys.filter(k => k !== cacheVersion && k !== fontsCache);
}
