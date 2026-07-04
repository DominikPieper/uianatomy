// JSON-LD builders for search-engine structured data.
//
// One function per page archetype. Each returns a plain object that
// callers stringify into a `<script type="application/ld+json">` tag.
// All builders use the absolute production origin so structured data
// is consistent regardless of which preview / branch URL the crawler
// hits.

import type { Component } from '@uianatomy/shared/schema';

const SITE_ORIGIN = 'https://uianatomy.dev';
const SITE_NAME = 'UI Anatomy';
const SITE_DESCRIPTION =
  'Canonical reference for UI component anatomy — the same truth in three views (designer, developer, bridge), queryable via MCP and a JSON API.';
const REPO_URL = 'https://github.com/DominikPieper/uianatomy';
const PUBLISHER = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_ORIGIN,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_ORIGIN}/brand/wordmark.svg`,
  },
  sameAs: [REPO_URL],
} as const;
const AUTHOR = {
  '@type': 'Person',
  name: 'Dominik Pieper',
  url: 'https://github.com/DominikPieper',
  sameAs: ['https://github.com/DominikPieper'],
} as const;

export interface BreadcrumbItem {
  name: string;
  url: string;
}

function breadcrumbList(items: BreadcrumbItem[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface SiteJsonLdInput {
  components?: Component[];
}

export function siteJsonLd({ components }: SiteJsonLdInput = {}) {
  const termSet = components && components.length > 0
    ? {
        '@type': 'DefinedTermSet',
        '@id': `${SITE_ORIGIN}/#term-set`,
        name: 'UI Anatomy canonical components',
        description:
          'A controlled vocabulary of canonical UI component definitions. Each term is an idealised, ' +
          'library-agnostic component anatomy — slots, axes, mismatches, and cross-framework expression.',
        url: SITE_ORIGIN,
        inLanguage: 'en-US',
        hasDefinedTerm: components
          .map((c) => ({
            '@type': 'DefinedTerm',
            '@id': `${SITE_ORIGIN}/components/${c.id}#term`,
            identifier: c.id,
            name: c.name,
            ...(c.alternateNames && c.alternateNames.length > 0
              ? { alternateName: c.alternateNames }
              : {}),
            description: c.description,
            url: `${SITE_ORIGIN}/components/${c.id}`,
            inDefinedTermSet: { '@id': `${SITE_ORIGIN}/#term-set` },
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }
    : null;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        url: SITE_ORIGIN,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_ORIGIN}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
        inLanguage: 'en-US',
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: SITE_NAME,
        url: SITE_ORIGIN,
        logo: PUBLISHER.logo,
        sameAs: [REPO_URL],
        founder: AUTHOR,
      },
      {
        '@type': 'WebAPI',
        '@id': `${SITE_ORIGIN}/api/components.json#api`,
        name: 'UI Anatomy components JSON API',
        description:
          'Read-only JSON API exposing every canonical component schema. Each component is also reachable as ' +
          '/api/components/<id>.json.',
        url: `${SITE_ORIGIN}/api/components.json`,
        documentation: `${SITE_ORIGIN}/.well-known/api-catalog`,
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_ORIGIN}/mcp#mcp-server`,
        name: 'UI Anatomy MCP server',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Cross-platform (HTTP)',
        description:
          '19-tool MCP server exposing canonical UI component anatomy, axes, slots, transitions, motion, tokens, ' +
          'events, cross-framework mapping, library implementation audits, and changelog metadata over Streamable HTTP.',
        url: `${SITE_ORIGIN}/mcp`,
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
      },
      {
        '@type': 'Dataset',
        '@id': `${SITE_ORIGIN}/#dataset`,
        name: 'UI Anatomy canonical component dataset',
        description:
          'Machine-readable canonical schemas for the UI Anatomy roster — anatomy slots, axes (variants, ' +
          'properties, states, transitions), Figma↔code mismatches, cross-framework mapping, motion, responsive ' +
          'behaviour, events, accessibility acceptance, and library audits. Each component is identified by a ' +
          'kebab-case id and validated by a single Zod schema.',
        url: SITE_ORIGIN,
        creator: { '@id': `${SITE_ORIGIN}/#organization` },
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        isAccessibleForFree: true,
        keywords: [
          'UI components',
          'design system',
          'component anatomy',
          'accessibility',
          'Figma',
          'React',
          'Vue',
          'Angular',
          'web components',
          'MCP',
          'agent skills',
        ],
        distribution: [
          {
            '@type': 'DataDownload',
            encodingFormat: 'application/json',
            contentUrl: `${SITE_ORIGIN}/api/components.json`,
            name: 'Components index (JSON)',
          },
          {
            '@type': 'DataDownload',
            encodingFormat: 'application/json',
            contentUrl: `${SITE_ORIGIN}/api/patterns.json`,
            name: 'Patterns index (JSON)',
          },
          {
            '@type': 'DataDownload',
            encodingFormat: 'text/markdown',
            contentUrl: `${SITE_ORIGIN}/llms-full.txt`,
            name: 'Full canon as Markdown (llms-full.txt)',
          },
          {
            '@type': 'DataDownload',
            encodingFormat: 'text/markdown',
            contentUrl: `${SITE_ORIGIN}/llms.txt`,
            name: 'Canon index as Markdown (llms.txt)',
          },
        ],
      },
      ...(termSet ? [termSet] : []),
    ],
  };
}

