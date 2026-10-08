/** Layout controls shared by an Exam's printed header and footer. */
export type FurnitureAlignment = 'left' | 'center' | 'right'
export type FurnitureColumns = 1 | 2 | 3

export type FurnitureLayout = {
  alignment?: FurnitureAlignment
  columns?: FurnitureColumns
  /** Content-addressed image owned by the browser's Media Store. */
  logo?: string
}

export type ExamFurniture = {
  header?: FurnitureLayout
  footer?: FurnitureLayout
}

export const DEFAULT_FURNITURE_LAYOUT: Required<Pick<FurnitureLayout, 'alignment' | 'columns'>> = {
  alignment: 'left',
  columns: 1,
}

export function isFurnitureLayout(value: unknown): value is FurnitureLayout {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const layout = value as Record<string, unknown>
  return Object.keys(layout).every((key) => key === 'alignment' || key === 'columns' || key === 'logo')
    && (layout.alignment === undefined || layout.alignment === 'left' || layout.alignment === 'center' || layout.alignment === 'right')
    && (layout.columns === undefined || layout.columns === 1 || layout.columns === 2 || layout.columns === 3)
    && (layout.logo === undefined || (typeof layout.logo === 'string' && /^\/local-images\/[a-f0-9]{64}$/.test(layout.logo)))
}

export function isExamFurniture(value: unknown): value is ExamFurniture {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const furniture = value as Record<string, unknown>
  return Object.keys(furniture).every((key) => key === 'header' || key === 'footer')
    && (furniture.header === undefined || isFurnitureLayout(furniture.header))
    && (furniture.footer === undefined || isFurnitureLayout(furniture.footer))
}

export function withFurnitureLayout(
  furniture: ExamFurniture | undefined,
  region: 'header' | 'footer',
  layout: FurnitureLayout,
): ExamFurniture | undefined {
  const next = { ...furniture }
  const normalized = {
    ...(layout.alignment !== DEFAULT_FURNITURE_LAYOUT.alignment ? { alignment: layout.alignment } : {}),
    ...(layout.columns !== DEFAULT_FURNITURE_LAYOUT.columns ? { columns: layout.columns } : {}),
    ...(layout.logo ? { logo: layout.logo } : {}),
  }
  if (Object.keys(normalized).length) next[region] = normalized
  else delete next[region]
  return Object.keys(next).length ? next : undefined
}

export function sameExamFurniture(left: ExamFurniture | undefined, right: ExamFurniture | undefined): boolean {
  return (['header', 'footer'] as const).every((region) =>
    left?.[region]?.alignment === right?.[region]?.alignment
    && left?.[region]?.columns === right?.[region]?.columns
    && left?.[region]?.logo === right?.[region]?.logo,
  )
}
