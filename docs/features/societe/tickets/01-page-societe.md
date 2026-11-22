# 01 — Page Société et exercice sur le tableau de bord

Plan : [migration-plan.md](../migration-plan.md). Legacy : `legacy/www/modules/setup/company.php`. Cible : `modern/src/app/(app)/admin/societe/`.

Un seul ticket : les trois lots du plan (accès données, page, tableau de bord) sont petits, passent par le même graphe et tiennent dans une session `implement`. Le lot 3 réutilise `getCompany()` du lot 1, livré dans le même ticket.

## Objectif

Remplacer le `StubPage` de `/admin/societe` par la page **Société** : un utilisateur connecté règle la devise et les dates de l'exercice comptable, et le tableau de bord affiche l'exercice, comme dans le **Legacy**.

## Périmètre

- `modern/src/lib/company.ts` : `CURRENCIES`, `getCompany()`, `getCompanyOrDefaults()`, `validateCompany(formData)`, `saveCompany(input, userId)` — requêtes préparées via `getDb()`, upsert `id = 1` et ligne `audit_log` dans une même transaction.
- `modern/src/lib/company.test.ts` : tests vitest de la validation et de l'accès données.
- `modern/src/app/(app)/admin/societe/page.tsx` (Server Component), `CompanyForm.tsx` (Client Component, `useActionState`, mêmes classes Tailwind que le login), `actions.ts` (server action `saveCompanyAction`, `revalidatePath("/admin/societe")` et `revalidatePath("/dashboard")`).
- `modern/src/app/(app)/dashboard/page.tsx` : bloc « Exercice » au-dessus du message d'accueil.

## Critères d'acceptation

Accès données et validation (`company.test.ts`) :

1. `getCompany()` renvoie la ligne `id = 1` du seed : `EUR`, `2026-01-01`, `2026-12-31`.
2. Sans ligne `company`, `getCompany()` renvoie `null` et `getCompanyOrDefaults()` renvoie `EUR`, `<année en cours>-01-01`, `<année en cours>-12-31`.
3. `validateCompany` avec une date de début ou de fin vide → « Les dates de l'exercice sont obligatoires. »
4. `validateCompany` avec début = fin, et avec début > fin → « La date de fin doit être postérieure à la date de début. »
5. Plusieurs erreurs sont concaténées par un espace, dans l'ordre du **Legacy** (dates obligatoires, puis ordre des dates).
6. `validateCompany` refuse une devise hors de `EUR`, `USD`, `GBP`, `CHF`, et une date inexistante (`2026-02-30`).
7. `saveCompany` met à jour la ligne existante sans changer `name` ; crée la ligne avec `name = 'Ketchup Compta'` si elle manque ; ajoute une ligne `audit_log` (`action = 'UPDATE'`, `entity = 'company'`, `entity_id = 1`, `details = 'Company settings updated'`, `user_id` passé).

Page `/admin/societe` :

8. Affiche le titre « Paramétrage de la Société », une liste de 4 devises (`EUR - Euro`, `USD - Dollar US`, `GBP - Livre Sterling`, `CHF - Franc Suisse`) avec la devise en base présélectionnée, les champs date obligatoires « Début exercice * » et « Fin exercice * » pré-remplis, et un bouton « Enregistrer ».
9. Un enregistrement valide affiche « Paramètres de la société enregistrés. » ; les nouvelles valeurs restent affichées après rechargement.
10. Un enregistrement invalide affiche le message d'erreur du **Legacy**, conserve la saisie, et n'écrit rien dans `company` ni dans `audit_log`.
11. Non connecté, `/admin/societe` redirige vers `/login`.

Tableau de bord :

12. Affiche un bloc « Exercice » avec les dates au format `JJ/MM/AAAA - JJ/MM/AAAA`.
13. Sans ligne `company`, le bloc affiche « Non configuré ».
14. Après un enregistrement sur `/admin/societe`, le tableau de bord affiche les nouvelles dates.
15. Le message d'accueil et le bouton « Commencer par « Société » » restent en place.

Qualité :

16. `npm run check` passe dans `modern/` (biome, tsc, vitest).

## Comportement legacy gardé

- Accès réservé aux utilisateurs connectés, sans contrôle de rôle.
- Lecture de l'unique ligne `company WHERE id = 1`, valeurs par défaut EUR / 1er janvier – 31 décembre de l'année en cours.
- Libellés, messages d'erreur et de succès mot pour mot (voir le plan).
- Date de fin égale à la date de début refusée.
- Le nom de la société n'est jamais modifié ; création avec `name = 'Ketchup Compta'`.
- Ligne d'audit à chaque enregistrement réussi.
- Après succès, l'utilisateur reste sur la page avec le message.

## Hors périmètre

- Modification du nom de la société.
- SQL concaténé et `db_escape` : remplacés par des requêtes préparées.
- Jeton CSRF fait main : la protection native des server actions suffit.
- Message flash en session + redirection : remplacé par l'état de `useActionState`.
- Réaffichage des valeurs en base après une erreur : **Modern** garde la saisie.
- Format `JJ/MM/AAAA` côté serveur : `<input type="date">` envoie toujours `AAAA-MM-JJ`.
- Page de consultation du journal d'audit.
