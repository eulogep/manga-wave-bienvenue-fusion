# MANGA WAVE V3 — P1 Reader Production Interaction Fix

Date: 2026-08-29  
Production: https://manga-wave-bienvenue-fusion.vercel.app/  
Implementation commit: `c009e04` (`fix(reader): make chrome visibility deterministic`)

## OVERALL_STATUS

`CSS_ROOT_FIX_DEPLOYED_BROWSER_ACCEPTANCE_PENDING`

Le défaut CSS confirmé par la QA est corrigé et poussé sur `main`. La suite Playwright réelle est ajoutée, mais son exécution reste bloquée dans cette session car aucun navigateur n’est connecté. Aucun statut de clic réel n’est donc présenté comme PASS avant un nouveau smoke navigateur.

## ROOT_CAUSE_PAGE_NAVIGATION

Le bouton Next n’était pas recouvert et son handler n’était pas la première cause. Le conteneur inférieur portait l’état de classe visible, mais les propriétés calculées restaient celles de l’état caché : `opacity: 0`, translation positive d’environ 64 px et centre hors viewport. `document.elementFromPoint` retournait donc `null`.

`HIDDEN_RULE_SOURCE` : utilitaires Tailwind générés dans l’ancien `assets/index-CICPHndq.css` depuis la branche cachée de `UniversalReader.tsx` : `.translate-y-full`, `.-translate-y-full`, `.opacity-0` et `.pointer-events-none`.

`VISIBLE_RULE_SOURCE` : utilitaires Tailwind du même bundle depuis la branche visible : `.translate-y-0` et `.opacity-100`.

`WHY_HIDDEN_WINS` : la production avait deux groupes d’utilitaires indépendants qui possédaient les mêmes propriétés `transform` et `opacity`. Le trace CSS fourni par la QA prouve que le navigateur conservait les valeurs cachées alors que React exposait les classes visibles. La correction supprime cette propriété partagée : aucun utilitaire Tailwind de translation/opacité ne contrôle désormais le chrome Reader.

## ROOT_CAUSE_SETTINGS

La barre supérieure subissait le même défaut : état DOM visible mais `opacity: 0`, translation négative et géométrie hors viewport. Le clic utilisateur ne pouvait donc pas atteindre le bouton Settings. Le précédent constat « panneau absent » ne permettait pas de conclure à un second bug React, car le trigger physique n’était pas joignable.

## ACTUAL_DOM_CLICK_PATH

Avant correction :

`pointer → centre hors viewport → elementFromPoint(null) → aucun bouton → aucun handler`

Après correction attendue :

`pointer → bouton visible dans le viewport → handler React → état page/settings → DOM → URL/progression`

La seconde chaîne est couverte par `tests/e2e/reader-p1.spec.ts` et doit encore être exécutée dans un navigateur disponible.

## PAGE_STATE_SOURCE_OF_TRUTH

Le modèle Reader existant n’a pas été réécrit. `currentPage` reste la source autoritaire ; l’image, l’indicateur, l’URL et la progression en découlent. Le présent hotfix ne modifie aucun handler de navigation ni aucune logique canonique.

## EFFECT_RESET_AUDIT

Aucun nouvel effet de page n’a été ajouté ou modifié. Le diagnostic de production démontre que le bouton n’était pas physiquement atteignable ; il n’était donc pas justifié de modifier à nouveau l’hydratation ou la persistance.

## CSS_OWNERSHIP_FIX

Les deux éléments utilisent maintenant :

- `data-reader-chrome="top|bottom"` ;
- `data-visible="true|false"` ;
- `.reader-top-toolbar` / `.reader-bottom-controls`.

Une seule règle CSS tardive et non layerisée contrôle atomiquement :

- caché : `opacity:0`, `translateY(±100%)`, `pointer-events:none` ;
- visible : `opacity:1`, `translateY(0)`, `pointer-events:auto`.

Aucun `!important` n’est utilisé. Les anciennes classes conditionnelles `translate-y-*` et `opacity-*` ont été retirées des deux conteneurs.

## CSS_BUILD_OUTPUT

`PASS`

Bundle local : `assets/index-BtCCz55p.css`.

Règle compilée vérifiée :

```css
.reader-top-toolbar[data-visible=true],
.reader-bottom-controls[data-visible=true] {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}
```

Les règles cachées et visibles sont contiguës et leur ordre est déterministe.

