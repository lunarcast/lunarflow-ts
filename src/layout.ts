import type { TimelineStep, Timeline } from './timeline'
import type { ADT } from 'ts-adt'
import { isBefore, alterArray, inInterval } from './utils'
import { range } from '@thi.ng/transducers'

type LayoutIndex = ADT<{
  nested: { name: number; index: LayoutIndex; lambdaIndex: number }
  standalone: { index: number }
}>

export type LayoutStep = {
  color: string
  index: LayoutIndex
  interval: { from: number; to: number }
}

export type Layout = LayoutStep[]

type LayoutMatrixItem = {
  raw: LayoutStep
  continues: boolean
}

type LayoutMatrixCell = ADT<{
  nested: { name: number; columns: LayoutMatrixCell[] }
  standalone: LayoutMatrixItem
  nothing: {}
}>

type LayoutMatrix = LayoutMatrixCell[][]

const emptyCell: LayoutMatrixCell = {
  _type: 'nothing'
}

const addCell = (
  column: LayoutMatrixCell[],
  item: LayoutMatrixItem,
  index = item.raw.index
): LayoutMatrixCell[] => {
  if (index._type === 'standalone') {
    return alterArray<LayoutMatrixCell>(
      column,
      index.index,
      { _type: 'standalone', ...item },
      emptyCell
    )
  }

  if (index._type === 'nested') {
    const nested = column[index.lambdaIndex] ?? emptyCell

    const nestedArray = nested._type === 'nested' ? nested.columns : []

    const newCell: LayoutMatrixCell = {
      _type: 'nested',
      name: index.name,
      columns: addCell(nestedArray, item, index.index)
    }

    return alterArray<LayoutMatrixCell>(
      column,
      index.lambdaIndex,
      newCell,
      emptyCell
    )
  }

  throw new Error(
    `Cannot add cell ${JSON.stringify(
      index
    )} to column because it has an unknown type`
  )
}

export const getLayoutMatrix = (layout: Layout): LayoutMatrix =>
  [...range(Math.max(...layout.map((step) => step.interval.to)))].map((index) =>
    layout.reduce(
      (current, step) =>
        inInterval(step.interval, index)
          ? addCell(current, {
              continues: inInterval(step.interval, index + 1),
              raw: step
            })
          : current,
      [] as LayoutMatrixCell[]
    )
  )

export const buildLayouts = (timeline: Timeline): Layout[] => {
  if (timeline.length === 0) return []

  const [head, ...tail] = timeline

  if (head._type === 'call') {
    //   if (isBefore())
  }

  return []
}
