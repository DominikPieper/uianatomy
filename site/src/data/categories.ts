export interface Category {
  name: string;
  components: string[];
}

export const CATEGORIES: Category[] = [
  {
    name: 'Containers',
    components: ['card', 'tile', 'list-item', 'accordion', 'grid-pattern'],
  },
  {
    name: 'Disclosure',
    components: ['tabs', 'disclosure', 'segmented-control', 'stepper', 'sidebar-nav', 'breadcrumbs', 'pagination'],
  },
  {
    name: 'Inputs',
    components: ['button', 'text-input', 'textarea', 'checkbox', 'radio-group', 'switch', 'combobox', 'select', 'search-input', 'tag-input', 'menu-button'],
  },
  {
    name: 'Overlay',
    components: ['modal', 'drawer', 'popover', 'tooltip', 'menu'],
  },
  {
    name: 'Feedback',
    components: ['alert', 'toast', 'banner', 'link', 'skeleton', 'progress'],
  },
  {
    name: 'Data',
    components: ['table', 'tree-grid'],
  },
  {
    name: 'Identity',
    components: ['avatar', 'avatar-group'],
  },
  {
    name: 'Display',
    components: ['badge', 'icon', 'code-block'],
  },
];