## SETTINGS_DOM_CASE

`PENDING_POST_CSS_REAL_CLICK`

La QA précédente observait CASE A, mais le trigger était hors viewport. La classification doit être rejouée après propagation du nouveau CSS. Le test exige un vrai clic pointeur puis vérifie `role="dialog"`, `Ajustement`, `Sources`, AsuraScans et OriginManga.

## SOURCE_SELECTOR

`IMPLEMENTED — BROWSER_RETEST_PENDING`

Le sélecteur existant n’a pas été redessiné. Le test E2E attend l’alternative OriginManga, clique celle-ci, vérifie `/read/originmanga/`, conserve `page=1` et interdit un chapitre 1.

## PLAYWRIGHT_TESTS

`DISCOVERY_PASS — EXECUTION_BLOCKED_NO_BROWSER`

Fichiers :

- `playwright.config.ts` ;
- `tests/e2e/reader-p1.spec.ts`.

Commande de découverte : `npm.cmd run test:e2e:reader -- --list`  
Résultat : 4 tests découverts.

Les scénarios vérifient :

1. bounding box et intersection viewport ;
2. opacité calculée ;
3. `elementFromPoint` appartenant au bouton ;
4. clic pointeur Next/Previous ;
5. indicateur, URL et changement d’image ;
6. ouverture/fermeture Settings et sélecteur ;
7. source switch chapitre 5 et page conservée ;
8. trois cycles auto-hide/reveal avec pointer-events cohérents.

## LOCAL_BUILT_APP_E2E

`BLOCKED_NO_BROWSER`

Le build de production local est validé, mais aucun navigateur n’est exposé à cette session pour exécuter Playwright. Ne pas assimiler la découverte des tests à une exécution.

## PRODUCTION_SMOKE

`CSS_DEPLOYMENT_PASS — INTERACTION_BROWSER_PENDING`

La production sert maintenant `assets/index-TGC0WtH0.js` et `assets/index-BtCCz55p.css`. Le CSS distant a été téléchargé et contient exactement les règles atomiques Reader attendues. Le smoke pointeur doit encore être rejoué dans un navigateur connecté.

## UNIT_TESTS

`PASS — 41/41`

Commande : `npm.cmd run test:p1`.

## TYPESCRIPT

`PASS`

Commande : `npx.cmd tsc -b --pretty false`.

## LINT

`PASS — 0 error`

57 avertissements Fast Refresh préexistants.

## BUILD

`PASS`

- client : `npm.cmd run build` ;
- serveur : `npm.cmd --prefix server run build` ;
- JS : `assets/index-TGC0WtH0.js` ;
- CSS : `assets/index-BtCCz55p.css`.

## DEPLOYMENT

`PASS`

- branche : `main` ;
- implementation : `c009e04` ;
- remote : `origin/main` ;
- JS production : `assets/index-TGC0WtH0.js` ;
- CSS production : `assets/index-BtCCz55p.css` ;
- règles Reader distantes : vérifiées.

## COMMIT

`c009e04 fix(reader): make chrome visibility deterministic`

## ACCEPTANCE_GATE

- `CSS_CASCADE_ROOT_CAUSE = PASS`
- `CSS_BUILD_OUTPUT = PASS`
- `TOP_TOOLBAR_GEOMETRY = PENDING_BROWSER`
- `BOTTOM_CONTROLS_GEOMETRY = PENDING_BROWSER`
- `ELEMENT_FROM_POINT = PENDING_BROWSER`
- `NEXT_REAL_CLICK = PENDING_BROWSER`
- `PREVIOUS_REAL_CLICK = PENDING_BROWSER`
- `SETTINGS_REAL_CLICK = PENDING_BROWSER`
- `SETTINGS_DOM_MOUNT = PENDING_BROWSER`
- `SETTINGS_VISIBLE = PENDING_BROWSER`
- `SOURCE_SELECTOR_VISIBLE = PENDING_BROWSER`
- `AUTO_HIDE_REGRESSION = PENDING_BROWSER`
- `PLAYWRIGHT_REAL_BROWSER = BLOCKED_NO_BROWSER`
- `PRODUCTION_CSS = PASS`
- `PRODUCTION_INTERACTION_SMOKE = PENDING_BROWSER`
- `P1 = FAIL_UNTIL_BROWSER_GATE_PASSES`
