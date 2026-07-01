import { describe, it, expect } from 'vitest';
import {
  MAX, LTS,
  createPlayer, createGameState,
  getLayout, rotateSeatOrder,
  applyDelta, scoreClass,
  getWinner,
  pushUndo, popUndo,
  logGrouped, groupSum,
  pressKey, confirmModal,
  mergeProfiles, deleteProfileFromList,
  shuffle,
  serializeGame, deserializeGame,
} from '../src/game-logic.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makePlayers(count, overrides = []) {
  return LTS.slice(0, count).map((lt, i) => ({
    ...createPlayer(lt),
    ...overrides[i],
  }));
}

// ── createGameState ───────────────────────────────────────────────────────────
describe('createGameState', () => {
  it('crée autant de joueurs que d\'IDs fournis', () => {
    const state = createGameState(['ricciardo', 'russo', 'caruso']);
    expect(state.players).toHaveLength(3);
  });

  it('initialise chaque joueur à MAX influence', () => {
    const state = createGameState(['ricciardo', 'russo']);
    state.players.forEach(p => expect(p.inf).toBe(MAX));
  });

  it('seatOrder est [0, 1, ..., n-1]', () => {
    const state = createGameState(['ricciardo', 'russo', 'caruso', 'emancini']);
    expect(state.seatOrder).toEqual([0, 1, 2, 3]);
  });

  it('affecte le playerName depuis le tableau fourni', () => {
    const state = createGameState(['ricciardo', 'russo'], ['Alice', 'Bob']);
    expect(state.players[0].playerName).toBe('Alice');
    expect(state.players[1].playerName).toBe('Bob');
  });

  it('playerName vide par défaut si non fourni', () => {
    const state = createGameState(['ricciardo']);
    expect(state.players[0].playerName).toBe('');
  });
});

// ── getLayout ─────────────────────────────────────────────────────────────────
describe('getLayout', () => {
  const order = [0, 1, 2, 3, 4, 5];

  it('layout 2 joueurs : géré en dehors (cas spécial)', () => {
    // getLayout n'est pas appelé pour n=2 dans le code original
    // Le fallback produit une colonne unique
    const layout = getLayout(2, [0, 1]);
    expect(layout.cols).toHaveLength(1);
    expect(layout.bottom).toHaveLength(0);
  });

  it('layout 3 joueurs : 2 cols + 1 bottom', () => {
    const layout = getLayout(3, order);
    expect(layout.cols).toHaveLength(2);
    expect(layout.bottom).toHaveLength(1);
    expect(layout.bottom[0].idx).toBe(0); // siège 0 en bas
  });

  it('layout 4 joueurs : 2 cols, pas de bottom', () => {
    const layout = getLayout(4, order);
    expect(layout.cols).toHaveLength(2);
    expect(layout.bottom).toHaveLength(0);
    const allCards = layout.cols.flatMap(c => c.cards);
    expect(allCards).toHaveLength(4);
  });

  it('layout 5 joueurs : 2 cols + 1 bottom', () => {
    const layout = getLayout(5, order);
    const allCards = layout.cols.flatMap(c => c.cards);
    expect(allCards).toHaveLength(4);
    expect(layout.bottom).toHaveLength(1);
  });

  it('layout 6 joueurs : 2 cols de 3, pas de bottom', () => {
    const layout = getLayout(6, order);
    layout.cols.forEach(col => expect(col.cards).toHaveLength(3));
    expect(layout.bottom).toHaveLength(0);
  });

  it('layout 3 joueurs : rotations correctes (lateraux)', () => {
    const layout = getLayout(3, order);
    expect(layout.cols[0].cards[0].rot).toBe('rot-l');
    expect(layout.cols[1].cards[0].rot).toBe('rot-r');
  });

  it('fallback pour n inattendu : colonne unique rot-0', () => {
    const layout = getLayout(7, [0, 1, 2, 3, 4, 5, 6]);
    expect(layout.cols).toHaveLength(1);
    layout.cols[0].cards.forEach(c => expect(c.rot).toBe('rot-0'));
  });

  it('ne contient pas de doublons d\'index pour 4 joueurs', () => {
    const layout = getLayout(4, order);
    const indices = layout.cols.flatMap(c => c.cards.map(card => card.idx));
    expect(new Set(indices).size).toBe(indices.length);
  });
});

