import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CollectionSort } from './resource-collections'

const OPTIONS: { value: CollectionSort; label: string }[] = [
  { value: 'recent', label: 'Recent activity' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'most-questions', label: 'Most questions' },
  { value: 'fewest-questions', label: 'Fewest questions' },
]

export function CollectionSortControl({ label, value, onChange }: {
  label: string
  value: CollectionSort
  onChange: (value: CollectionSort) => void
}) {
  return <Select value={value} onValueChange={(next) => onChange(next as CollectionSort)}>
    <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
    <SelectContent><SelectGroup>
      {OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
    </SelectGroup></SelectContent>
  </Select>
}
