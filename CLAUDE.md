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
- A subset (`test-rsvp-*.mjs`, `test-wfl-continuous.mjs`, `test-landing-mobile-flow.mjs`, `test-visual-editor-live-frame.mjs`, `test-visual-editor-static-preview.mjs`, `test-visual-editor-section-switch.mjs`) hit `http://localhost:4173` — run `npm run build:pages && npm run serve:dist` first.

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

**Important**: the admin panel's editing UI (Teks/Foto/Font/Tampilan tabs) is template-agnostic by design — it always edits the same `site_content` JSON shape regardless of which template is active. Template-awareness lives only in (a) the Template tab itself (pick/preview/persist choice) and (b) `main.js` skipping inline color overrides from the Tampilan tab while a template engine is active, so it doesn't fight the template's own CSS variables.

### Admin panel (`admin.html` + `assets/js/admin/*.js`)

`admin/shared.js` is the shared core (Supabase client, auth, tab switching, `buildContentFromConfig()` DB-seeding, `requireTenantAccess()` via RPC `get_my_invitation_access`) used by both `admin.html` and `admin-qr.html`. `admin/admin.js` just wires tab handlers to it. One module per tab: `template.js` (template picker), `content.js` (all-text form), `photos.js` (per-folder upload/reorder/delete, client-side WebP conversion), `editor.js` (single-photo pan/zoom, ratio-matched per folder), `theme.js` (solid colors + overlays), `fonts.js` (per-element typography), `wa-blast.js` (per-contact wa.me links), `wishes.js` (moderation), `section-nav.js` (jump-to-fieldset FAB).

### Visual editor (`assets/js/admin/visual-editor.js` + `assets/js/visual-editor/*.js`)

A live overlay editor rendered inside `admin.html`: it loads the *real* tenant invitation into a same-origin iframe and decorates it with pencil/click targets — no mockup markup. `visual-editor/registry.js` derives click targets from the actually-rendered DOM (`markAutoTargets`, tagging `data-ve-auto="<n>"`) rather than accepting arbitrary selectors, so targets stay stable across template changes. `visual-editor/guest-overrides.js` (`window.applyVisualEditorOverrides`) is the runtime consumer on the guest-facing page: it reads `site_content.content.visualEditor.elements` and applies saved text/typography/button/position/overlay overrides — unedited elements render exactly as the template defines.

### Supabase data flow

Single RPC per page load, `get_invitation({ p_slug })` (`supabase/migrations/0010_multi_tenant_invitations.sql`, extended in `0013_gallery_photo_layout.sql`), returns `{ invitation, content, photos: { <folder>: [...] } }` in one call — deliberately not N separate manifest fetches. Every tenant-owned table (`site_content`, `photos`, `wishes`, `checkins`, `wa_*`) is keyed by `invitation_id` with RLS built around `can_access_invitation()`; `invitation_members` maps users to `admin`/`admin_qr` roles per tenant, plus a `root_owner` JWT `app_metadata.role` flag for cross-tenant provisioning.

Provisioning new tenants goes through the `provision-invitation` Edge Function (`supabase/functions/provision-invitation/index.ts`, service-role, root-owner-only): creates the Auth users + `invitations` row, then clones a static snapshot (`invitation_templates` table, `0015_static_default_template.sql`) into the new tenant's `site_content`/`photos`. `capture_default_template` / `sync_demo` actions manage that snapshot so later edits to the root invitation don't retroactively change already-provisioned clients.

### Build output

`npm run build:pages` assembles `dist/` (gitignored, disposable) from the deployable subset only: root HTML shells, `assets/`, `templates/`, `home/`, `demo/`. Source scripts, tests, migrations, and Edge Functions are intentionally excluded. GitHub Pages serves the result under the custom domain in `CNAME`.