// ── rotateSeatOrder ───────────────────────────────────────────────────────────
describe('rotateSeatOrder', () => {
  it('le dernier siège devient le premier', () => {
    expect(rotateSeatOrder([0, 1, 2])).toEqual([2, 0, 1]);
  });

  it('idempotent après n rotations complètes', () => {
    let order = [0, 1, 2, 3];
    for (let i = 0; i < 4; i++) order = rotateSeatOrder(order);
    expect(order).toEqual([0, 1, 2, 3]);
  });

  it('ne modifie pas le tableau original', () => {
    const orig = [0, 1, 2];
    const orig_copy = [...orig];
    rotateSeatOrder(orig);
    expect(orig).toEqual(orig_copy);
  });

  it('retourne le tableau inchangé si < 2 éléments', () => {
    expect(rotateSeatOrder([0])).toEqual([0]);
    expect(rotateSeatOrder([])).toEqual([]);
  });
});

// ── applyDelta ────────────────────────────────────────────────────────────────
describe('applyDelta', () => {
  const p = (inf, eliminated = false) => createPlayer({ id: 'x', name: 'X', role: 'Y', inf, eliminated });

  it('ajoute correctement un delta positif', () => {
    const r = applyDelta({ ...p(30), inf: 30 }, 5);
    expect(r.newInf).toBe(35);
    expect(r.realDelta).toBe(5);
  });

  it('soustrait correctement un delta négatif', () => {
    const player = { ...createPlayer({ id: 'x', name: 'X', role: 'Y' }), inf: 20 };
    const r = applyDelta(player, -7);
    expect(r.newInf).toBe(13);
    expect(r.realDelta).toBe(-7);
  });

  it('plafonne à MAX (40)', () => {
    const player = { ...createPlayer({ id: 'x', name: 'X', role: 'Y' }), inf: 38 };
    const r = applyDelta(player, 10);
    expect(r.newInf).toBe(MAX);
    expect(r.realDelta).toBe(2);
  });

  it('plancher à 0', () => {
    const player = { ...createPlayer({ id: 'x', name: 'X', role: 'Y' }), inf: 3 };
    const r = applyDelta(player, -10);
    expect(r.newInf).toBe(0);
    expect(r.realDelta).toBe(-3);
  });

  it('déclenche eliminated=true quand inf tombe à 0', () => {
    const player = { ...createPlayer({ id: 'x', name: 'X', role: 'Y' }), inf: 1 };
    const r = applyDelta(player, -1);
    expect(r.eliminated).toBe(true);
  });

  it('ne déclenche PAS eliminated si déjà éliminé', () => {
    const player = { ...createPlayer({ id: 'x', name: 'X', role: 'Y' }), inf: 1, eliminated: true };
    const r = applyDelta(player, -1);
    expect(r.eliminated).toBe(false);
  });

  it('realDelta=0 si déjà à MAX avec delta positif', () => {
    const player = { ...createPlayer({ id: 'x', name: 'X', role: 'Y' }), inf: MAX };
    const r = applyDelta(player, 5);
    expect(r.realDelta).toBe(0);
  });

  it('realDelta=0 si déjà à 0 avec delta négatif', () => {
    const player = { ...createPlayer({ id: 'x', name: 'X', role: 'Y' }), inf: 0, eliminated: true };
    const r = applyDelta(player, -5);
    expect(r.realDelta).toBe(0);
  });
});

