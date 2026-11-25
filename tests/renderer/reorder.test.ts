import { describe, expect, it } from 'vitest'
import { moveId, stepId } from '../../src/renderer/src/hooks/useDragReorder'

describe('排序工具', () => {
  it('拖到某一项的上方或下方', () => {
    expect(moveId(['a', 'b', 'c', 'd'], 'a', 'c', true)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveId(['a', 'b', 'c', 'd'], 'd', 'b', false)).toEqual(['a', 'd', 'b', 'c'])
    expect(moveId(['a', 'b'], 'a', 'a', true)).toEqual(['a', 'b'])
  })

  it('上移下移一位,边界不变', () => {
    expect(stepId(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(stepId(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
  })
})
