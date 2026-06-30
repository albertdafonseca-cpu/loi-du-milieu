// Tests E2E — Écran de configuration (sélection des capos)
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Attendre que le splash soit parti et les capos rendus
  await page.waitForSelector('.lt-pick');
});

test('affiche 12 capos disponibles', async ({ page }) => {
  const picks = page.locator('.lt-pick');
  await expect(picks).toHaveCount(12);
});

test('le bouton Démarrer est désactivé initialement', async ({ page }) => {
  await expect(page.locator('#go-btn')).toBeDisabled();
});

test('sélectionner un capo active son état visuel', async ({ page }) => {
  const pick = page.locator('.lt-pick').first();
  await pick.click();
  await expect(pick).toHaveClass(/\bon\b/);
});

test('sélectionner 2 capos active le bouton Démarrer', async ({ page }) => {
  await page.locator('.lt-pick').nth(0).click();
  await page.locator('.lt-pick').nth(1).click();
  const btn = page.locator('#go-btn');
  await expect(btn).not.toBeDisabled();
  await expect(btn).toContainText('2 joueurs');
});

test('impossible de sélectionner plus de 6 capos', async ({ page }) => {
  for (let i = 0; i < 7; i++) {
    await page.locator('.lt-pick').nth(i).click();
  }
  const selected = page.locator('.lt-pick.on');
  await expect(selected).toHaveCount(6);
});

test('déselectionner un capo enlève la classe "on"', async ({ page }) => {
  const pick = page.locator('.lt-pick').first();
  await pick.click();
  await expect(pick).toHaveClass(/\bon\b/);
  await pick.click();
  await expect(pick).not.toHaveClass(/\bon\b/);
});

test('le bouton affiche le bon compte de joueurs', async ({ page }) => {
  for (let i = 0; i < 4; i++) {
    await page.locator('.lt-pick').nth(i).click();
  }
  await expect(page.locator('#go-btn')).toContainText('4 joueurs');
});