export interface ComponentJsonLdInput {
  component: Component;
  pathname: string;
}

// ADR-038 — one page per component now; the headline covers the union of
// what the three retired per-view headlines used to say separately.
function componentHeadline(name: string): string {
  return `${name} — anatomy, axes, Figma↔code mismatches, and cross-framework mapping`;
}

function faqEntries(component: Component): Array<{ q: string; a: string }> {
  const entries: Array<{ q: string; a: string }> = [];
  if (component.whenToUse?.use) {
    entries.push({
      q: `When should I use ${component.name}?`,
      a: component.whenToUse.use,
    });
  }
  if (component.whenToUse?.avoid) {
    entries.push({
      q: `When should I avoid ${component.name}?`,
      a: component.whenToUse.avoid,
    });
  }
  for (const rel of component.whenToUse?.vsRelated ?? []) {
    entries.push({
      q: `How does ${component.name} differ from ${rel.id}?`,
      a: rel.difference,
    });
  }
  for (const m of component.mistakes) {
    entries.push({
      q: `${m.title} — how do I fix it on ${component.name}?`,
      a: `${m.description} ${m.fix}`.trim(),
    });
  }
  return entries;
}

function faqPage(component: Component, url: string) {
  const entries = faqEntries(component);
  if (entries.length === 0) return undefined;
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    isPartOf: { '@id': `${url}#article` },
    inLanguage: 'en-US',
    mainEntity: entries.map((e) => ({
      '@type': 'Question',
      name: e.q,
      acceptedAnswer: { '@type': 'Answer', text: e.a },
    })),
  };
}

export function componentJsonLd({ component, pathname }: ComponentJsonLdInput) {
  const url = `${SITE_ORIGIN}${pathname}`;
  const article = {
    '@type': 'TechArticle',
    '@id': `${url}#article`,
    headline: componentHeadline(component.name),
    description: component.description,
    url,
    inLanguage: 'en-US',
    image: `${SITE_ORIGIN}/og${pathname}.png`,
    datePublished: component.lastReviewed ?? undefined,
    dateModified: component.lastReviewed ?? undefined,
    author: AUTHOR,
    publisher: PUBLISHER,
    isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
    mainEntity: {
      '@type': 'DefinedTerm',
      '@id': `${url}#term`,
      name: component.name,
      ...(component.alternateNames && component.alternateNames.length > 0
        ? { alternateName: component.alternateNames }
        : {}),
      identifier: component.id,
      description: component.description,
      inDefinedTermSet: { '@id': `${SITE_ORIGIN}/#term-set` },
    },
    breadcrumb: breadcrumbList([
      { name: 'Components', url: `${SITE_ORIGIN}/` },
      { name: component.name, url },
    ]),
  };
  const faq = faqPage(component, url);
  const graph = faq ? [article, faq] : [article];
  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export interface CompareJsonLdInput {
  pathname: string;
}

export function compareJsonLd({ pathname }: CompareJsonLdInput) {
  const url = `${SITE_ORIGIN}${pathname}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: 'Compare components — UI Anatomy',
    description:
      'Side-by-side anatomy and axes diff for two canonical UI Anatomy components. Surfaces required-slot deltas, ' +
      'variant differences, schema-section presence, axe-rule overlap, and the canon-pinned vsRelated prose.',
    isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
    breadcrumb: breadcrumbList([
      { name: 'Components', url: `${SITE_ORIGIN}/` },
      { name: 'Compare', url },
    ]),
  };
}

export function searchPageJsonLd({ pathname }: { pathname: string }) {
  const url = `${SITE_ORIGIN}${pathname}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: 'Search — UI Anatomy',
    description:
      'Full-text search across the UI Anatomy canon — components, slots, mismatches, mistakes, accessibility ' +
      'acceptance, framework mappings.',
    isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
    breadcrumb: breadcrumbList([
      { name: 'Components', url: `${SITE_ORIGIN}/` },
      { name: 'Search', url },
    ]),
  };
}
