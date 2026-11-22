import { defineConfig } from '@theodo/bernard/config'

// Every field is described in docs/overlay.md. The ones left out take the core's defaults.
export default defineConfig({
  harness: 'claude-code',
  defaultPipeline: 'page-migration',
  project: { name: 'Ketchup Compta', language: 'French' },
  paths: { features: 'docs/features', scratch: 'tmp/factory' },
  adapters: {
    forge: { type: 'github' },
    runner: {
      type: 'local',
      worktree: {
        // The worktree shares the main checkout's .factory install, whose link points to the local bernard clone.
        setup:
          'ln -sfn "$(git rev-parse --path-format=absolute --git-common-dir)/../.factory/node_modules" .factory/node_modules && npm --prefix modern ci',
      },
    },
  },
})
