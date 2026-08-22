# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Undangan pernikahan digital — vanilla HTML/CSS/JS (no framework, no bundler), backed by Supabase. Originally single-tenant (one couple), now **multi-tenant** (`/​<slug>/`) with a **multi-template** system and a template-agnostic admin panel per tenant. `docs/rencana-admin-panel.md` is the original design doc for the admin+Supabase migration — it has been fully implemented; treat it as historical background, not a current spec (the live code and migrations are the source of truth).

## Commands

```bash
npm run serve          # http-server on :8080, serves repo root (source tree, no build)
npm run build:pages    # scripts/build-pages-dist.mjs → assembles dist/ (gitignored artifact)
npm run serve:dist     # http-server dist/ on :4173 (what e2e tests hit)
npm run verify         # scripts/verify-with-playwright.mjs — visual diff vs reference site
node scripts/build-manifests.mjs   # regenerate per-folder photo manifest.json after adding local images
```

On Windows, if `build:pages` fails with `EBUSY` on `dist/`, use `node scripts/build-pages-dist-safe.mjs` instead (same output, clears `dist/`'s contents instead of removing the directory handle).

There is no `npm test` runner. Tests are individual scripts under `scripts/test-*.mjs`, run directly with `node scripts/test-<name>.mjs`:
- Most are static contract checks (read source files, assert patterns survive refactors) or self-contained Playwright checks (`page.setContent(...)`, no server needed) — run anytime.
- A subset (`test-rsvp-*.mjs`, `test-wfl-continuous.mjs`, `test-landing-mobile-flow.mjs`) hit `http://localhost:4173` — run `npm run build:pages && npm run serve:dist` first.
  Update (admin v2 rewrite, commit `f9977cc`): removed 11 scripts that tested the old tab-based `assets/js/admin/*.js` panel directly, now dead code (this included `test-visual-editor-live-frame.mjs` and `test-visual-editor-static-preview.mjs`, both formerly in the `localhost:4173` subset above — see the "No replacement" bullet below). Where the admin panel was rewritten (`assets/js/panel/*.js`, see `docs/rencana-admin-v2.md`), not deleted — 3 had no live replacement (concept gone), 3 were folded into the generic `scripts/test-admin-v2-contract.mjs` static check, and 5 were recreated targeting the new files (`docs/rencana-admin-v2-revisi.md` R3):
  - No replacement (feature/markup itself is gone): `test-section-nav-no-gift-recs.mjs` (FAB lompat-section → separate pages now), `test-visual-editor-live-frame.mjs`, `test-visual-editor-static-preview.mjs` (their `scripts/visual-editor-harness.html` fixture loaded the deleted `assets/js/admin/visual-editor.js`).
  - Folded into `test-admin-v2-contract.mjs`: `test-admin-completion-contract.mjs`.
  - Recreated for the new `panel/*.js` files: `test-photo-editor-zoom-pan.mjs` → `test-panel-photo-editor.mjs`; `test-photo-layout-contract.mjs` + `test-gallery-admin-widths.mjs` → `test-panel-photo-layout.mjs`; `test-font-panel-browser.mjs` → `test-panel-font-page.mjs`; `test-wish-block-list.mjs` + `test-wish-toolbar-layout.mjs` + `test-wishes-page-size.mjs` + `test-wishes-actions-export.mjs` → `test-panel-wishes.mjs` (the last two weren't in `docs/rencana-admin-v2-revisi.md`'s R3 table at all — a gap in that doc, not intentional; their coverage — page-size dropdown, refresh/delete-all/CSV/PNG export — still applied to the rewritten `pages/ucapan.js`, so it was folded in here instead of staying lost); `test-visual-editor-core.mjs` → `test-panel-visual-editor.mjs`.
  - `test-visual-editor-section-switch.mjs` was already stale *before* the rewrite (tested a `#ve-section` dropdown that never existed in the last version of `assets/js/admin/visual-editor.js`) — removed, no replacement (v2's Editor Visual is intentionally one scrollable preview, no section switch).
  - `assets/css/admin.css` (dark theme) is gone too (R2 of the revisi doc) — `admin-qr.html` and `register.html` now use `assets/css/panel.css` like the rest of admin. The old tab/panel markup in `admin-qr.html` is kept (its JS hooks — `core.js`'s `.tab`/`.panel` query-selectors, `admin-qr.js`'s direct `#tab-checkin` hidden check — are structural, not just styling), just restyled with panel.css tokens.

Per user preference: do not run Playwright/screenshot/tunnel verification yourself — the user tests on their own phone. Don't spin up `cloudflared` tunnels or take screenshots as a substitute for asking the user to check.

## Architecture

### Config vs. Supabase content

All copy/data used to live in `assets/js/config.js` (`window.WEDDING_CONFIG`) with photos in `assets/img/<folder>/manifest.json`. That's now the **offline fallback only** — the real source of truth per tenant is Supabase (`site_content` table, `photos` table). Load order: RPC `get_invitation` → `localStorage['wedding_invitation_v2_<slug>']` cache → `WEDDING_CONFIG` + local manifests, in that order of preference. Never delete `assets/img/` or `config.js` — they're the last-resort fallback if Supabase is unreachable.

### Multi-tenant routing

Two parallel implementations of the same routing rules — keep them in sync when changing route shape:
- `scripts/tenant-routing.mjs` — pure, unit-tested (`test/tenant-routing.test.mjs`): `parseInvitationRoute`, `invitationPath`, `storagePath`, `qrBelongsToInvitation`.
- `assets/js/tenant.js` — runtime version, builds `window.TenantContext` (`.slug`, `.surface`, `.basePath`, `.path(kind)`, `.storagePath(filename)`).

Path shape: `/` or `/<slug>/` = invitation, `/<slug>/admin/` = tenant admin, `/<slug>/admin-qr/` = QR check-in surface. Root-level `/admin/` and `/admin-qr/` (no slug) resolve to `slug: "root"` — the original single-tenant invitation is just the tenant whose slug is `"root"`. GitHub Pages can't do real path routing for a static site, so `404.html` redirects unknown pretty paths back through `?__tenant_route=...`, which `tenant.js` unpacks and then cleans from the URL via `history.replaceState`.

Storage isolation is also slug-prefixed: `storagePath(slug, filename)` → `<slug>/<filename>`, enforced both client-side and by Supabase Storage RLS (`storage.foldername(name)[1]` must match an accessible invitation).

### Template system (`assets/js/template-engine.js`)

`window.loadTemplate(...)` fetches a `templates/<id>.json` manifest — `{ id, name, version, css, js, fonts[], theme{ --color-*, --font-*: value } }` — and applies it: swaps `style.css` for `tpl.css` (if set; `null` means "use the base template," currently Classic Elegance), executes `tpl.js` as an IIFE via `new Function()` (may return a cleanup callback, invoked on template switch), and writes `theme` entries as CSS custom properties on `documentElement`.

**A new template must ship a CSS file that fully replaces `style.css`** — it is not layered on top, it's a swap — covering the app-frame, modals, FAB, and every section, plus optionally a JS override file.

Selection order: `?template=xxx` query param (used by the admin Preview button) → tenant's saved `site_content.content.template` (set via the admin Template tab) → default. This is per-tenant state in Supabase, not per-template code changes.

**Important**: the admin panel's editing pages (Isi Undangan / Tampilan groups) are template-agnostic by design — they always edit the same `site_content` JSON shape regardless of which template is active. Template-awareness lives only in (a) the Template page itself (pick/preview/persist choice) and (b) `main.js` skipping inline color overrides from the Warna page while a template engine is active, so it doesn't fight the template's own CSS variables.

### Admin panel v2 (`admin.html` + `assets/js/panel/*.js`)

Rewritten from a tab-based single page (see `docs/rencana-admin-v2.md` for the full design rationale) into a **hash-routed, one-page-per-destination** app: `#/`, `#/mempelai`, `#/acara`, … — still one static shell (`admin.html`), no path routing changes needed. `panel/core.js` is the shared core (Supabase client, auth, `buildContentFromConfig()` DB-seeding, `requireTenantAccess()`) — also used by `admin-qr.html` and `wa.html` via `assets/js/admin/shared.js`, now a thin compatibility shim that loads `core.js`. `panel/store.js` is the **single door** for reading/writing `site_content` (SELECT → patch only the requested top-level keys → UPSERT — no page calls `.upsert("site_content")` itself). `panel/router.js` mounts/destroys page modules into `#p-outlet-inner`, renders BOTH navigation surfaces — the numbered chapter strip (primary, all viewports; chapters 01–09 follow the guest-facing section order of index.html) and the parent-child sidebar (`Bab undangan` / `Tamu` / `Tampilan & setelan`; permanent column ≥1024px, hamburger drawer below) — plus the Ringkasan home (launch checklist) and owns dirty-tracking + the floating save bar. `panel/ui.js` has HTML-builder helpers (field/card/badge/icon/color-pair sync) and `panel/photos.js` is the reusable per-folder photo manager (upload/WebP-convert/reorder/pan-zoom) mounted by whichever page owns that folder — e.g. Mempelai mounts it twice (bride + groom).

Each destination is one file in `assets/js/panel/pages/*.js` registering itself on `window.PanelPages[key] = { title, group, icon, mount(outlet), destroy() }`; `router.js`'s `CHAPTERS`/`TOOLS`/`SIDEBAR_GROUPS` manifests decide both navigation surfaces. "Kirim WhatsApp" and "Check-in QR" are plain links to the separate `wa.html`/`admin-qr.html` surfaces, not `PanelPages` entries. `scripts/test-admin-v2-contract.mjs` statically checks the migration is complete (no leftover tab markup, every `PanelPages` entry well-formed, every legacy `site_content` field has a page).

### Visual editor (`assets/js/panel/pages/editor-visual.js` + `assets/js/visual-editor/*.js`)

A live overlay editor rendered inside `admin.html`: it loads the *real* tenant invitation into a same-origin iframe and decorates it with pencil/click targets — no mockup markup. `visual-editor/registry.js` derives click targets from the actually-rendered DOM (`markAutoTargets`, tagging `data-ve-auto="<n>"`) rather than accepting arbitrary selectors, so targets stay stable across template changes. `visual-editor/guest-overrides.js` (`window.applyVisualEditorOverrides`) is the runtime consumer on the guest-facing page: it reads `site_content.content.visualEditor.elements` and applies saved text/typography/button/position/overlay overrides — unedited elements render exactly as the template defines.

### Supabase data flow

Single RPC per page load, `get_invitation({ p_slug })` (`supabase/migrations/0010_multi_tenant_invitations.sql`, extended in `0013_gallery_photo_layout.sql`), returns `{ invitation, content, photos: { <folder>: [...] } }` in one call — deliberately not N separate manifest fetches. Every tenant-owned table (`site_content`, `photos`, `wishes`, `checkins`, `wa_*`) is keyed by `invitation_id` with RLS built around `can_access_invitation()`; `invitation_members` maps users to `admin`/`admin_qr` roles per tenant, plus a `root_owner` JWT `app_metadata.role` flag for cross-tenant provisioning.

Provisioning new tenants goes through the `provision-invitation` Edge Function (`supabase/functions/provision-invitation/index.ts`, service-role, root-owner-only): creates the Auth users + `invitations` row, then clones a static snapshot (`invitation_templates` table, `0015_static_default_template.sql`) into the new tenant's `site_content`/`photos`. `capture_default_template` / `sync_demo` actions manage that snapshot so later edits to the root invitation don't retroactively change already-provisioned clients.

### Build output

`npm run build:pages` assembles `dist/` (gitignored, disposable) from the deployable subset only: root HTML shells, `assets/`, `templates/`, `home/`, `demo/`. Source scripts, tests, migrations, and Edge Functions are intentionally excluded. GitHub Pages serves the result under the custom domain in `CNAME`.
