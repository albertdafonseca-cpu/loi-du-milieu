// Tests E2E — Flux de jeu complet
import { test, expect } from '@playwright/test';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function selectPlayers(page, count = 2) {
  for (let i = 0; i < count; i++) {
    await page.locator('.lt-pick').nth(i).click();
  }
  await page.locator('#go-btn').click();
  await page.waitForSelector('#names-screen', { state: 'visible' });
}

async function startGameWithNames(page, names = ['Alice', 'Bob']) {
  await selectPlayers(page, names.length);
  const inputs = page.locator('.name-input');
  for (let i = 0; i < names.length; i++) {
    await inputs.nth(i).fill(names[i]);
  }
  await page.locator('.names-go-btn').click();
  await page.waitForSelector('#game', { state: 'visible' });
}

// Sélecteurs de la barre d'action — on utilise l'attribut onclick (ASCII pur)
// pour éviter tout problème d'encodage avec les caractères accentués/emoji.
const BAR_SELECTORS = {
  'Rotation': '#bar [onclick*="rotatePlayers"]',
  'Récap':    '#bar [onclick*="showRecap"]',
  'Règles':   '#bar [onclick*="showRules"]',
  'Reset':    '#bar .bar-btn.danger',
};
function barBtn(page, label) {
  return page.locator(BAR_SELECTORS[label]);
}

// ── Écran Noms ────────────────────────────────────────────────────────────────
test.describe('Écran des noms', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.lt-pick');
    await selectPlayers(page, 3);
  });

  test('affiche autant de champs que de capos sélectionnés', async ({ page }) => {
    await expect(page.locator('.name-input')).toHaveCount(3);
  });

  test('le bouton Retour ramène à la sélection', async ({ page }) => {
    await page.locator('.names-back-btn').click();
    await expect(page.locator('#setup')).toBeVisible();
    await expect(page.locator('#names-screen')).not.toBeVisible();
  });

  test('peut démarrer sans saisir de noms', async ({ page }) => {
    await page.locator('.names-go-btn').click();
    await expect(page.locator('#game')).toBeVisible();
  });
});

// ── Partie à 2 joueurs ────────────────────────────────────────────────────────
test.describe('Partie à 2 joueurs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.lt-pick');
    await startGameWithNames(page, ['Alice', 'Bob']);
  });

  test('les 2 cartes joueurs sont rendues', async ({ page }) => {
    await expect(page.locator('.pcard')).toHaveCount(2);
  });

  test('chaque carte affiche l\'influence initiale (40)', async ({ page }) => {
    const scores = page.locator('.score');
    for (const score of await scores.all()) {
      await expect(score).toHaveText('40');
    }
  });

  test('chaque carte affiche les surnoms des deux joueurs', async ({ page }) => {
    // En layout 2 joueurs : seatOrder[1] (Bob) en haut (rot-180), seatOrder[0] (Alice) en bas (rot-0)
    const names = await page.locator('.pplayer').allTextContents();
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  test('clic côté gauche de la carte rot-0 décrémente le score', async ({ page }) => {
    // En layout 2 joueurs : rot-0 = carte du bas (#card-0)
    // On attend que la carte soit visible (renderGame remet visibility après rAF)
    const card = page.locator('#card-0');
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    // Côté gauche (< 50% largeur) → −1 en rot-0
    await page.mouse.click(box.x + box.width * 0.20, box.y + box.height / 2);
    await expect(card.locator('.score')).not.toHaveText('40');
    const val = parseInt(await card.locator('.score').textContent());
    expect(val).toBe(39);
  });

  test('clic côté droit de la carte rot-0 incrémente le score', async ({ page }) => {
    const card = page.locator('#card-0'); // rot-0, en bas
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    // D'abord décrémenter pour sortir du plafond MAX
    await page.mouse.click(box.x + box.width * 0.20, box.y + box.height / 2);
    await expect(card.locator('.score')).not.toHaveText('40');
    // Puis incrémenter (côté droit > 50%)
    await page.mouse.click(box.x + box.width * 0.80, box.y + box.height / 2);
    await expect(card.locator('.score')).toHaveText('40');
  });

  test('la barre d\'action est visible pendant la partie', async ({ page }) => {
    await expect(page.locator('#bar')).toBeVisible();
  });
});

// ── Undo ──────────────────────────────────────────────────────────────────────
test.describe('Undo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.lt-pick');
    await startGameWithNames(page, ['Alice', 'Bob']);
  });

  test('le bouton undo est désactivé sans action', async ({ page }) => {
    await expect(page.locator('#undo-btn')).toBeDisabled();
  });

  test('undo restaure le score après un décrément', async ({ page }) => {
    const card = page.locator('#card-0'); // rot-0
    await expect(card).toBeVisible();
    const box  = await card.boundingBox();
    await page.mouse.click(box.x + box.width * 0.20, box.y + box.height / 2);
    await expect(card.locator('.score')).not.toHaveText('40');
    await page.locator('#undo-btn').click();
    await expect(card.locator('.score')).toHaveText('40');
  });

  test('le bouton undo se désactive de nouveau après undo complet', async ({ page }) => {
    const card = page.locator('#card-0');
    await expect(card).toBeVisible();
    const box  = await card.boundingBox();
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
    await page.locator('#undo-btn').click();
    await expect(page.locator('#undo-btn')).toBeDisabled();
  });
});

