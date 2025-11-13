import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { getCurrentFileUrl, getRootPath, watchFiles } from '@vscode-use/utils'
import { findUp } from 'find-up'
import { workspace } from 'vscode'

export const rootCacheMap = new Map()
let currentRoot: string | undefined
async function findCurrentRoot() {
  const cwd = getCurrentFileUrl()
  if (!cwd)
    return

  if (rootCacheMap.has(cwd))
    return rootCacheMap.get(cwd)

  if (currentRoot && cwd.startsWith(currentRoot))
    return currentRoot

  const pkg = await findUp('package.json', {
    cwd,
  })

  if (!pkg)
    return

  currentRoot = path.dirname(pkg)
  rootCacheMap.set(cwd, currentRoot)

  return currentRoot
}

export async function getScripts() {
  const currentRoot = await findCurrentRoot()
  const root = getRootPath()
  if (!currentRoot || !root)
    return
  const results: string[] = []
  const add = (arr?: string[]) => {
    if (arr && arr.length)
      results.push(...arr)
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

  // dedupe + sort
  return Array.from(new Set(results)).sort()
}

export const urlCache = new Map()
const fileWatchers = new Map()
const workspaceCache = new Map<string, string[]>()
let workspaceFilePath: string | undefined

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

function extractDependencies(pkg: any): string[] {
  if (!pkg)
    return []

  const config = workspace.getConfiguration('import-prompter')
  const includePeerDeps = config.get<boolean>('includePeerDependencies', true)

  const deps = new Set<string>()

  // 收集所有依赖类型
  if (pkg.dependencies)
    Object.keys(pkg.dependencies).forEach(dep => deps.add(dep))

  if (pkg.devDependencies)
    Object.keys(pkg.devDependencies).forEach(dep => deps.add(dep))

  if (includePeerDeps && pkg.peerDependencies)
    Object.keys(pkg.peerDependencies).forEach(dep => deps.add(dep))

  return Array.from(deps).sort()
}

function getPathDep(url: string) {
  url = path.join(url, 'package.json')
  if (!existsSync(url))
    return []

  if (urlCache.has(url))
    return urlCache.get(url)

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

    const stop = watchFiles(url, {
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
  rootCacheMap.clear()
  workspaceCache.clear()
  // 停止所有文件监听
  fileWatchers.forEach(stop => stop())
  fileWatchers.clear()
}

async function getWorkspacePackages(root: string): Promise<string[] | undefined> {
  // find pnpm-workspace.yaml upward from root
  if (!workspaceFilePath)
    workspaceFilePath = await findUp('pnpm-workspace.yaml', { cwd: root })

  if (!workspaceFilePath)
    return

  if (workspaceCache.has(workspaceFilePath))
    return workspaceCache.get(workspaceFilePath)

  const content = readFileSync(workspaceFilePath, 'utf-8')
  const patterns = parsePnpmWorkspace(content)
  if (!patterns.length) {
    workspaceCache.set(workspaceFilePath, [])
    return []
  }

  const wsRoot = path.dirname(workspaceFilePath)
  const dirs = matchDirsByGlobs(wsRoot, patterns)
  const names: string[] = []
  for (const dir of dirs) {
    const pkgPath = path.join(wsRoot, dir, 'package.json')
    if (!existsSync(pkgPath))
      continue
    const pkg = readPackageJson(pkgPath)
    if (pkg?.name)
      names.push(pkg.name as string)
  }
  const unique = Array.from(new Set(names)).sort()
  workspaceCache.set(workspaceFilePath, unique)

  // watch the workspace file for changes
  if (!fileWatchers.has(workspaceFilePath)) {
    const stop = watchFiles(workspaceFilePath, {
      onChange: debounce(() => {
        workspaceCache.delete(workspaceFilePath as string)
      }, 300),
      onDelete() {
        workspaceCache.delete(workspaceFilePath as string)
        fileWatchers.delete(workspaceFilePath as string)
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
  const regexes = patterns.map(globToRegex)
  const matched = new Set<string>()
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
        if (regexes.some(r => r.test(childRel)))
          matched.add(childRel)
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