// ── scoreClass ────────────────────────────────────────────────────────────────
describe('scoreClass', () => {
  it('classe vide pour inf > 15', () => {
    expect(scoreClass(40)).toBe('');
    expect(scoreClass(16)).toBe('');
  });

  it('"low" pour inf entre 9 et 15', () => {
    expect(scoreClass(15)).toBe('low');
    expect(scoreClass(9)).toBe('low');
  });

  it('"crit crit-blink" pour inf ≤ 8 (joueur en vie)', () => {
    expect(scoreClass(8)).toBe('crit crit-blink');
    expect(scoreClass(0)).toBe('crit crit-blink');
  });

  it('"crit" sans blink si éliminé', () => {
    expect(scoreClass(0, true)).toBe('crit');
  });
});

// ── getWinner ─────────────────────────────────────────────────────────────────
describe('getWinner', () => {
  it('retourne null si plusieurs joueurs en vie', () => {
    const players = makePlayers(3);
    expect(getWinner(players)).toBeNull();
  });

  it('retourne le seul joueur vivant', () => {
    const players = makePlayers(3);
    players[0].eliminated = true;
    players[2].eliminated = true;
    expect(getWinner(players)).toBe(players[1]);
  });

  it('retourne null si tous sont éliminés', () => {
    const players = makePlayers(2);
    players.forEach(p => (p.eliminated = true));
    expect(getWinner(players)).toBeNull();
  });

  it('retourne null avec un seul joueur non éliminé parmi zéro joueurs', () => {
    expect(getWinner([])).toBeNull();
  });
});

// ── pushUndo / popUndo ────────────────────────────────────────────────────────
describe('pushUndo / popUndo', () => {
  const state = () => ({ players: [{ inf: 20 }], seatOrder: [0] });

  it('pousse un snapshot sérialisé', () => {
    const stack = pushUndo([], state());
    expect(stack).toHaveLength(1);
    expect(JSON.parse(stack[0]).players[0].inf).toBe(20);
  });

  it('respecte la limite de 30 entrées', () => {
    let stack = [];
    for (let i = 0; i < 35; i++) stack = pushUndo(stack, { players: [{ inf: i }] });
    expect(stack).toHaveLength(30);
  });

  it('conserve les 30 plus récents', () => {
    let stack = [];
    for (let i = 0; i < 32; i++) stack = pushUndo(stack, { players: [{ inf: i }] });
    const oldest = JSON.parse(stack[0]).players[0].inf;
    expect(oldest).toBe(2); // les 2 premiers (0 et 1) ont été évincés
  });

  it('ne mute pas la pile originale', () => {
    const orig = [];
    pushUndo(orig, state());
    expect(orig).toHaveLength(0);
  });

  it('popUndo restaure le dernier état', () => {
    const stack = pushUndo([], { players: [{ inf: 15 }] });
    const result = popUndo(stack);
    expect(result.state.players[0].inf).toBe(15);
  });

  it('popUndo retourne une pile réduite d\'un élément', () => {
    let stack = [];
    stack = pushUndo(stack, state());
    stack = pushUndo(stack, state());
    const result = popUndo(stack);
    expect(result.undoStack).toHaveLength(1);
  });

  it('popUndo retourne null si la pile est vide', () => {
    expect(popUndo([])).toBeNull();
  });
});

