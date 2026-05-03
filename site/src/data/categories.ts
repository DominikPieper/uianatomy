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
    components: ['tabs', 'disclosure', 'segmented-control', 'stepper', 'sidebar-nav', 'breadcrumbs'],
  },
  {
    name: 'Inputs',
    components: ['button', 'text-input', 'checkbox', 'radio-group', 'switch', 'combobox', 'select', 'search-input', 'tag-input', 'menu-button'],
  },
  {
    name: 'Overlay',
    components: ['modal', 'drawer', 'popover', 'tooltip'],
  },
  {
    name: 'Feedback',
    components: ['alert', 'toast', 'banner', 'link', 'skeleton'],
  },
  {
    name: 'Identity',
    components: ['avatar', 'avatar-group'],
  },
  {
    name: 'Display',
    components: ['badge', 'icon'],
  },
];
