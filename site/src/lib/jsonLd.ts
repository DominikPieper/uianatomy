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
const PUBLISHER = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_ORIGIN,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_ORIGIN}/brand/wordmark.svg`,
  },
} as const;
const AUTHOR = {
  '@type': 'Person',
  name: 'Dominik Pieper',
} as const;

export type ViewKey = 'designer' | 'dev' | 'bridge';

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

export function siteJsonLd() {
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
          '17-tool MCP server exposing canonical UI component anatomy, axes, slots, transitions, motion, tokens, ' +
          'events, cross-framework mapping, and library implementation audits over Streamable HTTP.',
        url: `${SITE_ORIGIN}/mcp`,
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
      },
    ],
  };
}

export interface ComponentJsonLdInput {
  component: Component;
  view: ViewKey;
  pathname: string;
}

const VIEW_HEADLINE: Record<ViewKey, (name: string) => string> = {
  designer: (name) => `${name} — anatomy, axes, and design tokens`,
  dev: (name) => `${name} — code-side hints, framework map, accessibility contract`,
  bridge: (name) => `${name} — Figma↔code mismatches and common implementation mistakes`,
};

export function componentJsonLd({ component, view, pathname }: ComponentJsonLdInput) {
  const url = `${SITE_ORIGIN}${pathname}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    '@id': `${url}#article`,
    headline: VIEW_HEADLINE[view](component.name),
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
      name: component.name,
      identifier: component.id,
      description: component.description,
      inDefinedTermSet: {
        '@type': 'DefinedTermSet',
        name: 'UI Anatomy canonical components',
        url: SITE_ORIGIN,
      },
    },
    breadcrumb: breadcrumbList([
      { name: 'Components', url: `${SITE_ORIGIN}/` },
      { name: component.name, url },
    ]),
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
