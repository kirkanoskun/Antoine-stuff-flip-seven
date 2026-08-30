# Flip 7 — Compteur de points

Application web autonome pour suivre les scores d'une partie de **Flip 7**, avec la
variante **Vengeance**. Un seul fichier `index.html`, zéro dépendance, zéro build.
Installable comme une vraie application sur iPhone et Android.

---

## Installation

### Sur téléphone (recommandé)

L'application doit être servie en **HTTPS** pour être installable : le service worker,
le partage natif et l'invite d'installation sont désactivés en `file://`. Ouvrir le
fichier depuis l'app Fichiers de l'iPhone donne une page web, pas une application.

Le plus simple est **GitHub Pages**, gratuit et sans serveur à gérer :

1. Sur le dépôt GitHub → **Settings** → **Pages**
2. *Source* : **Deploy from a branch**
3. *Branch* : la branche voulue, dossier **`/ (root)`** → **Save**
4. Après une minute, ouvrir l'URL fournie sur le téléphone
5. **iPhone** (Safari) : Partager → *Sur l'écran d'accueil*
   **Android** (Chrome) : menu ⋮ → *Installer l'application*

Une fois installée, l'application fonctionne **hors ligne** et se met à jour toute
seule au chargement suivant après chaque déploiement.

### En local

Double-cliquer `index.html` suffit pour jouer, mais sans le mode hors ligne ni le
partage natif. Pour tout avoir :

```bash
npx http-server -p 8899 .
# puis ouvrir http://127.0.0.1:8899/index.html
```

---

## Fonctionnalités

### Configuration
- Ajout et retrait des joueurs (2 à 12)
- Choix de la **variante** : Standard ou Vengeance
- **Mode Sans Pitié** (Vengeance) : les scores peuvent descendre sous zéro
- Objectif de points personnalisable (200 par défaut, règle officielle)

La variante se verrouille dès la première manche validée : elle change le calcul
des manches déjà notées.

### Pendant la partie
- Saisie directe des points, ou **calculateur de cartes** 🃏
- Classement trié en direct, points restants et barre de progression
- **Annulation** de la dernière manche
- Historique détaillé, manche par manche
- Sauvegarde automatique — fermer et rouvrir ne perd rien

### Fin de partie
- Écran de victoire avec classement final
- **Partage** des scores (partage natif, repli sur le presse-papier)
- **Rejouer avec les mêmes joueurs** — remet les scores à zéro en gardant la tablée
- **Égalité** : aucun vainqueur n'est déclaré, une manche de mort subite est annoncée

---

## Calcul des points

### Standard
| Élément | Effet |
|---|---|
| Cartes chiffres 0 → 12 | Chacune vaut sa valeur |
| Modificateurs `+2` `+4` `+6` `+8` `+10` | S'ajoutent au total |
| `×2` | Double **la somme des cartes chiffres** uniquement |
| **Flip 7** (7 chiffres distincts) | **+15**, ajouté après le `×2` |
| Bust | 0 point pour la manche |

Ordre : `chiffres → ×2 → bonus → +15`

### Vengeance
| Élément | Effet |
|---|---|
| Cartes chiffres 0 → **13** | Chacune vaut sa valeur |
| Malus `−2` `−4` `−6` `−8` `−10` | Se retranchent |
| `÷2` | Divise le total (arrondi à l'inférieur), **cumulable** |
| **Le Zéro** (la carte 0) | Annule la manche, sauf en cas de Flip 7 |
| **13 Porte-bonheur** | Autorise un second 13 sans sauter |
| **7 Porte-malheur** | Défausse tout, ne laisse que le 7 |
| **Flip 7** | **+15** — en Sans Pitié, peut être infligé à un adversaire |

Ordre : `chiffres → Le Zéro → ÷2 → Malus → plancher à 0 → +15`

Deux points qui comptent :
- le `÷2` s'applique **avant** les Malus, il ne les divise donc pas ;
- le plancher à 0 tombe **avant** le bonus, pour que le Flip 7 soit toujours
  crédité en entier. En Sans Pitié, ce plancher est levé.

Le **don du Flip 7** (Sans Pitié) est le seul effet entre joueurs : le donneur
renonce à ses +15 et la cible subit −15. Le don reste rattaché à la manche, donc
annuler la manche annule le don, et deux donneurs visant la même cible cumulent.

---

## Tests

145 tests automatisés couvrent le moteur de score, l'interface et la PWA.

```bash
npm i -D playwright && npx playwright install chromium
./tests/run.sh
```

| Suite | Portée |
|---|---|
| `tests/scoring.mjs` | 45 tests — ordre des opérations, Flip 7, cas limites, non-régression du mode standard |
| `tests/ui.mjs` | 64 tests — parcours complets, égalité, don du Flip 7, migration des données, robustesse |
| `tests/pwa.mjs` | 36 tests — manifest, icônes, zones sûres, hors ligne, absence de débordement de 320 à 1024 px |

`tests/gen-icons.mjs` régénère les icônes PNG depuis des tracés vectoriels
(aucune dépendance aux polices) :

```bash
node tests/gen-icons.mjs
```

---

## Notes techniques

- **Stockage** : `localStorage`, clé `flip7_state_v2`. Les parties enregistrées par
  une version antérieure (`flip7_state_v1`) sont migrées automatiquement au premier
  chargement ; l'ancienne clé est conservée intacte.
- **Mise à jour** : le service worker sert le cache puis rafraîchit en arrière-plan.
  Une nouvelle version est donc active au chargement suivant. Penser à incrémenter
  `VERSION` dans `sw.js` à chaque déploiement.
- **Icônes** : PNG uniquement — iOS ignore le SVG pour `apple-touch-icon` et
  remplacerait l'icône par une capture de la page.
