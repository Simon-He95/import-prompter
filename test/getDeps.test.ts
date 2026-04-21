import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

interface ImportCandidate {
  name: string
  source: string
}

// Dynamic flag to control peer deps behavior via mocked vscode config
let includePeer = true
const watchedFiles: string[] = []
const stoppedWatchers: string[] = []
const tmpRootA = mkdtempSync(path.join(tmpdir(), 'import-prompter-a-'))
const tmpRootB = mkdtempSync(path.join(tmpdir(), 'import-prompter-b-'))
let activeRoot = tmpRootA
let currentFile = path.join(activeRoot, 'src', 'index.ts')
const fileSystemWatchers: {
  globPattern: { base: string, pattern: string }
  createHandlers: Array<() => void>
  changeHandlers: Array<() => void>
  deleteHandlers: Array<() => void>
  disposed: boolean
}[] = []

vi.mock('vscode', () => ({
  RelativePattern: class RelativePattern {
    base: string
    pattern: string

    constructor(base: string, pattern: string) {
      this.base = base
      this.pattern = pattern
    }
  },
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
    createFileSystemWatcher: (globPattern: { base: string, pattern: string }) => {
      const watcher = {
        globPattern,
        createHandlers: [] as Array<() => void>,
        changeHandlers: [] as Array<() => void>,
        deleteHandlers: [] as Array<() => void>,
        disposed: false,
        onDidCreate(handler: () => void) {
          watcher.createHandlers.push(handler)
          return { dispose: () => {} }
        },
        onDidChange(handler: () => void) {
          watcher.changeHandlers.push(handler)
          return { dispose: () => {} }
        },
        onDidDelete(handler: () => void) {
          watcher.deleteHandlers.push(handler)
          return { dispose: () => {} }
        },
        dispose() {
          watcher.disposed = true
        },
      }
      fileSystemWatchers.push(watcher)
      return watcher
    },
  },
}))

// Mock @vscode-use/utils to control environment
vi.mock('@vscode-use/utils', () => ({
  getCurrentFileUrl: () => currentFile,
  getRootPath: () => activeRoot,
  watchFile: (file: string, _handlers: any) => {
    watchedFiles.push(file)
    return () => {
      stoppedWatchers.push(file)
    }
  },
}))

// Write a minimal project structure with package.json
function writePkg(root: string, json: any) {
  const pkgPath = path.join(root, 'package.json')
  writeFileSync(pkgPath, JSON.stringify(json, null, 2), 'utf-8')
}

function resetRoot(root: string) {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(path.join(root, 'src'), { recursive: true })
  writeFileSync(path.join(root, 'src', 'index.ts'), '// test file', 'utf-8')
}

function setActiveRoot(root: string) {
  activeRoot = root
  currentFile = path.join(root, 'src', 'index.ts')
}

function setActiveFile(file: string) {
  currentFile = file
}

function triggerWorkspacePackageCreate(base: string) {
  for (const watcher of fileSystemWatchers) {
    if (watcher.globPattern.base === base) {
      watcher.createHandlers.forEach(handler => handler())
    }
  }
}

function candidateNames(result: ImportCandidate[] | undefined) {
  return (result ?? []).map(item => item.name)
}

function candidateSource(result: ImportCandidate[] | undefined, name: string) {
  return result?.find(item => item.name === name)?.source
}

beforeAll(() => {
  resetRoot(tmpRootA)
  resetRoot(tmpRootB)
})

beforeEach(() => {
  vi.resetModules()
  includePeer = true
  watchedFiles.length = 0
  stoppedWatchers.length = 0
  fileSystemWatchers.length = 0
  resetRoot(tmpRootA)
  resetRoot(tmpRootB)
  setActiveRoot(tmpRootA)
})

afterAll(() => {
  rmSync(tmpRootA, { recursive: true, force: true })
  rmSync(tmpRootB, { recursive: true, force: true })
})

