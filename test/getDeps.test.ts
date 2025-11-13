import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// Dynamic flag to control peer deps behavior via mocked vscode config
let includePeer = true

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: (key: string, def: any) => {
        if (key === 'includePeerDependencies')
          return includePeer
        if (key === 'excludePackages')
          return []
        if (key === 'trigger')
          return '_'
        if (key === 'supportedLanguages')
          return ['javascript']
        return def
      },
    }),
  },
}))

// Mock @vscode-use/utils to control environment
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'import-prompter-'))
const currentFile = path.join(tmpRoot, 'src', 'index.ts')

vi.mock('@vscode-use/utils', () => ({
  getCurrentFileUrl: () => currentFile,
  getRootPath: () => tmpRoot,
  watchFiles: (_file: string, _handlers: any) => {
    // return a stop watcher function
    return () => {}
  },
}))

// Write a minimal project structure with package.json
function writePkg(json: any) {
  const pkgPath = path.join(tmpRoot, 'package.json')
  writeFileSync(pkgPath, JSON.stringify(json, null, 2), 'utf-8')
}

beforeAll(() => {
  // ensure src directory exists when findUp walks
  const dir = path.dirname(currentFile)
  // lazy create directory tree
  try {
    require('node:fs').mkdirSync(dir, { recursive: true })
  }
  catch {}
  writeFileSync(currentFile, '// test file', 'utf-8')
})

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('getDeps.getScripts', () => {
  it('returns deps + devDeps + peerDeps when enabled', async () => {
    includePeer = true
    writePkg({
      name: 'fixture',
      version: '1.0.0',
      dependencies: { lodash: '^4.17.21' },
      devDependencies: { vitest: '^1.0.0' },
      peerDependencies: { react: '^18.0.0' },
    })

    const { getScripts, clearAllCaches } = await import('../src/getDeps')
    const result = await getScripts()
    // cleanup caches between tests
    clearAllCaches()

    expect(result).toBeTruthy()
    expect(result).toEqual(expect.arrayContaining(['lodash', 'vitest', 'react']))
  })

  it('excludes peerDeps when disabled by config', async () => {
    includePeer = false
    writePkg({
      name: 'fixture',
      version: '1.0.0',
      dependencies: { lodash: '^4.17.21' },
      devDependencies: { vitest: '^1.0.0' },
      peerDependencies: { react: '^18.0.0' },
    })

    // Re-import module to ensure fresh read and config
    const mod = await import('../src/getDeps')
    const result = await mod.getScripts()
    mod.clearAllCaches()

    expect(result).toBeTruthy()
    expect(result).toEqual(expect.arrayContaining(['lodash', 'vitest']))
    expect(result).not.toEqual(expect.arrayContaining(['react']))
  })
})

describe('getDeps.getScripts monorepo', () => {
  it('includes workspace package names from pnpm-workspace.yaml', async () => {
    // Write pnpm-workspace.yaml
    const wsYaml = `packages:\n  - packages/*\n`
    const wsDir = path.join(tmpRoot, 'packages', 'pkg-a')
    require('node:fs').mkdirSync(wsDir, { recursive: true })
    writeFileSync(path.join(tmpRoot, 'pnpm-workspace.yaml'), wsYaml, 'utf-8')
    // Write package.json for workspace package
    writeFileSync(path.join(wsDir, 'package.json'), JSON.stringify({ name: 'workspace-pkg-a' }, null, 2), 'utf-8')
    // Write root package.json
    writePkg({ name: 'fixture', version: '1.0.0' })

    const { getScripts, clearAllCaches } = await import('../src/getDeps')
    const result = await getScripts()
    clearAllCaches()
    expect(result).toContain('workspace-pkg-a')
  })
})