// ── logGrouped ────────────────────────────────────────────────────────────────
describe('logGrouped', () => {
  it('crée un nouveau groupe si aucun groupe ouvert', () => {
    const { history, actionCounter } = logGrouped([], 0, 0, -2, 'Alice', 'Le Sage');
    expect(history).toHaveLength(1);
    expect(actionCounter).toBe(1);
    expect(history[0].entries[0].delta).toBe(-2);
    expect(history[0].open).toBe(true);
  });

  it('incrémente actionCounter à chaque nouveau groupe', () => {
    const r1 = logGrouped([], 0, 0, -1, 'Alice', 'Le Sage');
    const r2 = logGrouped(r1.history.map(h => ({ ...h, open: false })), r1.actionCounter, 1, +2, 'Bob', 'Le Loup');
    expect(r2.actionCounter).toBe(2);
  });

  it('fusionne dans le groupe ouvert existant pour le même joueur', () => {
    const { history, actionCounter } = logGrouped([], 0, 0, -1, 'Alice', 'Le Sage');
    const r2 = logGrouped(history, actionCounter, 0, -1, 'Alice', 'Le Sage');
    expect(r2.history).toHaveLength(1);
    expect(r2.history[0].entries).toHaveLength(2);
    expect(r2.actionCounter).toBe(1); // pas d'incrément
  });

  it('crée un nouveau groupe pour un joueur différent même si un groupe est ouvert', () => {
    const { history, actionCounter } = logGrouped([], 0, 0, -1, 'Alice', 'Le Sage');
    const r2 = logGrouped(history, actionCounter, 1, -1, 'Bob', 'Le Loup');
    expect(r2.history).toHaveLength(2);
    expect(r2.actionCounter).toBe(2);
  });

  it('place les groupes plus récents en tête du tableau', () => {
    const r1 = logGrouped([], 0, 0, -1, 'Alice', 'X');
    const h1closed = r1.history.map(h => ({ ...h, open: false }));
    const r2 = logGrouped(h1closed, r1.actionCounter, 1, +2, 'Bob', 'Y');
    expect(r2.history[0].who).toBe('Bob');
  });
});

// ── groupSum ──────────────────────────────────────────────────────────────────
describe('groupSum', () => {
  it('additionne correctement les deltas', () => {
    const group = { entries: [{ delta: -1 }, { delta: -2 }, { delta: +1 }] };
    expect(groupSum(group)).toBe(-2);
  });

  it('retourne 0 pour un groupe vide', () => {
    expect(groupSum({ entries: [] })).toBe(0);
  });
});

// ── pressKey ──────────────────────────────────────────────────────────────────
describe('pressKey', () => {
  it('remplace le zéro initial par le chiffre tapé', () => {
    expect(pressKey('0', 5)).toBe('5');
  });

  it('ajoute un chiffre à la suite', () => {
    expect(pressKey('1', 2)).toBe('12');
  });

  it('⌫ supprime le dernier caractère', () => {
    expect(pressKey('12', '⌫')).toBe('1');
  });

  it('⌫ sur un seul chiffre retourne "0"', () => {
    expect(pressKey('5', '⌫')).toBe('0');
  });

  it('"00" ne fait rien sur "0"', () => {
    expect(pressKey('0', '00')).toBe('0');
  });

  it('"00" ajoute deux zéros', () => {
    expect(pressKey('1', '00')).toBe('100');
  });

  it('limite à 3 caractères', () => {
    expect(pressKey('99', 9)).toBe('999');
    expect(pressKey('999', 1)).toBe('999'); // tronqué
  });
});

// ── confirmModal ──────────────────────────────────────────────────────────────
describe('confirmModal', () => {
  const p = (inf = 20) => ({ ...createPlayer({ id: 'x', name: 'X', role: 'Y' }), inf });

  it('retourne null si v = 0', () => {
    expect(confirmModal(p(), '0', -1)).toBeNull();
  });

  it('applique le delta négatif correctement', () => {
    const r = confirmModal(p(20), '5', -1);
    expect(r.newInf).toBe(15);
    expect(r.realDelta).toBe(-5);
  });

  it('applique le delta positif correctement', () => {
    const r = confirmModal(p(20), '8', 1);
    expect(r.newInf).toBe(28);
    expect(r.realDelta).toBe(8);
  });

  it('plafonne à MAX', () => {
    const r = confirmModal(p(38), '10', 1);
    expect(r.newInf).toBe(MAX);
  });

  it('déclenche eliminated quand inf → 0', () => {
    const r = confirmModal(p(3), '3', -1);
    expect(r.eliminated).toBe(true);
  });
});

