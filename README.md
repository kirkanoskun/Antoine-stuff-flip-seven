# Flip 7 — Compteur de points

Application web autonome (un seul fichier `index.html`) pour suivre les scores d'une partie de **Flip 7**.

## Utilisation

Ouvre simplement **`index.html`** dans n'importe quel navigateur (téléphone ou ordinateur).
Aucune installation, aucun serveur. La partie en cours est sauvegardée automatiquement
dans le navigateur (tu peux fermer/rouvrir sans rien perdre).

## Fonctionnalités

### 1. Configuration de la partie
- Ajouter / retirer les **joueurs présents**.
- Définir le **nombre de points pour gagner** (200 par défaut, règle officielle).

### 2. Suivi des manches
- Saisir les points gagnés par chaque joueur à chaque manche.
- 🃏 **Assistant de calcul par cartes** : sélectionne les cartes retournées et le score
  de la manche est calculé automatiquement :
  - cartes chiffres **0 à 12** (chacune = sa valeur),
  - modificateurs **+2 / +4 / +6 / +8 / +10** (s'ajoutent),
  - carte **×2** (double la somme des cartes chiffres),
  - bonus **Flip 7** : +15 points si 7 cartes chiffres uniques,
  - bouton **« A sauté »** = 0 point.
- ✅ Valider la manche → totaux et classement mis à jour.
- ↩️ **Annuler la dernière manche** (retour en arrière).

### 3. Classement & objectif
- Classement trié en temps réel.
- Pour chaque joueur : **points restants** pour atteindre l'objectif et barre de progression.
- Détection automatique du **gagnant** dès l'objectif atteint.
- Historique détaillé manche par manche.

## Rappel des règles de score (Flip 7)
- Chaque carte chiffre vaut sa valeur faciale.
- Doublon de chiffre = le joueur « saute » et marque 0 pour la manche.
- 7 cartes chiffres uniques = **Flip 7** → +15 points bonus.
- Premier joueur à **200 points** : gagne la partie.
