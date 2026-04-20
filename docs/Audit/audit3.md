# Audit 3 - Recommandations

Projet audite: `fleet-management-app`

Note: le dossier `modele-X` est considere comme un backup et n'entre pas dans le perimetre des recommandations ci-dessous.

## Resume executif

Le site presente une base fonctionnelle solide, mais plusieurs points doivent etre traites en priorite:

1. renforcer les controles d'acces sur les pages d'administration cote frontend et backend;
2. corriger les actions sensibles accessibles a des roles trop larges;
3. fiabiliser la gestion des dates pour eviter les decalages lies au fuseau horaire;
4. assainir l'environnement de projet pour reduire les risques de maintenance et de regression.

## Recommandations prioritaires

### 1. Securiser toutes les pages admin

Constat:
- certaines pages admin chargent des donnees sensibles ou exposent des actions critiques sans garde frontend suffisante;
- certaines pages declenchent des appels API avant meme la redirection.

Actions recommandees:
- ajouter un garde d'acces explicite sur toutes les routes `/admin`;
- bloquer le rendu et les appels API tant que `authLoading` n'est pas termine;
- n'executer les fetchs admin que si le role est autorise;
- verifier que le backend applique aussi les memes restrictions de role, sans se reposer sur le frontend.

Pages a traiter en priorite:
- `frontend/src/app/admin/page.tsx`
- `frontend/src/app/admin/incidents/page.tsx`
- `frontend/src/app/admin/vehicles/page.tsx`
- `frontend/src/app/admin/cleaning/page.tsx`
- `frontend/src/app/admin/users/page.tsx`

### 2. Restreindre les actions sensibles dans la gestion des utilisateurs

Constat:
- l'interface permet aujourd'hui a un `MANAGER` d'acceder a des operations sensibles comme la suppression de comptes ou la reinitialisation de mots de passe.

Actions recommandees:
- limiter la reinitialisation de mot de passe aux roles `ADMIN` et eventuellement `DIRECTEUR` si c'est voulu metier;
- limiter la suppression de comptes aux seuls roles explicitement autorises;
- masquer les boutons cote UI pour les roles non autorises;
- controler egalement ces permissions dans les endpoints backend associes.

Fichier principal:
- `frontend/src/app/admin/users/page.tsx`

### 3. Corriger la gestion des dates locales

Constat:
- plusieurs composants utilisent `toISOString().split('T')[0]` pour alimenter des champs `type="date"`;
- cette logique convertit d'abord la date en UTC et peut deplacer d'un jour certaines reservations selon le fuseau horaire.

Actions recommandees:
- remplacer cette logique par un formateur de date locale;
- centraliser la conversion dans un helper reutilisable;
- revalider les ecrans de reservation et de nettoyage apres correction.

Fichiers concernes:
- `frontend/src/components/ui/ReservationModal.tsx`
- `frontend/src/app/nettoyage/page.tsx`
- `frontend/src/app/admin/cleaning/page.tsx`

### 4. Ne pas lancer de fetch privilegie avant verification des droits

Constat:
- certaines pages redirigent les utilisateurs non autorises, mais seulement apres avoir deja appele des endpoints admin.

Actions recommandees:
- fusionner la logique de verification d'acces et de chargement de donnees;
- encapsuler ce comportement dans un hook ou composant de protection commun;
- standardiser un pattern: verifier le role, puis seulement ensuite appeler l'API.

## Recommandations importantes

### 5. Uniformiser la politique d'autorisation

Constat:
- la logique de roles est dispersee dans plusieurs pages;
- il existe un risque d'incoherence entre l'interface et le backend.

Actions recommandees:
- definir une matrice claire des permissions par role;
- centraliser les helpers de type `canAccessAdmin`, `canManageUsers`, `canResetPassword`, `canDeleteVehicle`;
- aligner strictement frontend et backend sur cette matrice.

### 6. Corriger les problemes d'encodage

Constat:
- plusieurs textes francais affichent du mojibake.

Actions recommandees:
- verifier l'encodage UTF-8 des fichiers sources;
- normaliser l'encodage dans l'editeur et dans le depot;
- relire les libelles utilisateur visibles apres correction.

Exemples visibles:
- `frontend/src/app/page.tsx`
- plusieurs pages admin et composants UI

### 7. Nettoyer le depot

Constat:
- le workspace contient des artefacts techniques et runtime qui compliquent l'audit et les revues.

Actions recommandees:
- sortir `node_modules`, `.next`, `dist`, bases locales et fichiers generes du versionnement si ce n'est pas volontaire;
- completer `.gitignore`;
- separer clairement les fichiers d'exploitation, de backup et de documentation.

Elements a revoir:
- `fleet-management-app/frontend/node_modules`
- `fleet-management-app/backend/dist`
- `fleet-management-app/backend/dev.db`

### 8. Ajouter une verification qualite minimale

Constat:
- aucun test automatise clair n'a ete trouve;
- la verification repose surtout sur du manuel.

Actions recommandees:
- ajouter au minimum un lint stable executable localement;
- ajouter des tests sur les flux critiques: login, reservation, cloture de trajet, gestion admin;
- ajouter un controle CI simple sur build + lint.

## Recommandations produit et robustesse

### 9. Encadrer les operations destructives

Actions recommandees:
- garder les confirmations sur suppression et cloture forcee;
- ajouter des messages d'erreur plus explicites;
- journaliser cote backend les actions critiques admin.

### 10. Revoir les flux de session

Actions recommandees:
- verifier que tous les endpoints sensibles repondent proprement en `401` ou `403`;
- eviter les redirections implicites non maitrisees en cascade;
- distinguer clairement "non connecte" et "connecte mais non autorise".

Fichier central:
- `frontend/src/lib/apiFetch.ts`

## Plan d'action recommande

### Phase 1 - Securite immediate

1. corriger les gardes d'acces sur toutes les pages `/admin`;
2. restreindre les actions sensibles de `admin/users`;
3. verifier les autorisations correspondantes cote backend.

### Phase 2 - Fiabilite fonctionnelle

1. corriger les conversions de dates locales;
2. retester creation, modification et affichage des reservations;
3. retester les plannings de nettoyage.

### Phase 3 - Maintenabilite

1. nettoyer le depot;
2. corriger l'encodage des fichiers;
3. remettre en place lint, build propre et premiers tests.

## Conclusion

Le chantier principal n'est pas l'interface visuelle mais la securisation des parcours admin et la fiabilite des dates. Si ces points sont corriges rapidement, la base du projet sera nettement plus saine pour evoluer sans regressions.
