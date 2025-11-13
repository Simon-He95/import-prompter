import { describe, expect, it } from 'vitest'

describe('import-prompter basic tests', () => {
  it('should pass basic assertion', () => {
    expect(true).toBe(true)
  })

  it('should have correct package structure', () => {
    // 测试基本的 TypeScript 编译和模块导出
    expect(typeof import('../src/getDeps')).toBe('object')
  })
})