describe('getDeps.getScripts', () => {
  it('returns deps + devDeps + peerDeps when enabled', async () => {
    includePeer = true
    writePkg(tmpRootA, {
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
    expect(candidateNames(result)).toEqual(expect.arrayContaining(['lodash', 'vitest', 'react']))
    expect(candidateSource(result, 'lodash')).toBe('dependency')
    expect(candidateSource(result, 'react')).toBe('peerDependency')
    expect(candidateSource(result, 'vitest')).toBe('devDependency')
    expect(watchedFiles).toContain(path.join(tmpRootA, 'package.json'))
    expect(stoppedWatchers).toContain(path.join(tmpRootA, 'package.json'))
  })

  it('excludes peerDeps when disabled by config', async () => {
    includePeer = false
    writePkg(tmpRootA, {
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
    expect(candidateNames(result)).toEqual(expect.arrayContaining(['lodash', 'vitest']))
    expect(candidateNames(result)).not.toEqual(expect.arrayContaining(['react']))
  })
})

describe('getDeps.getScripts monorepo', () => {
  it('includes workspace package names from pnpm-workspace.yaml', async () => {
    // Write pnpm-workspace.yaml
    const wsYaml = `packages:\n  - packages/*\n`
    const wsDir = path.join(tmpRootA, 'packages', 'pkg-a')
    mkdirSync(wsDir, { recursive: true })
    writeFileSync(path.join(tmpRootA, 'pnpm-workspace.yaml'), wsYaml, 'utf-8')
    // Write package.json for workspace package
    writeFileSync(path.join(wsDir, 'package.json'), JSON.stringify({ name: 'workspace-pkg-a' }, null, 2), 'utf-8')
    // Write root package.json
    writePkg(tmpRootA, { name: 'fixture', version: '1.0.0' })

    const { getScripts, clearAllCaches } = await import('../src/getDeps')
    const result = await getScripts()
    clearAllCaches()
    expect(candidateNames(result)).toContain('workspace-pkg-a')
    expect(candidateSource(result, 'workspace-pkg-a')).toBe('workspace')
    expect(watchedFiles).toEqual(expect.arrayContaining([
      path.join(tmpRootA, 'package.json'),
      path.join(tmpRootA, 'pnpm-workspace.yaml'),
    ]))
  })

  it('keeps workspace package cache isolated per root', async () => {
    const wsYaml = `packages:\n  - packages/*\n`
    const pkgADir = path.join(tmpRootA, 'packages', 'pkg-a')
    const pkgBDir = path.join(tmpRootB, 'packages', 'pkg-b')
    mkdirSync(pkgADir, { recursive: true })
    mkdirSync(pkgBDir, { recursive: true })
    writeFileSync(path.join(tmpRootA, 'pnpm-workspace.yaml'), wsYaml, 'utf-8')
    writeFileSync(path.join(tmpRootB, 'pnpm-workspace.yaml'), wsYaml, 'utf-8')
    writeFileSync(path.join(pkgADir, 'package.json'), JSON.stringify({ name: 'workspace-pkg-a' }, null, 2), 'utf-8')
    writeFileSync(path.join(pkgBDir, 'package.json'), JSON.stringify({ name: 'workspace-pkg-b' }, null, 2), 'utf-8')
    writePkg(tmpRootA, { name: 'fixture-a', version: '1.0.0' })
    writePkg(tmpRootB, { name: 'fixture-b', version: '1.0.0' })

    const { getScripts, clearAllCaches } = await import('../src/getDeps')

    setActiveRoot(tmpRootA)
    const resultA = await getScripts()

    setActiveRoot(tmpRootB)
    const resultB = await getScripts()

    clearAllCaches()

    expect(candidateNames(resultA)).toContain('workspace-pkg-a')
    expect(candidateNames(resultA)).not.toContain('workspace-pkg-b')
    expect(candidateNames(resultB)).toContain('workspace-pkg-b')
    expect(candidateNames(resultB)).not.toContain('workspace-pkg-a')
  })

  it('resolves the nearest package.json when switching from root files to nested packages', async () => {
    const nestedSrcFile = path.join(tmpRootA, 'packages', 'feature-a', 'src', 'index.ts')
    mkdirSync(path.dirname(nestedSrcFile), { recursive: true })
    writeFileSync(nestedSrcFile, '// nested test file', 'utf-8')
    writePkg(tmpRootA, {
      name: 'workspace-root',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    })
    writePkg(path.join(tmpRootA, 'packages', 'feature-a'), {
      name: 'feature-a',
      version: '1.0.0',
      dependencies: { vue: '^3.0.0' },
    })

    const { getScripts, clearAllCaches } = await import('../src/getDeps')

    setActiveRoot(tmpRootA)
    setActiveFile(path.join(tmpRootA, 'src', 'index.ts'))
    const rootResult = await getScripts()

    setActiveFile(nestedSrcFile)
    const nestedResult = await getScripts()

    clearAllCaches()

    expect(candidateNames(rootResult)).toContain('react')
    expect(candidateNames(rootResult)).not.toContain('vue')
    expect(candidateNames(nestedResult)).toEqual(expect.arrayContaining(['react', 'vue']))
  })

  it('re-resolves the current root when a nearer package.json is added later', async () => {
    const nestedSrcFile = path.join(tmpRootA, 'packages', 'feature-b', 'src', 'index.ts')
    mkdirSync(path.dirname(nestedSrcFile), { recursive: true })
    writeFileSync(nestedSrcFile, '// nested test file', 'utf-8')
    writePkg(tmpRootA, {
      name: 'workspace-root',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    })

    const { getScripts, clearAllCaches } = await import('../src/getDeps')

    setActiveRoot(tmpRootA)
    setActiveFile(nestedSrcFile)
    const firstResult = await getScripts()

    writePkg(path.join(tmpRootA, 'packages', 'feature-b'), {
      name: 'feature-b',
      version: '1.0.0',
      dependencies: { vue: '^3.0.0' },
    })

    const secondResult = await getScripts()
    clearAllCaches()

    expect(candidateNames(firstResult)).toContain('react')
    expect(candidateNames(firstResult)).not.toContain('vue')
    expect(candidateNames(secondResult)).toContain('vue')
  })

  it('respects negated workspace globs in pnpm-workspace.yaml', async () => {
    const wsYaml = `packages:\n  - packages/*\n  - '!packages/ignored'\n`
    const includedDir = path.join(tmpRootA, 'packages', 'included')
    const ignoredDir = path.join(tmpRootA, 'packages', 'ignored')
    mkdirSync(includedDir, { recursive: true })
    mkdirSync(ignoredDir, { recursive: true })
    writeFileSync(path.join(tmpRootA, 'pnpm-workspace.yaml'), wsYaml, 'utf-8')
    writeFileSync(path.join(includedDir, 'package.json'), JSON.stringify({ name: 'workspace-included' }, null, 2), 'utf-8')
    writeFileSync(path.join(ignoredDir, 'package.json'), JSON.stringify({ name: 'workspace-ignored' }, null, 2), 'utf-8')
    writePkg(tmpRootA, { name: 'workspace-root', version: '1.0.0' })

    const { getScripts, clearAllCaches } = await import('../src/getDeps')
    const result = await getScripts()
    clearAllCaches()

    expect(candidateNames(result)).toContain('workspace-included')
    expect(candidateNames(result)).not.toContain('workspace-ignored')
  })

  it('detects a pnpm-workspace.yaml added after the first lookup', async () => {
    writePkg(tmpRootA, {
      name: 'workspace-root',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    })

    const { getScripts, clearAllCaches } = await import('../src/getDeps')
    const firstResult = await getScripts()

    const wsYaml = `packages:\n  - packages/*\n`
    const pkgDir = path.join(tmpRootA, 'packages', 'late-added')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(path.join(tmpRootA, 'pnpm-workspace.yaml'), wsYaml, 'utf-8')
    writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'workspace-late-added' }, null, 2), 'utf-8')

    const secondResult = await getScripts()
    clearAllCaches()

    expect(candidateNames(firstResult)).toContain('react')
    expect(candidateNames(firstResult)).not.toContain('workspace-late-added')
    expect(candidateNames(secondResult)).toContain('workspace-late-added')
  })

  it('invalidates workspace cache when a new workspace package is created', async () => {
    const wsYaml = `packages:\n  - packages/*\n`
    const existingDir = path.join(tmpRootA, 'packages', 'existing')
    mkdirSync(existingDir, { recursive: true })
    writeFileSync(path.join(tmpRootA, 'pnpm-workspace.yaml'), wsYaml, 'utf-8')
    writeFileSync(path.join(existingDir, 'package.json'), JSON.stringify({ name: 'workspace-existing' }, null, 2), 'utf-8')
    writePkg(tmpRootA, { name: 'workspace-root', version: '1.0.0' })

    const { getScripts, clearAllCaches } = await import('../src/getDeps')
    const firstResult = await getScripts()

    const newDir = path.join(tmpRootA, 'packages', 'new-package')
    mkdirSync(newDir, { recursive: true })
    writeFileSync(path.join(newDir, 'package.json'), JSON.stringify({ name: 'workspace-new-package' }, null, 2), 'utf-8')
    triggerWorkspacePackageCreate(tmpRootA)
    await new Promise(resolve => setTimeout(resolve, 350))

    const secondResult = await getScripts()
    clearAllCaches()

    expect(candidateNames(firstResult)).toContain('workspace-existing')
    expect(candidateNames(firstResult)).not.toContain('workspace-new-package')
    expect(candidateNames(secondResult)).toContain('workspace-new-package')
  })
})
