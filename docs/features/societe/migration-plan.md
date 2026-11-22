# Plan de migration — Société

Page **Legacy** : `legacy/www/modules/setup/company.php` (menu Admin › Société).
Cible **Modern** : `modern/src/app/(app)/admin/societe/page.tsx` (stub `StubPage` à remplacer).

## Objectif

La page Société permet à un utilisateur connecté de régler les paramètres de la société : la devise et les dates de début et de fin de l'exercice comptable. Ces dates sont ensuite affichées sur le tableau de bord, dans le **Legacy** comme dans **Modern** (lot 3). C'est la première **Page métier** proposée par le **Squelette** (bouton « Commencer par « Société » » du dashboard).

## Comportement legacy à garder

**Accès**

- Page réservée aux utilisateurs connectés, sans contrôle de rôle (`company.php:10`, `require_login()` seul ; la table `users` n'a pas de colonne de rôle, `01_schema.sql:5-10`). Dans **Modern**, le layout `(app)` et `middleware.ts` assurent déjà cette protection.

**Lecture (GET)**

- Lit l'unique ligne `company WHERE id = 1` (`lib/utils.php:244-251`, appelé en `company.php:57`).
- Si aucune ligne n'existe, valeurs par défaut : devise `EUR`, exercice du `1er janvier` au `31 décembre` de l'année en cours (`company.php:58-64`).
- Titre de page « Paramétrage de la Société » (`company.php:70`) ; titre d'onglet « Paramétrage Société » (`company.php:66`).

**Formulaire** (`company.php:72-102`)

- **Devise** : liste déroulante `currency`, 4 options, valeur courante présélectionnée :
  `EUR - Euro`, `USD - Dollar US`, `GBP - Livre Sterling`, `CHF - Franc Suisse` (`company.php:76-82`).
- **Début exercice \*** : champ date `fiscal_year_start`, obligatoire (`company.php:87-89`).
- **Fin exercice \*** : champ date `fiscal_year_end`, obligatoire (`company.php:93-95`).
- Bouton « Enregistrer » (`company.php:100`).

**Validation (POST)** (`company.php:16-27`)

- Les dates sont acceptées au format `AAAA-MM-JJ` ou `JJ/MM/AAAA`, tout autre format vaut « vide » (`lib/utils.php:88-104`).
- Date de début ou de fin vide → « Les dates de l'exercice sont obligatoires. » (`company.php:22-24`).
- Début ≥ fin → « La date de fin doit être postérieure à la date de début. » (`company.php:25-27`). Une date de fin égale à la date de début est donc refusée.
- Plusieurs erreurs sont concaténées par un espace dans un seul message d'erreur (`company.php:52`).

**Enregistrement** (`company.php:29-50`)

- Si la ligne `id = 1` existe : `UPDATE` de `currency`, `fiscal_year_start`, `fiscal_year_end` (le nom de la société n'est pas modifié) (`company.php:36-40`).
- Sinon : `INSERT` avec `id = 1` et `name = 'Ketchup Compta'` (`company.php:43-44`).
- Effet de bord : une ligne d'audit `audit_log(user_id, 'UPDATE', 'company', 1, 'Company settings updated', datetime('now'))` (`company.php:48`, `lib/auth.php:157-171`).
- Succès : message « Paramètres de la société enregistrés. » puis rechargement de la page (`company.php:49-50`).

## Comportement legacy à abandonner

- **SQL construit par concaténation** avec `db_escape` (`company.php:16-18, 36-44`) : remplacé par des requêtes préparées (`getDb().prepare(...)`), comme `modern/src/lib/auth.ts`.
- **Jeton CSRF fait main** (`csrf_verify`, `csrf_field`) : les server actions de Next.js protègent déjà contre le CSRF (vérification d'origine).
- **Message flash en session + redirection** : remplacé par l'état renvoyé par la server action (`useActionState`), comme `modern/src/app/login/actions.ts`.
- **Perte de la saisie en cas d'erreur** : le **Legacy** réaffiche les valeurs en base, pas celles saisies (`company.php:57` après l'échec). Dans **Modern**, le formulaire garde la saisie de l'utilisateur.
- **Devise non contrôlée côté serveur** : le **Legacy** enregistre n'importe quelle valeur postée (`company.php:16`). **Modern** la restreint aux 4 devises de la liste.
- **Dates impossibles acceptées** : `parse_date` ne vérifie que le motif, `2026-02-30` passe (`lib/utils.php:98-100`). **Modern** refuse une date qui n'existe pas.
- **Format `JJ/MM/AAAA` côté serveur** : le champ est un `<input type="date">` qui envoie toujours `AAAA-MM-JJ` ; le second format n'a pas d'usage depuis le formulaire.

## Design cible

**Route** : `/admin/societe`, dans la zone connectée `(app)` (déjà routée et reliée à `AppNav` via `lib/nav.ts:29`).

**Fichiers**

```
modern/src/
├── lib/company.ts                       # accès données + validation (pur, testable)
├── lib/company.test.ts                  # tests vitest de la validation et de l'accès données
└── app/(app)/admin/societe/
    ├── page.tsx                         # Server Component : lit la société, rend le formulaire
    ├── CompanyForm.tsx                  # Client Component : formulaire + useActionState
    └── actions.ts                       # server action saveCompanyAction
└── app/(app)/dashboard/page.tsx         # + bloc « Exercice » (lot 3)
```

**Accès données** (`lib/company.ts`, via `getDb()` et requêtes préparées)

- `getCompany(): Company | null` — `SELECT * FROM company WHERE id = 1`, ou `null` si absente (le dashboard affiche alors « Non configuré »).
- `getCompanyOrDefaults(): Company` — `getCompany()` ou les valeurs par défaut (EUR, année en cours), pour pré-remplir le formulaire.
- `saveCompany(input, userId)` — `INSERT … ON CONFLICT(id) DO UPDATE` sur `id = 1` (sans toucher à `name` en mise à jour, `name = 'Ketchup Compta'` en création), puis insertion dans `audit_log`, dans une même transaction.
- `validateCompany(formData)` — renvoie soit les valeurs propres, soit la liste des messages d'erreur du **Legacy**.
- `CURRENCIES` — la liste des 4 devises (code + libellé), partagée par le formulaire et la validation.

**Server action** (`actions.ts`)

- Lit la session (`getSession()`) pour l'`user_id` de l'audit ; valide ; enregistre ; renvoie `{ success?: string; error?: string; values }`.
- Appelle `revalidatePath("/admin/societe")` et `revalidatePath("/dashboard")` après l'enregistrement.

**Composants**

- `page.tsx` : Server Component, `getCompanyOrDefaults()` puis `<CompanyForm initial={company} />`.
- `CompanyForm.tsx` : Client Component, mêmes classes Tailwind que la page de login (bandeau rouge pour l'erreur, vert pour le succès, bouton `tomato`).
- `dashboard/page.tsx` : ajoute un bloc « Exercice » (dates de `getCompany()` ou « Non configuré ») au-dessus du message d'accueil existant.

## Lots de travail

### Lot 1 — Accès données et validation

`lib/company.ts` + `lib/company.test.ts`.

- `getCompany()` renvoie la ligne `id = 1` du seed (`EUR`, `2026-01-01`, `2026-12-31`).
- `getCompany()` sans ligne en base renvoie `null` ; `getCompanyOrDefaults()` renvoie alors `EUR`, `<année>-01-01`, `<année>-12-31`.
- `validateCompany` : date de début vide → « Les dates de l'exercice sont obligatoires. »
- `validateCompany` : début = fin, et début > fin → « La date de fin doit être postérieure à la date de début. »
- `validateCompany` : dates vides et début ≥ fin cumulent les messages, séparés par un espace, dans l'ordre du **Legacy**.
- `validateCompany` : devise hors des 4 de la liste → refusée ; date inexistante (`2026-02-30`) → refusée.
- `saveCompany` met à jour la ligne existante sans changer `name`, crée la ligne avec `name = 'Ketchup Compta'` si elle manque, et ajoute une ligne `audit_log` (`UPDATE`, `company`, `1`, `Company settings updated`, `user_id` de la session).

### Lot 2 — Page et formulaire

`page.tsx`, `CompanyForm.tsx`, `actions.ts` ; suppression du `StubPage` de cette route.

- `/admin/societe` affiche le titre « Paramétrage de la Société », la liste des 4 devises avec la devise en base présélectionnée, et les deux dates en base.
- Un enregistrement valide affiche « Paramètres de la société enregistrés. » et les nouvelles valeurs après rechargement de la page.
- Un enregistrement invalide affiche le message d'erreur du **Legacy** et conserve la saisie ; rien n'est écrit en base ni dans `audit_log`.
- Non connecté, `/admin/societe` redirige vers `/login`.
- `npm run check` passe (biome, tsc, vitest).

### Lot 3 — Exercice sur le tableau de bord

`modern/src/app/(app)/dashboard/page.tsx`, réutilise `getCompany()` du lot 1.

- Le tableau de bord affiche un bloc « Exercice » avec les dates de la société au format `JJ/MM/AAAA - JJ/MM/AAAA` (`dashboard.php:42-46`, `lib/utils.php:68-73`).
- Sans ligne `company` en base, le bloc affiche « Non configuré » (`dashboard.php:47`).
- Après un enregistrement sur `/admin/societe`, le tableau de bord affiche les nouvelles dates (la server action appelle aussi `revalidatePath("/dashboard")`).
- Le message d'accueil et le bouton « Commencer par « Société » » restent en place.

## Décisions

- **Le tableau de bord de Modern doit-il afficher l'exercice, comme celui du Legacy ?** → Oui : ajout du lot 3, pour que le réglage ait un effet visible.
- **Faut-il permettre de modifier le nom de la société ?** → Non : on reproduit le Legacy, le nom reste fixe (« Ketchup Compta »).
- **Après un enregistrement réussi, où va l'utilisateur ?** → Il reste sur la page avec le message de succès, comme le Legacy.
- **Faut-il garder la ligne d'audit à chaque enregistrement ?** → Oui : on garde l'effet de bord du Legacy, utile pour une future page de journal d'audit.
