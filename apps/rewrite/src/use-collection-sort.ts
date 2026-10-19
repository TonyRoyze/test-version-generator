import { useState } from 'react'
import type { CollectionSort } from './resource-collections'

const SORT_VALUES: readonly CollectionSort[] = ['recent', 'newest', 'oldest', 'name-asc', 'name-desc', 'most-questions', 'fewest-questions']

export function useCollectionSort(kind: 'exams' | 'question-banks') {
  const key = `test-parrot:sort:${kind}`
  const [sort, setSort] = useState<CollectionSort>(() => {
    try {
      const saved = localStorage.getItem(key)
      return SORT_VALUES.find((value) => value === saved) ?? 'recent'
    } catch { return 'recent' }
  })
  return [sort, (value: CollectionSort) => {
    setSort(value)
    try { localStorage.setItem(key, value) } catch { /* Sorting still works without storage. */ }
  }] as const
}

