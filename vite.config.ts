/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import packageInfo from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  define: {
    __VDOC_ADMIN_BUILD_INFO__: JSON.stringify({
      version:
        command === 'build'
          ? process.env.VERSION || `v${packageInfo.version}`
          : 'dev',
      gitCommit: process.env.GIT_COMMIT || 'unknown',
      buildTime: process.env.BUILD_TIME || 'unknown',
    }),
  },
  build: {
    manifest: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'workbench-shell',
              test: /\/src\/components\/layout\/authenticated-layout\.tsx$/,
              includeDependenciesRecursively: true,
              priority: 5,
            },
            {
              name: 'document-workspace',
              test: /\/src\/features\/vdoc-admin\/document-workspace-detail\.tsx$/,
              includeDependenciesRecursively: false,
              priority: 10,
            },
            {
              name: 'bootstrap',
              test: /\/src\/main\.tsx$/,
              includeDependenciesRecursively: true,
              priority: 20,
            },
          ],
        },
      },
    },
  },
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['@radix-ui/react-dropdown-menu'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
    silent: 'passed-only',
    unstubEnvs: true,
    coverage: {
      // include: ['src/**/*.{js,jsx,ts,tsx}'], // Uncomment to expand the report to all src/**/* so untested modules appear as 0% coverage.
      exclude: [
        'src/components/ui/**',
        'src/assets/**',
        'src/tanstack-table.d.ts',
        'src/routeTree.gen.ts',
        'src/test-utils/**',
        'src/routes/**',
      ],
    },
  },
}))