// ── Thème jour / nuit ─────────────────────────────────────────────────────────
// Le bouton de thème (#theme-btn) est à l'intérieur de #setup et devient
// inaccessible pendant la partie. Les tests de thème se font donc depuis
// l'écran de configuration.
test.describe('Bascule de thème (depuis le setup)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#theme-btn');
  });

  test('active la classe day-mode sur le body', async ({ page }) => {
    await page.locator('#theme-btn').click();
    await expect(page.locator('body')).toHaveClass(/day-mode/);
  });

  test('second clic repasse en mode nuit', async ({ page }) => {
    await page.locator('#theme-btn').click();
    await page.locator('#theme-btn').click();
    await expect(page.locator('body')).not.toHaveClass(/day-mode/);
  });

  test('le thème persiste au démarrage de la partie', async ({ page }) => {
    await page.locator('#theme-btn').click();
    await expect(page.locator('body')).toHaveClass(/day-mode/);
    // Démarrer une partie
    await page.locator('.lt-pick').nth(0).click();
    await page.locator('.lt-pick').nth(1).click();
    await page.locator('#go-btn').click();
    await page.locator('.names-go-btn').click();
    await page.waitForSelector('#game', { state: 'visible' });
    // Le thème est toujours actif pendant la partie
    await expect(page.locator('body')).toHaveClass(/day-mode/);
  });
});

// ── Règles ────────────────────────────────────────────────────────────────────
test.describe('Panneau des règles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.lt-pick');
    await startGameWithNames(page, ['Alice', 'Bob']);
  });

  test('s\'ouvre depuis la barre', async ({ page }) => {
    await barBtn(page, 'Règles').click();
    await expect(page.locator('#rules')).toBeVisible();
  });

  test('se ferme avec le bouton close', async ({ page }) => {
    await barBtn(page, 'Règles').click();
    await page.locator('.rules-close').click();
    await expect(page.locator('#rules')).not.toBeVisible();
  });
});

// ── Récapitulatif ─────────────────────────────────────────────────────────────
test.describe('Récapitulatif', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.lt-pick');
    await startGameWithNames(page, ['Alice', 'Bob']);
  });

  test('s\'ouvre depuis la barre', async ({ page }) => {
    await barBtn(page, 'Récap').click();
    await expect(page.locator('#recap')).toBeVisible();
  });

  test('se ferme avec le bouton close', async ({ page }) => {
    await barBtn(page, 'Récap').click();
    await page.locator('#recap-close-btn').click();
    await expect(page.locator('#recap')).not.toBeVisible();
  });

  test('affiche un message si aucune action n\'a eu lieu', async ({ page }) => {
    await barBtn(page, 'Récap').click();
    await expect(page.locator('#recap-body')).toContainText('Aucune action');
  });
});

// ── Réinitialisation ──────────────────────────────────────────────────────────
test.describe('Réinitialisation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.lt-pick');
    await startGameWithNames(page, ['Alice', 'Bob']);
  });

  test('ouvre la modale de confirmation', async ({ page }) => {
    await barBtn(page, 'Reset').click();
    await expect(page.locator('#reset-modal')).toBeVisible();
  });

  test('annuler ferme la modale sans quitter la partie', async ({ page }) => {
    await barBtn(page, 'Reset').click();
    await page.locator('#reset-modal .modal-btn.secondary').click();
    await expect(page.locator('#game')).toBeVisible();
    await expect(page.locator('#reset-modal')).not.toBeVisible();
  });

  test('confirmer ramène à l\'écran de setup', async ({ page }) => {
    await barBtn(page, 'Reset').click();
    await page.locator('#reset-modal .modal-btn.primary').click();
    await expect(page.locator('#setup')).toBeVisible();
    await expect(page.locator('#game')).not.toBeVisible();
  });
});

// ── Rotation des sièges ───────────────────────────────────────────────────────
test.describe('Rotation des sièges', () => {
  test('le bouton de rotation est présent', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.lt-pick');
    await startGameWithNames(page, ['Alice', 'Bob']);
    await expect(barBtn(page, 'Rotation')).toBeVisible();
  });

  test('la rotation ne plante pas la partie', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.lt-pick');
    await startGameWithNames(page, ['Alice', 'Bob', 'Carol']);
    await barBtn(page, 'Rotation').click();
    await expect(page.locator('.pcard')).toHaveCount(3);
  });
});
