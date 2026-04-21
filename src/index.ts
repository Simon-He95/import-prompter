import type { Disposable, ExtensionContext } from 'vscode'

import { createCompletionItem, registerCompletionItemProvider } from '@vscode-use/utils'
import { Range, workspace } from 'vscode'
import { clearAllCaches, getScripts } from './getDeps'

function getConfiguration() {
  const config = workspace.getConfiguration('import-prompter')
  return {
    trigger: config.get<string>('trigger', '_'),
    includePeerDependencies: config.get<boolean>('includePeerDependencies', true),
    excludePackages: config.get<string[]>('excludePackages', []),
    supportedLanguages: config.get<string[]>('supportedLanguages', [
      'javascript',
      'javascriptreact',
      'typescript',
      'typescriptreact',
      'vue',
      'svelte',
      'astro',
    ]),
  }
}

export function activate(context: ExtensionContext) {
  let provider: Disposable | undefined

  const registerProvider = () => {
    provider?.dispose()

    const config = getConfiguration()

    provider = registerCompletionItemProvider(config.supportedLanguages, async (document, position) => {
      const linePrefix = document.lineAt(position.line).text.slice(0, position.character)
      const trimmedLinePrefix = linePrefix.trimStart()

      // 早期返回，避免不必要的依赖加载
      if (!trimmedLinePrefix || !trimmedLinePrefix.startsWith(config.trigger))
        return

      const query = trimmedLinePrefix.slice(config.trigger.length).toLowerCase()
      const startCharacter = linePrefix.length - trimmedLinePrefix.length
      const replacementRange = new Range(position.line, startCharacter, position.line, position.character)

      const candidates = await getScripts()
      if (!candidates || candidates.length === 0)
        return

      // 过滤排除的包（支持通配符 *）
      const filteredCandidates = candidates
        .filter(candidate => !isExcluded(candidate.name, config.excludePackages))
        .filter(candidate => !query || candidate.name.toLowerCase().includes(query))
      if (filteredCandidates.length === 0)
        return

      return filteredCandidates.map(candidate =>
        createCompletionItem({
          content: candidate.name,
          detail: candidate.source,
          filterText: `${config.trigger}${candidate.name}`,
          range: replacementRange,
          snippet: `import \${1:module} from '${candidate.name}'`,
          sortText: candidate.name,
        }))
    }, [config.trigger])
  }

  registerProvider()

  // 监听配置变化
  context.subscriptions.push(
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('import-prompter')) {
        // 清理缓存，强制重新加载
        clearAllCaches()
        registerProvider()
      }
    }),
  )

  context.subscriptions.push({
    dispose() {
      provider?.dispose()
    },
  })
}

export function deactivate() {
  clearAllCaches()
}

function isExcluded(name: string, patterns: string[]): boolean {
  for (const p of patterns) {
    if (!p)
      continue
    if (p.includes('*')) {
      const re = new RegExp(`^${p
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')}$`)
      if (re.test(name))
        return true
    }
    else if (p === name) {
      return true
    }
  }
  return false
}
