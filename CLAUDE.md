# La Loi du Milieu — consignes pour les sessions Claude

Compteur d'Influence pour le jeu de société *La Loi du Milieu* : une page web
installable (PWA), sans build ni dépendance. Tout le code est dans `index.html`
(HTML, CSS et JavaScript en ligne). À côté : `sw-ldm.js` (service worker, hors
ligne), `manifest.json`, `favicon.png`.

## Avant de modifier

- Les **règles du jeu** codées ici sont décidées par l'utilisateur : ne jamais
  en inventer ni en changer sans sa demande. État actuel, lu dans le code :
  12 capos au choix (`LTS`), **2 à 6 joueurs**, chacun part de **40**
  d'Influence (`MAX`, aussi le plafond), éliminé à **0** ; à partir de 3
  joueurs, celui qui cause une élimination gagne **4** d'Influence
  (`showKillerModal`) ; le dernier en vie gagne (`checkWinner`).
- Une demande imprécise : poser 3 questions avant d'agir.
- Tout en français.

## Exigences constantes

- **Daltonisme** : jamais d'information portée par la seule couleur. Le score
  bas se lit aujourd'hui par la couleur (`low`, `crit`) **et** par le
  clignotement (`crit-blink`) ; garder un repère non coloré en plus de toute
  teinte ajoutée. Thème sombre et thème jour (`body.day-mode`, `toggleTheme`) :
  vérifier les deux.
  Après tout changement d'interface (CSS, couleurs, états, graphiques), lancer
  le sous-agent **`relecteur-daltonisme`**
  (`.claude/agents/relecteur-daltonisme.md`) avant de pousser :
  il signale, en lecture seule, ce qu'un daltonien ne peut pas lire ;
  la session corrige.
- Pensé pour un téléphone tenu en **portrait**, posé au centre de la table :
  les cartes latérales sont tournées (`getLayout`, `rot-l` / `rot-r`). Vérifier
  tout changement d'affichage de 3 à 6 joueurs.
- Données : `localStorage` uniquement (`ldm_save` pour la partie en cours,
  `ldm_profiles` pour les prénoms mémorisés). Ne pas renommer ces clés : les
  parties en cours seraient perdues. Aucun cookie, aucun envoi réseau hormis
  les polices Google (dit dans la notice de confidentialité de la page).

## Publier

- **`CACHE_VERSION` de `sw-ldm.js` (`ldm-vN`) s'incrémente à chaque
  modification publiée** : sans cela, les appareils gardent l'ancienne version
  en cache. Le service worker prévient alors l'app (`SW_UPDATED`), qui affiche
  « Mise à jour disponible ». Un fichier ajouté au site doit aussi entrer dans
  `STATIC`.
- Le site est hébergé sur **Vercel** et **publié depuis `main`** (confirmé par
  l'utilisateur le 30/10/2026) : fusionner, c'est mettre en ligne.
- Sans build, Vercel publie le dossier tel quel : `.vercelignore` en retire
  `CLAUDE.md` et `.claude/`. Tout nouveau fichier qui n'est pas du site s'y
  ajoute.
- Une session travaille sur sa branche et passe par une PR vers `main` ;
  fusion seulement sur demande explicite.

## Vérifier

Pas de suite de tests. Avant de pousser : ouvrir `index.html` dans un
navigateur (Playwright est disponible) en portrait mobile, jouer une partie à
3 joueurs jusqu'à une élimination, recharger la page (reprise de la partie),
basculer le thème jour.

## Sessions Claude Code

- `.claude/hooks/fichiers-sensibles.mjs` (PreToolUse) refuse la lecture et
  l'écriture des secrets (`.env*`, clés…). Essai :
  `node .claude/hooks/fichiers-sensibles.essai.mjs`.
- GateGuard (plugin ECC) est réglé par le bloc `env` de
  `.claude/settings.json` (30/10/2026, décision de l'utilisateur) : plus de
  question avant la première commande shell, pas de question avant d'écrire un
  test ou un essai (`**/tests/**`, `**/*.test.*`, `**/*.essai.*`), messages de
  refus courts ; la question avant d'écrire du code ou de la documentation et
  le contrôle des commandes destructrices restent.