// ── mergeProfiles ─────────────────────────────────────────────────────────────
describe('mergeProfiles', () => {
  it('ajoute des noms sans doublon', () => {
    const result = mergeProfiles(['Alice'], ['Alice', 'Bob']);
    expect(result).toEqual(['Alice', 'Bob']);
  });

  it('ignore les noms vides/falsy', () => {
    const result = mergeProfiles([], ['Alice', '', null, 'Bob']);
    expect(result).toEqual(['Alice', 'Bob']);
  });

  it('respecte la limite de 30 profils', () => {
    const existing = Array.from({ length: 29 }, (_, i) => `P${i}`);
    const result = mergeProfiles(existing, ['X', 'Y']);
    expect(result).toHaveLength(30);
  });

  it('garde les 30 plus récents si dépassement', () => {
    const existing = Array.from({ length: 30 }, (_, i) => `P${i}`);
    const result = mergeProfiles(existing, ['NewGuy']);
    expect(result).toContain('NewGuy');
    expect(result).not.toContain('P0'); // le plus ancien est évincé
  });
});

// ── deleteProfileFromList ─────────────────────────────────────────────────────
describe('deleteProfileFromList', () => {
  it('supprime le bon nom', () => {
    expect(deleteProfileFromList(['Alice', 'Bob', 'Carol'], 'Bob')).toEqual(['Alice', 'Carol']);
  });

  it('ne touche pas aux autres entrées', () => {
    const result = deleteProfileFromList(['Alice'], 'Bob');
    expect(result).toEqual(['Alice']);
  });

  it('retourne tableau vide si liste vide', () => {
    expect(deleteProfileFromList([], 'X')).toEqual([]);
  });
});

// ── shuffle ───────────────────────────────────────────────────────────────────
describe('shuffle', () => {
  it('conserve la même longueur', () => {
    expect(shuffle([1, 2, 3, 4, 5])).toHaveLength(5);
  });

  it('contient les mêmes éléments (permutation)', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.sort()).toEqual([...arr].sort());
  });

  it('ne modifie pas le tableau original', () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    shuffle(arr);
    expect(arr).toEqual(copy);
  });

  it('tableau vide reste vide', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('tableau d\'un seul élément reste inchangé', () => {
    expect(shuffle([42])).toEqual([42]);
  });
});

// ── serializeGame / deserializeGame ───────────────────────────────────────────
describe('serializeGame / deserializeGame', () => {
  const state = {
    players:       makePlayers(2),
    seatOrder:     [0, 1],
    history:       [{ playerIdx: 0, entries: [{ delta: -1 }] }],
    actionCounter: 3,
  };

  it('round-trip préserve les données essentielles', () => {
    const raw = serializeGame(state);
    const restored = deserializeGame(raw);
    expect(restored.players).toHaveLength(2);
    expect(restored.seatOrder).toEqual([0, 1]);
    expect(restored.actionCounter).toBe(3);
    expect(restored.history).toHaveLength(1);
  });

  it('retourne null pour une chaîne vide/null', () => {
    expect(deserializeGame(null)).toBeNull();
    expect(deserializeGame('')).toBeNull();
    expect(deserializeGame(undefined)).toBeNull();
  });

  it('retourne null pour du JSON invalide', () => {
    expect(deserializeGame('not-json{')).toBeNull();
  });

  it('retourne null si players manque', () => {
    expect(deserializeGame(JSON.stringify({ seatOrder: [0] }))).toBeNull();
  });

  it('retourne null si seatOrder manque', () => {
    expect(deserializeGame(JSON.stringify({ players: [] }))).toBeNull();
  });

  it('history par défaut à [] si absent', () => {
    const minimal = JSON.stringify({ players: [], seatOrder: [] });
    const r = deserializeGame(minimal);
    expect(r.history).toEqual([]);
  });

  it('actionCounter par défaut à 0 si absent', () => {
    const minimal = JSON.stringify({ players: [], seatOrder: [] });
    const r = deserializeGame(minimal);
    expect(r.actionCounter).toBe(0);
  });
});
