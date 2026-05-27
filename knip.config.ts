import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    'src/components/ui/**',
    'src/components/layout/app-title.tsx',
    'src/tanstack-table.d.ts',
  ],
  ignoreFiles: [
    'src/assets/brand-icons/**',
    'src/components/data-table/**',
    'src/components/date-picker.tsx',
    'src/components/learn-more.tsx',
    'src/components/long-text.tsx',
    'src/components/select-dropdown.tsx',
    'src/components/layout/top-nav.tsx',
    'src/test-utils/tanstack-table.ts',
  ],
  ignoreDependencies: [
    '@radix-ui/react-checkbox',
    '@radix-ui/react-icons',
    '@radix-ui/react-popover',
    '@radix-ui/react-select',
    '@radix-ui/react-switch',
    '@radix-ui/react-tabs',
    'date-fns',
    'react-day-picker',
    'recharts',
  ],
}

export default config
