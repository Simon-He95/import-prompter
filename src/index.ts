import type { Disposable, ExtensionContext } from 'vscode'

import { createCompletionItem, getLineText, registerCompletionItemProvider } from '@vscode-use/utils'
import { getScripts, rootCacheMap } from './getDeps'

export function activate(context: ExtensionContext) {
  const disposes: Disposable[] = []
  getScripts()
  const content = '_import-prompter'
  disposes.push(registerCompletionItemProvider(['javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'vue'], async (_, position) => {
    const scripts = await getScripts()
    if (!scripts)
      return
    const lineText = getLineText(position.line)

    if (lineText && content.startsWith(lineText)) {
      return [
        createCompletionItem({
          content,
          snippet: `import\${2: } from '\${1|${scripts?.join(',')}|}'`,
          command: {
            command: 'editor.action.triggerSuggest', // 这个命令会触发代码提示
            title: 'Trigger Suggest',
          },
        }),
      ]
    }
  }, ['_']))

  context.subscriptions.push(...disposes)
}

export function deactivate() {
  rootCacheMap.clear()
}
