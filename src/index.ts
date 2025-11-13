import type { Disposable, ExtensionContext } from 'vscode'

import { createCompletionItem, getLineText, registerCompletionItemProvider } from '@vscode-use/utils'
import { workspace } from 'vscode'
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
  const disposes: Disposable[] = []
  const config = getConfiguration()
  const content = `${config.trigger}import-prompter`

  disposes.push(registerCompletionItemProvider(config.supportedLanguages, async (_, position) => {
    const lineText = getLineText(position.line)

    // 早期返回，避免不必要的依赖加载
    if (!lineText || !content.startsWith(lineText))
      return

    const scripts = await getScripts()
    if (!scripts || scripts.length === 0)
      return

    // 过滤排除的包（支持通配符 *）
    const filteredScripts = scripts.filter((pkg: string) => !isExcluded(pkg, config.excludePackages))
    if (filteredScripts.length === 0)
      return

    return [
      createCompletionItem({
        content,
        snippet: `import \${2:module} from '\${1|${filteredScripts.join(',')}|}'`,
        command: {
          command: 'editor.action.triggerSuggest',
          title: 'Trigger Suggest',
        },
      }),
    ]
  }, [config.trigger]))

  // 监听配置变化
  context.subscriptions.push(
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('import-prompter')) {
        // 清理缓存，强制重新加载
        clearAllCaches()
      }
    }),
  )

  context.subscriptions.push(...disposes)
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
