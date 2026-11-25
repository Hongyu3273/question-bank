import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { formatInterval } from '../../src/renderer/src/pages/Recite/RecitePieces'

const t = ((key: string, o: { count: number }) => `${o.count} ${key.replace('study.', '')}`) as unknown as TFunction
const MIN = 60_000

describe('formatInterval', () => {
  it('按分钟、小时、天、月、年显示', () => {
    expect(formatInterval(10 * MIN, t)).toBe('10 minutes')
    expect(formatInterval(20_000, t)).toBe('1 minutes')
    expect(formatInterval(3 * 60 * MIN, t)).toBe('3 hours')
    expect(formatInterval(4 * 24 * 60 * MIN, t)).toBe('4 days')
    expect(formatInterval(65 * 24 * 60 * MIN, t)).toBe('2 months')
    expect(formatInterval(548 * 24 * 60 * MIN, t)).toBe('1.5 years')
  })
})
