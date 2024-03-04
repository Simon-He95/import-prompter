import type { Disposable, ExtensionContext } from 'vscode'

import { createCompletionItem, registerCompletionItemProvider } from '@vscode-use/utils'
import { getScripts, rootCacheMap } from './getDeps'

export function activate(context: ExtensionContext) {
  const disposes: Disposable[] = []
  getScripts()
  disposes.push(registerCompletionItemProvider(['javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'vue'], async () => {
    const scripts = await getScripts()
    if (!scripts)
      return

    return [
      createCompletionItem({
        content: '_import-prompter',
        snippet: `import\${2: } from '\${1|${scripts?.join(',')}|}'`,
        command: {
          command: 'editor.action.triggerSuggest', // 这个命令会触发代码提示
          title: 'Trigger Suggest',
        },
      }),
    ]
  }, ['_']))

  context.subscriptions.push(...disposes)
}

export function deactivate() {
  rootCacheMap.clear()
}
