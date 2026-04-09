import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/unit/**/*.test.{ts,tsx}'],
    exclude: ['src/test/e2e/**'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/utils/cn.ts',
        'src/lib/auth/upsert-user.ts',
        'src/app/(auth)/login/actions.ts',
        'src/app/(auth)/signup/actions.ts',
        'src/app/auth/callback/route.ts',
        'src/app/(auth)/login/LoginFormInner.tsx',
        'src/app/(auth)/signup/SignupFormInner.tsx',
        'src/components/auth/GitHubButton.tsx',
        'src/components/projects/ProjectCard.tsx',
        'middleware.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'server-only': resolve(__dirname, './src/test/stubs/server-only.ts'),
    },
  },
})
