import { beforeEach, describe, expect, it, vi } from 'vitest'

const providerDisposes: ReturnType<typeof vi.fn>[] = []
const registerCalls: any[][] = []
let providerCallback: ((document: { lineAt: (line: number) => { text: string } }, position: { line: number, character: number }) => Promise<any>) | undefined
const clearAllCaches = vi.fn()
const getScripts = vi.fn(async () => [
  { name: 'react', source: 'dependency' },
  { name: 'vue', source: 'workspace' },
])
let configurationChangeHandler: ((event: { affectsConfiguration: (section: string) => boolean }) => void) | undefined
let config = {
  trigger: '_',
  excludePackages: [] as string[],
  supportedLanguages: ['javascript'],
}

vi.mock('@vscode-use/utils', () => ({
  createCompletionItem: (item: any) => item,
  registerCompletionItemProvider: (...args: any[]) => {
    registerCalls.push(args)
    providerCallback = args[1]
    const dispose = vi.fn()
    providerDisposes.push(dispose)
    return { dispose }
  },
}))

vi.mock('../src/getDeps', () => ({
  clearAllCaches,
  getScripts,
}))

vi.mock('vscode', () => ({
  Range: class Range {
    start: { line: number, character: number }
    end: { line: number, character: number }

    constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number) {
      this.start = { line: startLine, character: startCharacter }
      this.end = { line: endLine, character: endCharacter }
    }
  },
  workspace: {
    getConfiguration: () => ({
      get: (key: string, def: any) => {
        if (key === 'trigger')
          return config.trigger
        if (key === 'excludePackages')
          return config.excludePackages
        if (key === 'supportedLanguages')
          return config.supportedLanguages
        return def
      },
    }),
    onDidChangeConfiguration: (handler: typeof configurationChangeHandler) => {
      configurationChangeHandler = handler
      return { dispose: vi.fn() }
    },
  },
}))

beforeEach(() => {
  vi.resetModules()
  clearAllCaches.mockClear()
  getScripts.mockClear()
  registerCalls.length = 0
  providerDisposes.length = 0
  providerCallback = undefined
  configurationChangeHandler = undefined
  config = {
    trigger: '_',
    excludePackages: [],
    supportedLanguages: ['javascript'],
  }
})

describe('activate', () => {
  it('re-registers completion provider after configuration changes', async () => {
    const { activate } = await import('../src/index')
    const context = { subscriptions: [] as { dispose: () => void }[] }

    activate(context as any)

    expect(registerCalls).toHaveLength(1)
    expect(registerCalls[0][0]).toEqual(['javascript'])
    expect(registerCalls[0][2]).toEqual(['_'])

    config = {
      trigger: '@',
      excludePackages: ['react'],
      supportedLanguages: ['typescript'],
    }

    configurationChangeHandler?.({
      affectsConfiguration: section => section === 'import-prompter',
    })

    expect(clearAllCaches).toHaveBeenCalledTimes(1)
    expect(registerCalls).toHaveLength(2)
    expect(providerDisposes[0]).toHaveBeenCalledTimes(1)
    expect(registerCalls[1][0]).toEqual(['typescript'])
    expect(registerCalls[1][2]).toEqual(['@'])
  })

  it('matches the trigger against text before the cursor so indented imports still work', async () => {
    const { activate } = await import('../src/index')
    const context = { subscriptions: [] as { dispose: () => void }[] }

    activate(context as any)

    const result = await providerCallback?.(
      {
        lineAt: () => ({ text: '  _re' }),
      },
      { line: 0, character: 5 },
    )

    expect(getScripts).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
    expect(result?.[0]).toMatchObject({
      content: 'react',
      detail: 'dependency',
      filterText: '_react',
      snippet: `import \${1:module} from 'react'`,
      sortText: 'react',
    })
    expect(result?.[0].range).toEqual({
      start: { line: 0, character: 2 },
      end: { line: 0, character: 5 },
    })
  })

  it('does not offer completions when the trigger is in the middle of other code', async () => {
    const { activate } = await import('../src/index')
    const context = { subscriptions: [] as { dispose: () => void }[] }

    activate(context as any)

    const result = await providerCallback?.(
      {
        lineAt: () => ({ text: 'const value = _im' }),
      },
      { line: 0, character: 17 },
    )

    expect(getScripts).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })
})
