// ── Constantes ───────────────────────────────────────────────────────────────
export const MAX = 40;
export const GROUP_DELAY = 1500;

// ── Données des capos ────────────────────────────────────────────────────────
export const LTS = [
  { id: 'ricciardo',  name: 'Antonio Ricciardo', role: 'Le Sage' },
  { id: 'russo',      name: 'Carmela Russo',      role: 'La Faussaire' },
  { id: 'caruso',     name: 'Domenico Caruso',    role: 'Le Molosse' },
  { id: 'emancini',   name: 'Elena Mancini',      role: 'La Tigresse' },
  { id: 'romano',     name: 'Enzo Romano',        role: 'Le Joueur' },
  { id: 'fdeluca',    name: 'Francesca De Luca',  role: 'La Diplomate' },
  { id: 'ghost',      name: 'Ghost',              role: "L'Ombre" },
  { id: 'gvendetta',  name: 'Giulia Vendetta',    role: "L'Œil du Faucon" },
  { id: 'imoretti',   name: 'Isabella Moretti',   role: 'La Vipère' },
  { id: 'lvitale',    name: 'Lorenzo Vitale',     role: 'Le Marteau' },
  { id: 'belladonna', name: 'Rosa Belladonna',    role: 'La Sirène' },
  { id: 'smancini',   name: 'Salvatore Mancini',  role: 'Le Loup' },
];

// ── Helpers de création d'état ────────────────────────────────────────────────

/** Crée un joueur avec les valeurs par défaut. */
export function createPlayer({ id, name, role, playerName = '' } = {}) {
  return { id, name, role, playerName, inf: MAX, eliminated: false };
}

/** Crée l'état initial d'une partie à partir d'une liste de capos sélectionnés. */
export function createGameState(selectedIds, playerNames = []) {
  const players = selectedIds.map((id, i) => {
    const lt = LTS.find(l => l.id === id);
    return createPlayer({ ...lt, playerName: playerNames[i] ?? '' });
  });
  return {
    players,
    seatOrder: players.map((_, i) => i),
    undoStack: [],
    history: [],
    groupTimers: {},
    actionCounter: 0,
  };
}

// ── Layout ────────────────────────────────────────────────────────────────────

/**
 * Retourne la description du layout pour n joueurs.
 * Chaque entrée dans cols/bottom contient { idx, rot }.
 */
export function getLayout(n, seatOrder) {
  switch (n) {
    case 3: return {
      cols: [
        { cards: [{ idx: seatOrder[1], rot: 'rot-l' }] },
        { cards: [{ idx: seatOrder[2], rot: 'rot-r' }] },
      ],
      bottom: [{ idx: seatOrder[0], rot: 'rot-0' }],
    };
    case 4: return {
      cols: [
        { cards: [{ idx: seatOrder[1], rot: 'rot-l' }, { idx: seatOrder[0], rot: 'rot-l' }] },
        { cards: [{ idx: seatOrder[2], rot: 'rot-r' }, { idx: seatOrder[3], rot: 'rot-r' }] },
      ],
      bottom: [],
    };
    case 5: return {
      cols: [
        { cards: [{ idx: seatOrder[2], rot: 'rot-l' }, { idx: seatOrder[1], rot: 'rot-l' }] },
        { cards: [{ idx: seatOrder[3], rot: 'rot-r' }, { idx: seatOrder[4], rot: 'rot-r' }] },
      ],
      bottom: [{ idx: seatOrder[0], rot: 'rot-0' }],
    };
    case 6: return {
      cols: [
        { cards: [{ idx: seatOrder[2], rot: 'rot-l' }, { idx: seatOrder[1], rot: 'rot-l' }, { idx: seatOrder[0], rot: 'rot-l' }] },
        { cards: [{ idx: seatOrder[3], rot: 'rot-r' }, { idx: seatOrder[4], rot: 'rot-r' }, { idx: seatOrder[5], rot: 'rot-r' }] },
      ],
      bottom: [],
    };
    default: {
      const cards = seatOrder.map(idx => ({ idx, rot: 'rot-0' }));
      return { cols: [{ cards }], bottom: [] };
    }
  }
}

// ── Rotation ──────────────────────────────────────────────────────────────────

/** Décale d'un cran : le dernier siège devient le premier. Modifie seatOrder en place. */
export function rotateSeatOrder(seatOrder) {
  if (seatOrder.length < 2) return seatOrder;
  const last = seatOrder[seatOrder.length - 1];
  return [last, ...seatOrder.slice(0, -1)];
}

// ── Score ─────────────────────────────────────────────────────────────────────

/**
 * Applique un delta d'influence au joueur d'indice i.
 * Retourne { newInf, realDelta, eliminated } sans muter les données.
 */
export function applyDelta(player, delta) {
  const newInf = Math.min(MAX, Math.max(0, player.inf + delta));
  const realDelta = newInf - player.inf;
  const eliminated = newInf <= 0 && !player.eliminated;
  return { newInf, realDelta, eliminated };
}

