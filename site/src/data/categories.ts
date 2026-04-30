export interface Category {
  name: string;
  components: string[];
}

export const CATEGORIES: Category[] = [
  {
    name: 'Containers',
    components: ['card', 'tile', 'list-item', 'accordion'],
  },
  {
    name: 'Disclosure',
    components: ['tabs', 'disclosure', 'segmented-control', 'stepper', 'sidebar-nav'],
  },
  {
    name: 'Inputs',
    components: ['button', 'combobox', 'select', 'search-input', 'tag-input', 'menu-button'],
  },
  {
    name: 'Overlay',
    components: ['modal', 'drawer', 'popover', 'tooltip'],
  },
  {
    name: 'Feedback',
    components: ['alert', 'toast', 'banner', 'link'],
  },
];
