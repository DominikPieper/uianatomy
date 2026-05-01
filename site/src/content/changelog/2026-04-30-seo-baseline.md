---
date: "2026-04-30"
title: SEO baseline — JSON-LD, canonical links, sitemap freshness
summary: Per-page TechArticle structured data, view-aware titles + descriptions, sitemap lastmod from canonical lastReviewed dates, robots.txt indexing hygiene, trailing-slash convention.
tags: [seo]
---

A three-phase baseline so search engines see UI Anatomy as the same content from multiple angles, not three near-duplicate pages per component.

**JSON-LD across the site.** New `site/src/lib/jsonLd.ts` builds `WebSite + Organization + WebAPI + SoftwareApplication` for the home graph and `TechArticle` per component, with view-aware headlines, breadcrumbs, and `DefinedTerm` mainEntity. `Base.astro` emits `<link rel="canonical">`, `og:site_name`, `og:locale`, `og:url`, `article:modified_time`, and the JSON-LD script.

**Sitemap freshness.** Sitemap entries now carry per-component `lastmod` from canonical `lastReviewed`, not the build clock. Different components can show different freshness signals.

**Robots hygiene.** `/api/`, `/og/`, `/pagefind/`, `/llms.txt`, `/llms-full.txt`, and `*.md$` are disallowed from general indexing — they're duplicates of the HTML content from a search-engine perspective and would dilute ranking signal. AI agents reach them anyway via `Content-Signal: ai-input=yes`.

**Trailing-slash discipline.** Switched Workers Static Assets to `drop-trailing-slash` so `/components/modal` serves directly with 200 instead of redirecting through `/components/modal/`. Canonical link form, sitemap, and JSON-LD all agree on the no-slash form.
