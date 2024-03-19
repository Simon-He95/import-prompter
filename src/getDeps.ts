import path from 'node:path'
import { existsSync } from 'node:fs'
import { getCurrentFileUrl, getRootPath, watchFiles } from '@vscode-use/utils'
import { findUp } from 'find-up'

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
  if (currentRoot === root)
    return getPathDep(currentRoot)

  return getPathDep(currentRoot).concat(getPathDep(root))
}

export const urlCache = new Map()
function getPathDep(url: string) {
  url = path.join(url, 'package.json')
  if (!existsSync(url))
    return []
  if (urlCache.has(url))
    return urlCache.get(url)
  const pkg = require(url)
  const result = Object.assign([], pkg.devDependencies ? Object.keys(pkg.devDependencies) : undefined, pkg.dependencies ? Object.keys(pkg.dependencies) : undefined)
  urlCache.set(url, result)
  const stop = watchFiles(url, {
    onChange() {
      const newPkg = require(url)
      const newResult = Object.assign([], newPkg.devDependencies ? Object.keys(newPkg.devDependencies) : undefined, newPkg.dependencies ? Object.keys(newPkg.dependencies) : undefined)
      urlCache.set(url, newResult)
    },
    onDelete() {
      urlCache.delete(url)
      stop()
    },
  })
  return result
}
