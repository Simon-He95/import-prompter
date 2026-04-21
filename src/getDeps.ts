import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { getCurrentFileUrl, getRootPath, watchFile } from '@vscode-use/utils'
import { findUp } from 'find-up'
import { RelativePattern, workspace } from 'vscode'

export type ImportCandidateSource = 'workspace' | 'dependency' | 'peerDependency' | 'devDependency'

export interface ImportCandidate {
  name: string
  source: ImportCandidateSource
}

const sourcePriority: Record<ImportCandidateSource, number> = {
  workspace: 0,
  dependency: 1,
  peerDependency: 2,
  devDependency: 3,
}

async function findCurrentRoot() {
  const cwd = getCurrentFileUrl()
  if (!cwd)
    return

  const pkg = await findUp('package.json', {
    cwd,
  })

  if (!pkg)
    return

  const currentRoot = path.dirname(pkg)
  return currentRoot
}

function mergeCandidates(map: Map<string, ImportCandidate>, items: ImportCandidate[]) {
  for (const item of items) {
    const existing = map.get(item.name)
    if (!existing || sourcePriority[item.source] < sourcePriority[existing.source])
      map.set(item.name, item)
  }
}

function sortCandidates(candidates: Iterable<ImportCandidate>) {
  return Array.from(candidates).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getScripts() {
  const currentRoot = await findCurrentRoot()
  const root = getRootPath()
  if (!currentRoot || !root)
    return
  const results = new Map<string, ImportCandidate>()
  const add = (arr?: ImportCandidate[]) => {
    if (arr && arr.length)
      mergeCandidates(results, arr)
  }

  if (currentRoot === root) {
    add(getPathDep(currentRoot))
  }
  else {
    add(getPathDep(currentRoot))
    add(getPathDep(root))
  }

  // Add workspace package names if present
  const workspacePkgs = await getWorkspacePackages(root)
  add(workspacePkgs)

  return sortCandidates(results.values())
}

export const urlCache = new Map<string, ImportCandidate[]>()
const fileWatchers = new Map<string, () => void>()
const workspaceCache = new Map<string, ImportCandidate[]>()
const workspaceFilePaths = new Map<string, string | undefined>()

// 防抖函数
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: NodeJS.Timeout | null = null
  return ((...args: any[]) => {
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

function readPackageJson(url: string) {
  try {
    const content = readFileSync(url, 'utf-8')
    return JSON.parse(content)
  }
  catch (error) {
    console.error(`Failed to read package.json at ${url}:`, error)
    return null
  }
}

function createCandidates(names: string[], source: ImportCandidateSource): ImportCandidate[] {
  return names.map(name => ({ name, source }))
}

function extractDependencies(pkg: any): ImportCandidate[] {
  if (!pkg)
    return []

  const config = workspace.getConfiguration('import-prompter')
  const includePeerDeps = config.get<boolean>('includePeerDependencies', true)

  const candidates = new Map<string, ImportCandidate>()

  mergeCandidates(candidates, createCandidates(Object.keys(pkg.devDependencies || {}), 'devDependency'))

  if (includePeerDeps)
    mergeCandidates(candidates, createCandidates(Object.keys(pkg.peerDependencies || {}), 'peerDependency'))

  mergeCandidates(candidates, createCandidates(Object.keys(pkg.dependencies || {}), 'dependency'))

  return sortCandidates(candidates.values())
}

function getPathDep(url: string): ImportCandidate[] {
  url = path.join(url, 'package.json')
  if (!existsSync(url))
    return []

  if (urlCache.has(url))
    return urlCache.get(url) ?? []

  const pkg = readPackageJson(url)
  const result = extractDependencies(pkg)
  urlCache.set(url, result)

  // 避免重复监听
  if (!fileWatchers.has(url)) {
    // 使用防抖优化文件变化处理
    const debouncedUpdate = debounce(() => {
      const newPkg = readPackageJson(url)
      const newResult = extractDependencies(newPkg)
      urlCache.set(url, newResult)
    }, 300)

    const stop = watchFile(url, {
      onChange: debouncedUpdate,
      onDelete() {
        urlCache.delete(url)
        fileWatchers.delete(url)
        stop()
      },
    })
    fileWatchers.set(url, stop)
  }

  return result
}

export function clearAllCaches() {
  urlCache.clear()
  workspaceCache.clear()
  workspaceFilePaths.clear()
  // 停止所有文件监听
  fileWatchers.forEach(stop => stop())
  fileWatchers.clear()
}

function getWorkspacePackageWatcherKey(workspaceFilePath: string) {
  return `${workspaceFilePath}:packages`
}

function stopWatcher(key: string) {
  const stop = fileWatchers.get(key)
  if (!stop)
    return

  stop()
  fileWatchers.delete(key)
}

function watchWorkspacePackageFiles(workspaceFilePath: string, patterns: string[]) {
  const watcherKey = getWorkspacePackageWatcherKey(workspaceFilePath)
  if (fileWatchers.has(watcherKey))
    return

  const wsRoot = path.dirname(workspaceFilePath)
  const includePatterns = patterns.filter(pattern => pattern && !pattern.startsWith('!'))
  if (!includePatterns.length)
    return

  const invalidateCache = debounce(() => {
    workspaceCache.delete(workspaceFilePath)
  }, 300)

  const watchers = includePatterns.map(pattern => workspace.createFileSystemWatcher(
    new RelativePattern(wsRoot, `${pattern}/package.json`),
  ))

  for (const watcher of watchers) {
    watcher.onDidCreate(invalidateCache)
    watcher.onDidChange(invalidateCache)
    watcher.onDidDelete(invalidateCache)
  }

  fileWatchers.set(watcherKey, () => {
    watchers.forEach(watcher => watcher.dispose())
  })
}

async function getWorkspacePackages(root: string): Promise<ImportCandidate[] | undefined> {
  // find pnpm-workspace.yaml upward from root
  let workspaceFilePath = workspaceFilePaths.get(root)
  if (!workspaceFilePath) {
    workspaceFilePath = await findUp('pnpm-workspace.yaml', { cwd: root })
    if (workspaceFilePath)
      workspaceFilePaths.set(root, workspaceFilePath)
  }

  if (!workspaceFilePath)
    return

  if (workspaceCache.has(workspaceFilePath))
    return workspaceCache.get(workspaceFilePath) ?? []

  const content = readFileSync(workspaceFilePath, 'utf-8')
  const patterns = parsePnpmWorkspace(content)
  if (!patterns.length) {
    stopWatcher(getWorkspacePackageWatcherKey(workspaceFilePath))
    workspaceCache.set(workspaceFilePath, [])
    return []
  }

  watchWorkspacePackageFiles(workspaceFilePath, patterns)

  const wsRoot = path.dirname(workspaceFilePath)
  const dirs = matchDirsByGlobs(wsRoot, patterns)
  const candidates = new Map<string, ImportCandidate>()
  for (const dir of dirs) {
    const pkgPath = path.join(wsRoot, dir, 'package.json')
    if (!existsSync(pkgPath))
      continue
    const pkg = readPackageJson(pkgPath)
    if (pkg?.name)
      mergeCandidates(candidates, [{ name: pkg.name as string, source: 'workspace' }])
  }
  const unique = sortCandidates(candidates.values())
  workspaceCache.set(workspaceFilePath, unique)

  // watch the workspace file for changes
  if (!fileWatchers.has(workspaceFilePath)) {
    const stop = watchFile(workspaceFilePath, {
      onChange: debounce(() => {
        stopWatcher(getWorkspacePackageWatcherKey(workspaceFilePath as string))
        workspaceCache.delete(workspaceFilePath as string)
      }, 300),
      onDelete() {
        stopWatcher(getWorkspacePackageWatcherKey(workspaceFilePath as string))
        workspaceCache.delete(workspaceFilePath as string)
        fileWatchers.delete(workspaceFilePath as string)
        for (const [cacheRoot, filePath] of workspaceFilePaths) {
          if (filePath === workspaceFilePath)
            workspaceFilePaths.delete(cacheRoot)
        }
        stop()
      },
    })
    fileWatchers.set(workspaceFilePath, stop)
  }

  return unique
}

function parsePnpmWorkspace(yaml: string): string[] {
  // naive parser for:
  // packages:
  //   - 'packages/*'
  //   - 'apps/*'
  const lines = yaml.split(/\r?\n/)
  const result: string[] = []
  let inPackages = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('packages:')) {
      inPackages = true
      continue
    }
    if (inPackages) {
      if (trimmed.startsWith('-')) {
        const value = trimmed.replace(/^-\s*/, '').replace(/^['"]|['"]$/g, '')
        if (value)
          result.push(value)
      }
      else if (trimmed && !trimmed.startsWith('#')) {
        // end of packages block when encountering a non-item line
        break
      }
    }
  }
  return result
}

function matchDirsByGlobs(root: string, patterns: string[], max = 5000): string[] {
  const includeRegexes = patterns
    .filter(pattern => pattern && !pattern.startsWith('!'))
    .map(globToRegex)
  const excludeRegexes = patterns
    .filter(pattern => pattern.startsWith('!'))
    .map(pattern => globToRegex(pattern.slice(1)))
  const matched = new Set<string>()
  const ignoredDirs = new Set(['.git', 'node_modules'])
  let visited = 0

  function walk(relDir: string) {
    if (visited > max)
      return
    const abs = path.join(root, relDir)
    let items: string[] = []
    try {
      items = readdirSync(abs)
    }
    catch {
      return
    }
    for (const name of items) {
      if (ignoredDirs.has(name))
        continue
      const childRel = relDir ? path.join(relDir, name) : name
      const absChild = path.join(root, childRel)
      let stat
      try {
        stat = statSync(absChild)
      }
      catch {
        continue
      }
      if (stat.isDirectory()) {
        visited++
        // If this directory matches any pattern, collect it
        if (
          includeRegexes.some(regex => regex.test(childRel))
          && !excludeRegexes.some(regex => regex.test(childRel))
        ) {
          matched.add(childRel)
        }
        walk(childRel)
      }
    }
  }

  walk('')
  return Array.from(matched)
}

function globToRegex(glob: string): RegExp {
  // Escape regex special, then restore glob tokens
  const esc = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  let pattern = ''
  const parts = glob.split('**')
  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i]
    pattern += esc(segment).replace(/\*/g, '[^/]*')
    if (i < parts.length - 1)
      pattern += '.*'
  }
  return new RegExp(`^${pattern}$`)
}