/** Retourne la classe CSS de score selon le niveau d'influence. */
export function scoreClass(inf, isEliminated = false) {
  if (inf <= 8) return isEliminated ? 'crit' : 'crit crit-blink';
  if (inf <= 15) return 'low';
  return '';
}

// ── Vainqueur ─────────────────────────────────────────────────────────────────

/**
 * Retourne le joueur gagnant si exactement 1 joueur est encore en vie,
 * sinon null.
 */
export function getWinner(players) {
  const alive = players.filter(p => !p.eliminated);
  return alive.length === 1 ? alive[0] : null;
}

// ── Undo ──────────────────────────────────────────────────────────────────────

const UNDO_LIMIT = 30;

/**
 * Pousse un snapshot de l'état courant dans la pile d'undo.
 * Retourne la nouvelle pile (sans muter l'originale).
 */
export function pushUndo(undoStack, state) {
  const snap = JSON.stringify(state);
  const next = [...undoStack, snap];
  return next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next;
}

/**
 * Dépile et restaure le dernier snapshot.
 * Retourne { state, undoStack } ou null si la pile est vide.
 */
export function popUndo(undoStack) {
  if (!undoStack.length) return null;
  const snap = undoStack[undoStack.length - 1];
  return {
    state: JSON.parse(snap),
    undoStack: undoStack.slice(0, -1),
  };
}

// ── Historique ────────────────────────────────────────────────────────────────

/**
 * Enregistre un delta dans l'historique groupé.
 * Si un groupe ouvert existe pour ce joueur, il est réutilisé ;
 * sinon un nouveau groupe est créé et actionCounter est incrémenté.
 *
 * Retourne { history, actionCounter } (nouvelles valeurs).
 * Ne gère PAS les timers (responsabilité de la couche UI).
 */
export function logGrouped(history, actionCounter, playerIdx, delta, displayName, role) {
  const existingIdx = history.findIndex(h => h.playerIdx === playerIdx && h.open);
  if (existingIdx !== -1) {
    const updated = history.map((h, i) =>
      i === existingIdx
        ? { ...h, entries: [...h.entries, { delta, ts: Date.now() }] }
        : h
    );
    return { history: updated, actionCounter };
  }
  const newCounter = actionCounter + 1;
  const group = {
    playerIdx,
    who: displayName,
    role,
    entries: [{ delta, ts: Date.now() }],
    open: true,
    rank: newCounter,
  };
  return { history: [group, ...history], actionCounter: newCounter };
}

/** Retourne la somme des deltas d'un groupe d'historique. */
export function groupSum(group) {
  return group.entries.reduce((s, e) => s + e.delta, 0);
}

// ── Pavé numérique (score modal) ──────────────────────────────────────────────

/**
 * Traite une touche du pavé numérique.
 * Retourne la nouvelle valeur (chaîne).
 */
export function pressKey(current, key) {
  if (key === '⌫') {
    return current.length > 1 ? current.slice(0, -1) : '0';
  }
  if (key === '00') {
    return current === '0' ? '0' : current + '00';
  }
  const next = current === '0' ? String(key) : current + key;
  return next.length > 3 ? next.slice(0, 3) : next;
}

/**
 * Applique la valeur saisie dans le modal de score.
 * Retourne { newInf, realDelta, eliminated } ou null si v === 0.
 */
export function confirmModal(player, rawValue, sign) {
  const v = parseInt(rawValue) || 0;
  if (v === 0) return null;
  return applyDelta(player, sign * v);
}

// ── Profils joueurs ───────────────────────────────────────────────────────────

/** Ajoute des noms à la liste de profils (max 30, sans doublon). */
export function mergeProfiles(existing, newNames) {
  const filtered = newNames.filter(Boolean);
  let result = [...existing];
  filtered.forEach(n => { if (!result.includes(n)) result.push(n); });
  if (result.length > 30) result = result.slice(-30);
  return result;
}

/** Supprime un profil par son nom exact. */
export function deleteProfileFromList(profiles, name) {
  return profiles.filter(p => p !== name);
}

// ── Mélange (Fisher-Yates) ────────────────────────────────────────────────────

/**
 * Retourne un nouveau tableau mélangé aléatoirement.
 * N'affecte pas le tableau d'origine.
 */
export function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Persistance ───────────────────────────────────────────────────────────────

export const SAVE_KEY     = 'ldm_save';
export const PROFILES_KEY = 'ldm_profiles';

/** Sérialise l'état de jeu pour localStorage. */
export function serializeGame(state) {
  return JSON.stringify({
    players:       state.players,
    seatOrder:     state.seatOrder,
    history:       state.history,
    actionCounter: state.actionCounter,
    ts:            Date.now(),
  });
}

/**
 * Désérialise un état depuis localStorage.
 * Retourne null si la chaîne est absente ou invalide.
 */
export function deserializeGame(raw) {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.players) || !Array.isArray(s.seatOrder)) return null;
    return {
      players:       s.players,
      seatOrder:     s.seatOrder,
      history:       s.history ?? [],
      actionCounter: s.actionCounter ?? 0,
    };
  } catch {
    return null;
  }
}
