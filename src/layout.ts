import type { TimelineStep, Timeline } from './timeline'
import type { ADT } from 'ts-adt'
import { isBefore, alterArray, inInterval, Interval } from './utils'
import { range, last } from '@thi.ng/transducers'
import type { Fn, Fn3, Fn2 } from '@thi.ng/api'

export type ILayoutStep = {
  color: string
  index: number
  id: number
}

export type LayoutStep = ADT<{
  call: {
    interval: { from: number; to: number }
    step: TimelineStep & { _type: 'call' }
  }
  nested: {
    arguments: number[]
    step: TimelineStep & { _type: 'nested' }
    output: number
    steps: LayoutStep[]
  }
}> &
  ILayoutStep

export type Layout = LayoutStep[]

type LayoutMatrixItem = {
  raw: LayoutStep
  continues: boolean
}

type LayoutMatrixCell = ADT<{
  nested: { name: number; columns: LayoutMatrixCell[]; raw: LayoutStep }
  standalone: LayoutMatrixItem
  nothing: {}
}>

type LayoutMatrix = LayoutMatrixCell[][]

const emptyCell: LayoutMatrixCell = {
  _type: 'nothing'
}

const addCell = (
  column: LayoutMatrixCell[],
  cell: Exclude<LayoutMatrixCell, { _type: 'nothing' }>,
  index: number
): LayoutMatrixCell[] => {
  return alterArray<LayoutMatrixCell>(column, index, cell, emptyCell)
}

/**
 * Results for the cellIsBefore helper.
 */
const enum CellBeforeResult {
  Neither,
  Function,
  Argument
}

/**
 * Dedicated version of isBefore for nested indices.
 *
 * @param func The function to search for.
 * @param argument The argument to search for.
 * @param column The column to search in.
 */
const cellIsBefore = (
  func: number,
  argument: number,
  column: LayoutMatrixCell[]
): CellBeforeResult => {
  for (const cell of column) {
    if (cell._type === 'nothing') continue
    if (cell._type === 'standalone') {
      if (cell.raw.id === func) return CellBeforeResult.Function
      if (cell.raw.id === argument) return CellBeforeResult.Argument
    }

    if (cell._type === 'nested') {
      if (cell.name === func) return CellBeforeResult.Function
      if (cell.name === argument) return CellBeforeResult.Argument

      const nestedResult = cellIsBefore(func, argument, cell.columns)

      if (nestedResult !== CellBeforeResult.Neither) return nestedResult
    }
  }

  return CellBeforeResult.Neither
}

/**
 * Get the interval a step spans over
 *
 * @param step The step to get the interval from.
 */
const getStepInterval = (step: LayoutStep): Interval => {
  if (step._type === 'call') {
    return step.interval
  }

  const intervals = step.steps.map(getStepInterval)

  return {
    from: Math.min(...intervals.map((i) => i.from)),
    to: Math.max(...intervals.map((i) => i.to))
  }
}

/**
 * Get a layout matrix from a layout.
 *
 * @param layout The layout to get the matrix of.
 */
export const getLayoutMatrix = (layout: Layout): LayoutMatrix =>
  [...range(Math.max(...layout.map((step) => getStepInterval(step).to)))].map(
    (index) =>
      layout.reduce((current, step) => {
        const interval = getStepInterval(step)
        const continues = inInterval(interval, index + 1)

        console.log(interval, step.id)

        const cell: Exclude<LayoutMatrixCell, { _type: 'nothing' }> =
          step._type === 'call'
            ? {
                _type: 'standalone',
                continues,
                raw: step
              }
            : {
                _type: 'nested',
                name: step.id,
                raw: step,
                columns: getLayoutMatrix(step.steps)[index]
              }

        return inInterval(interval, index)
          ? addCell(current, cell, step.index)
          : current
      }, [] as LayoutMatrixCell[])
  )

/**
 * The result of searching something trough a layout.
 */
type LayoutSearchResult = {
  step: LayoutStep
  place: number[]
}

/**
 * Find a step by id inside a layout.
 *
 * @param layout The layout to search trough.
 * @param name The id of the step to find.
 */
const findLayoutStep = (
  layout: Layout,
  name: number,
  stack: number[] = []
): LayoutSearchResult | null => {
  for (const step of layout) {
    if (step.id === name) {
      return {
        step,
        place: stack
      }
    }

    if (step._type === 'nested') {
      const nested = findLayoutStep(step.steps, name, [...stack, step.id])

      if (nested !== null) return nested
    }
  }

  return null
}

/**
 * Find a nested column based on a stack of steps.
 *
 * @param column The column to search trough.
 * @param stack The stack of nested names to follow.
 */
const getNestedColumn = (
  column: LayoutMatrixCell[],
  stack: number[]
): LayoutMatrixCell[] | null => {
  if (stack.length === 0) return column

  const [head, ...tail] = stack

  const nested = column.find(
    (cell) => cell._type === 'nested' && cell.name === head
  )

  if (nested === undefined || nested._type !== 'nested') return null

  return getNestedColumn(nested.columns, tail)
}

export const buildLayouts = (
  timeline: Timeline,
  previous: Layout = []
): { old: Layout; newLayout: Layout }[] => {
  if (timeline.length === 0) return []

  const matrix = getLayoutMatrix(previous)

  const lastColumn: LayoutMatrixCell[] = last(matrix) ?? []

  const [head, ...tail] = timeline

  if (head._type === 'call') {
    const beforeResult = cellIsBefore(head.func, head.argument, lastColumn)

    if (beforeResult === CellBeforeResult.Neither)
      throw new Error(
        `Cannot find function ${head.func} and argument ${
          head.argument
        } in column ${JSON.stringify(lastColumn)}`
      )

    const argumentStep = findLayoutStep(previous, head.argument)

    if (argumentStep === null)
      throw new Error(
        `Cannot find argument ${head.argument} in previous layout`
      )

    const functionStep = findLayoutStep(previous, head.func)

    if (functionStep === null)
      throw new Error(`Cannot find function ${head.func} in previous layout`)

    const deepestStep =
      functionStep.place.length > argumentStep.place.length
        ? functionStep
        : argumentStep

    const nestedColumn = getNestedColumn(lastColumn, deepestStep.place)

    if (nestedColumn === null)
      throw new Error(
        `Cannot find nested column for stack ${functionStep.place}`
      )

    const slice =
      beforeResult === CellBeforeResult.Argument
        ? nestedColumn.slice(0, functionStep.step.index)
        : nestedColumn.slice(functionStep.step.index + 1)

    console.log(slice)
  }

  if (head._type === 'nested') {
    const nestedLayouts = buildLayouts(head.steps, previous)

    const searchResult = findLayoutStep(previous, head.name)

    if (searchResult === null)
      throw new Error(`Cannot find nested lambda ${head.name}`)

    const column = getNestedColumn(lastColumn, searchResult.place)

    if (column === null)
      throw new Error(
        `Cannot find nested column for stack ${searchResult.place}`
      )

    return nestedLayouts.map(({ newLayout, old }) => ({
      old,
      newLayout: [
        {
          _type: 'nested',
          arguments: head.arguments,
          output: head.output,
          color: 'white',
          id: head.name,
          index: 0,
          step: head,
          steps: newLayout
        }
      ]
    }))
  }

  return []
}
