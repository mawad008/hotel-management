import { describe, expect, it } from 'vitest'
import { formatAverage, movedOrder, scoreBarWidth } from '~/utils/reviewCategories'

describe('movedOrder (dynamic review-category reorder)', () => {
  it('swaps with the neighbour and returns the full set', () => {
    expect(movedOrder([12, 15, 19], 1, -1)).toEqual([15, 12, 19])
    expect(movedOrder([12, 15, 19], 1, 1)).toEqual([12, 19, 15])
  })
  it('works for any number of categories', () => {
    const eight = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(movedOrder(eight, 7, -1)).toEqual([1, 2, 3, 4, 5, 6, 8, 7])
    expect(movedOrder([4, 9], 0, 1)).toEqual([9, 4])
  })
  it('refuses moves off either end', () => {
    expect(movedOrder([12, 15], 0, -1)).toBeNull()
    expect(movedOrder([12, 15], 1, 1)).toBeNull()
    expect(movedOrder([], 0, 1)).toBeNull()
  })
  it('does not mutate the input', () => {
    const ids = [1, 2, 3]
    movedOrder(ids, 0, 1)
    expect(ids).toEqual([1, 2, 3])
  })
})

describe('formatAverage / scoreBarWidth', () => {
  it('formats a live average to one decimal and marks unrated categories', () => {
    expect(formatAverage(4.666)).toBe('4.7')
    expect(formatAverage(5)).toBe('5.0')
    expect(formatAverage(null)).toBe('—')
  })
  it('scales 0-5 to a clamped bar width', () => {
    expect(scoreBarWidth(2.5)).toBe('50%')
    expect(scoreBarWidth(5)).toBe('100%')
    expect(scoreBarWidth(null)).toBe('0%')
    expect(scoreBarWidth(7)).toBe('100%')
  })
})
