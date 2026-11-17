# L10 rollback

The L10 layer preserves the existing V3 physics, timeline, routing and data
flow. To roll back its visual changes, restore these files from the supplied
handoff snapshot: `index.html`, `src/style.css`, `src/main.ts`,
`src/boot-screen.ts`, `src/invitation-modal.ts`, `src/data.ts`,
`admin/index.html`, `admin/main.ts`, `public/config/event.json`, and
`config/event.example.json`.

`src/main.before-L09EF-fix.txt` remains untouched as the snapshot's earlier
main-file fallback. The SQL migration is additive and nullable; leaving the
two columns in the database is backward compatible. Remove them only through
an explicitly reviewed database migration.
