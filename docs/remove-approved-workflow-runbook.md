# Remove `APPROVED` Workflow Stage

This runbook removes `APPROVED` as an operational order stage without immediately changing the Prisma enum. The goal is to protect production data first, then clean the schema in a second phase.

## Scope

Phase 1 does this:

- stops new orders from moving into `APPROVED`
- treats payment approval as entry into `IN_PRODUCTION`
- migrates current `Order.status = APPROVED` rows to `IN_PRODUCTION`
- moves any custom workflow requirements from `APPROVED` to `IN_PRODUCTION`
- keeps `OrderHistory.status = APPROVED` unchanged for audit preservation

Phase 1 does not do this:

- remove `APPROVED` from the Prisma enum
- rewrite historical `OrderHistory` entries

## Backup First

1. Create a Neon branch in the Neon console before touching production.
2. Use a direct Neon connection string for `pg_dump`.
3. Store the dump file outside the deploy artifact.

If your local `.env` only has a pooled Neon URL, add a direct URL to:

- `DIRECT_DATABASE_URL`, or
- `DATABASE_URL_UNPOOLED`

Run the backup:

```bash
npm run backup:neon
```

Optional custom output file:

```bash
npm run backup:neon -- backups/pre-remove-approved.dump
```

## Dry Run

Preview current data and template impact:

```bash
npm run workflow:remove-approved:dry
```

This prints:

- order counts by status
- existing workflow template rows for `APPROVED` and `IN_PRODUCTION`

## Execute Migration

Once backup is completed and the dry run looks correct:

```bash
npm run workflow:remove-approved
```

This will:

- update all `Order.status = APPROVED` rows to `IN_PRODUCTION`
- merge custom requirement templates from `APPROVED` into `IN_PRODUCTION`
- delete the `APPROVED` template row

## Validate

Check these after execution:

1. No active order remains in `APPROVED`.
2. `Order Management` no longer shows `Approved` as a workflow stage.
3. `Production Schedule` only shows `In Production`.
4. Admin and dealer dashboards no longer count `Approved`.
5. Approving payment moves a pending order directly into `In Production`.
6. Workflow Requirements page starts at `In Production`.

## Phase 2

After a stable period in production:

1. decide whether `OrderHistory.status = APPROVED` should remain as legacy audit data
2. remove `APPROVED` from the Prisma enum
3. create and deploy the enum cleanup migration
