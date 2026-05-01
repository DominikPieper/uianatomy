---
date: "2026-05-01"
title: SEO + AI-discovery hardening
summary: FAQPage JSON-LD, Schema.org Dataset, Organization sameAs, AI-bot allowlists in robots.txt, top-level DefinedTermSet, IndexNow ping at deploy, public /methodology page.
tags: [seo, ai-discovery]
---

A coordinated push to surface UI Anatomy to both classical search engines and AI answer engines (Perplexity, ChatGPT, Claude, Gemini).

**Citation surface.** Every component page now emits a `FAQPage` graph alongside `TechArticle` JSON-LD, with question/answer pairs derived from the canonical `whenToUse` prose, related-component differentiators, and documented common mistakes. Modal alone exposes ten Q/A pairs that AI extractors can quote verbatim.

**Dataset positioning.** The site root now declares a `Dataset` graph node with three `DataDownload` distributions — the JSON catalogue at `/api/components.json`, the full Markdown corpus at `/llms-full.txt`, and the index at `/llms.txt`. Authority signals ship via `Organization.sameAs` and `Person.sameAs` pointing at the public GitHub repo.

**Crawler differentiation.** `robots.txt` keeps the duplicate-suppressing `Disallow` set for general crawlers but explicitly allows PerplexityBot, GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-Web, Google-Extended, and CCBot to crawl `/api/`, `/llms.txt`, `/llms-full.txt`, and the per-page Markdown sidecars — exactly the surfaces designed for AI ingestion.

**Ontology resolution.** The `DefinedTermSet` is now a top-level graph node with `hasDefinedTerm[]` listing every canonical component, sorted alphabetically. Component pages reference the set via `@id` back-link instead of an inline stub, so the canon resolves as a controlled vocabulary rather than 23 disconnected definitions.

**Active discovery.** Deploys now ping IndexNow with the full sitemap URL list, accelerating index updates on Bing, Yandex, Seznam, and Naver.

**E-E-A-T surface.** `/methodology` is now a public page rendering `docs/methodology.md` directly — the same canonical prose that contributors read internally. Author and publisher are emitted as `AboutPage` + `TechArticle` JSON-LD with `sameAs` links.
