import {
  Ast,
  Lambda,
  Program,
  Call,
  occursInProgram,
  lambdaToProgram,
  unconsProgram,
  free,
  occurs
} from './lc'
import type { ADT } from 'ts-adt'
import TsAdt from 'ts-adt'
import { lineColors } from './constants'
import { constantly } from '@thi.ng/compose'
import { isBefore, reversed } from './utils'
import type { Fn } from '@thi.ng/api'
import * as tx from '@thi.ng/transducers'

// TODO: See what I can do so I can just import this directly without breaking snowpack
const match = TsAdt.match

export const enum Direction {
  Up,
  Down
}

export type ILine = {
  color: string
  name: string
}

export type LayoutCell = ADT<{
  line: ILine & {
    continues: boolean
  }
  fork: ILine & {
    continues: boolean
    to: string
  }
  called: ILine & {
    continues: boolean
    direction: Direction
    from: string
    to: string
  }
  created: ILine & {
    from: string
  }
  forked: ILine & {
    from: string
  }
  nothing: {}
}>

// Constructors for layout cells
const line = (color: string, name: string, continues = true): LayoutCell => ({
  _type: 'line',
  color,
  name,
  continues
})

const nothing: LayoutCell = { _type: 'nothing' }

export type LayoutColumn = {
  cells: LayoutCell[]
  data: ADT<{
    empty: {}
    call: {
      called: string
      argument: string
      output: string
    }
  }>
}

export type Layout = {
  columns: LayoutColumn[]
}

const emptyLayout: Layout = {
  columns: []
}

const mergeLayouts = (first: Layout, second: Layout): Layout => {
  return {
    columns: [...first.columns, ...second.columns]
  }
}

/**
 * Split a layout into its head and the rest.
 *
 * @param layout The layout to split.
 */
export const unconsLayout = (layout: Layout): [LayoutColumn, Layout] => {
  return [
    layout.columns[0],
    {
      columns: layout.columns.slice(1)
    }
  ]
}

type CellSearchResult = ADT<{
  atOffset: { offset: number; raw: LayoutCell }
  createNew: {}
}>

/**
 * Search for a spot to put a line.
 *
 * @param trough The layer to search tru.
 * @param maxDeviation The maximum number of spaces away to accept results from.
 */
const searchCell = (
  trough: LayoutCell[],
  exclude: Set<string> = new Set(),
  maxDeviation = 3
): CellSearchResult => {
  for (let i = 0; i < maxDeviation && i < trough.length; i++) {
    const cell = trough[i]

    if (cell._type === 'nothing' || !exclude.has(cell.name)) {
      return {
        _type: 'atOffset',
        offset: i,
        raw: cell
      }
    }
  }

  return {
    _type: 'createNew'
  }
}

type ResultSpot = ADT<{
  existing: { before: boolean; cell: LayoutCell }
  new: { before: boolean; nextTo: number }
}>

/**
 * Find the place for the result of an expression.
 *
 * @param expression The expression to find the place for the result of.
 * @param layer The current layout layer.
 */
const findResultSpot = (expression: Call, layer: LayoutCell[]): ResultSpot => {
  const before = isBefore(
    expression.func,
    expression.argument,
    layer.flatMap((cell) => (cell._type === 'nothing' ? [] : [cell.name]))
  )

  const excludedLines = new Set([expression.argument, expression.func])

  const isNotFunction = (cell: LayoutCell) =>
    cell._type === 'nothing' || cell.name !== expression.func

  const transduceLayer = <U>(transducer: tx.Transducer<LayoutCell, U>) =>
    tx.transduce(transducer, tx.push(), layer)

  const spot = searchCell(
    before
      ? reversed(transduceLayer(tx.takeWhile(isNotFunction)))
      : transduceLayer(tx.dropWhile(isNotFunction)),
    excludedLines
  )

  if (spot._type === 'atOffset') {
    return {
      _type: 'existing',
      cell: spot.raw,
      before
    }
  }

  return {
    _type: 'new',
    before,
    nextTo: layer.findIndex(
      (a) => a._type !== 'nothing' && a.name === expression.func
    )
  }
}

const mapColumn = (
  column: LayoutColumn,
  f: Fn<LayoutCell, LayoutCell>
): LayoutColumn => {
  return {
    data: column.data,
    cells: column.cells.map(f)
  }
}

/**
 * Add an empty row to a layout.
 *
 * @param layout The layout to add the line to.
 * @param nextTo The index to add the line after.
 * @param before If this is true the line will be inserted before the target index, not after it,
 */
const createLine = (layout: Layout, nextTo: number, before = false): Layout => {
  return {
    columns: layout.columns.map((line) => ({
      data: line.data,
      cells: line.cells.flatMap((cell, index) => {
        if (index !== nextTo) {
          return [cell]
        }

        return before ? [nothing, cell] : [cell, nothing]
      })
    }))
  }
}

export function pushCells(
  layout: Layout,
  cells: LayoutCell[],
  nextTo: number
): Layout {
  const emptyCells = cells.map(constantly(nothing))

  return {
    columns: layout.columns.map((column, columnIndex) => {
      const isLast = columnIndex === layout.columns.length - 1

      return {
        data: column.data,
        cells:
          column.cells.length === 0
            ? isLast
              ? cells
              : emptyCells
            : column.cells.flatMap((cell, index) => {
                if (index === nextTo) {
                  if (isLast) return [cell, ...cells]

                  return [cell, ...emptyCells]
                }

                return [cell]
              })
      }
    })
  }
}

/**
 * Create a new column extending an existing layout.
 *
 * @param layout The layout to extend.
 * @param data Data to attach to the new column.
 */
const extendLayout = (
  layout: Layout,
  data: LayoutColumn['data'] = { _type: 'empty' }
): Layout => {
  const columnCount = layout.columns.length

  return {
    columns: [
      ...layout.columns,
      {
        data,
        cells: columnCount === 0 ? [] : layout.columns[columnCount - 1].cells
      }
    ]
  }
}

const advanceCell: Fn<LayoutCell, LayoutCell> = match({
  line: ({ color, name, continues }) =>
    continues ? line(color, name) : nothing,
  created: ({ color, name }) => line(color, name),
  called: ({ color, continues, name }) =>
    continues ? line(color, name) : nothing,
  fork: ({ continues, color, name }) =>
    continues ? line(color, name) : nothing,
  forked: ({ name, color }) => line(color, name),
  nothing: constantly(nothing)
})

/**
 * Create a new column in a layout where a cell has a changed name.
 *
 * @param layout The layout to extend with the renaming.
 * @param oldName The old name of the cell.
 * @param newName The new name of the cell.
 */
const renameCell = (
  layout: Layout,
  oldName: string,
  newName: string
): Layout => {
  if (layout.columns.length === 0)
    throw new Error(`Cannot rename cell in empty layout`)

  const lastColumn = layout.columns[layout.columns.length - 1]

  return mergeLayouts(layout, {
    columns: [
      {
        data: { _type: 'empty' },
        cells: lastColumn.cells.map((cell) => {
          const advanced = advanceCell(cell)

          if (advanced._type !== 'line') return advanced

          return line(
            advanced.color,
            advanced.name === oldName ? newName : advanced.name
          )
        })
      }
    ]
  })
}

/**
 * Different kind of spots we can place nested lambdas in.
 */
type NestedProgramPlacement = ADT<{
  nextTo: { name: string }
  far: {}
}>

/**
 * Find a spot to place a nested lambda.
 *
 * @param expression The expression we can search trough.
 */
function getNestedProgramPlacement(expression: Ast): NestedProgramPlacement {
  const freeTerms = free(expression, new Set())
  const firstFreeTerm = freeTerms.next()

  // When there is at least a free term
  if (!firstFreeTerm.done) {
    return {
      _type: 'nextTo',
      name: firstFreeTerm.value
    }
  }

  // TODO: do this in a smarter way

  return { _type: 'far' }
}
/**
 * Continue a layout given the current and previous programs.
 *
 * @param program The current program we are working on.
 * @param previous The previous program we solved.
 */
const continueLayout = (program: Program, previous: Layout): Layout => {
  if (program.expressions.length === 0) {
    return previous
  }

  // console.log('Continuing layout')
  // console.log(program, previous)

  const [lastLayer] = reversed(previous.columns)
  const [expression, remainingProgram] = unconsProgram(program)

  if (expression._type !== 'call') {
    const program = lambdaToProgram(expression)
    const placement = getNestedProgramPlacement(expression)

    console.log({ program, expression })

    if (placement._type === 'far') {
      console.log('placed far')
    } else {
      console.log(`Placed next to ${placement.name}`)

      // TODO: spawn this in better positions
      const nested = startLayout(
        program,
        lastLayer.cells.findIndex(
          (cell) => cell._type !== 'nothing' && cell.name === placement.name
        ),
        previous
      )

      const withRename = renameCell(nested, program.output, program.name)

      return continueLayout(remainingProgram, withRename)
    }

    throw new Error('Cannot handle lambdas yet')
  }

  console.log(`yohoohohoho ${expression.name}`)

  const withContinuations = mapColumn(lastLayer, advanceCell)

  const spot = findResultSpot(expression, withContinuations.cells)

  const getFunctionColor = () =>
    withContinuations.cells
      .flatMap((cell) => (cell._type === 'nothing' ? [] : [cell]))
      .find((cell) => cell.name === expression.func)?.color ?? 'white'

  const layer: LayoutColumn = {
    data: {
      _type: 'call',
      argument: expression.argument,
      called: expression.func,
      output: expression.name
    },
    cells: withContinuations.cells
      .map(
        (cell): LayoutCell => {
          if (spot._type === 'existing' && spot.cell === cell) {
            return {
              _type: 'created',
              color: getFunctionColor(),
              name: expression.name,
              from: expression.func
            }
          }

          if (cell._type !== 'line') {
            return cell
          }

          if (cell.name === expression.argument) {
            return {
              ...cell,
              _type: 'fork',
              to: expression.func,
              continues: occursInProgram(cell.name, remainingProgram)
            }
          }

          if (cell.name === expression.func) {
            return {
              ...cell,
              _type: 'called',
              from: expression.argument,
              to: expression.name,
              continues: occursInProgram(cell.name, remainingProgram),
              direction: spot.before ? Direction.Down : Direction.Up
            }
          }

          return cell
        }
      )
      .flatMap((cell) => {
        if (
          cell._type === 'nothing' ||
          spot._type === 'existing' ||
          cell.name !== expression.func
        ) {
          return [cell]
        }

        const resulting: LayoutCell = {
          _type: 'created',
          from: expression.func,
          color: getFunctionColor(),
          name: expression.name
        }

        return spot.before ? [resulting, cell] : [cell, resulting]
      })
  }

  const updatedPrevious =
    spot._type === 'existing'
      ? previous
      : createLine(previous, spot.nextTo, spot.before)

  const layout = mergeLayouts(updatedPrevious, {
    columns: [layer]
  })

  return continueLayout(remainingProgram, layout)
}

/**
 * Create a layout for a program.
 *
 * @param program THe program to create the layout of.
 */
export function startLayout(
  program: Program,
  nextTo = 0,
  previousLayout: Layout = emptyLayout
): Layout {
  const programBody: Program = { ...program, arguments: [] }

  const firstLayer: LayoutCell[] = program.arguments.map((name) => {
    const continues = occursInProgram(name, programBody)

    return {
      _type: 'line',
      continues,
      name,
      color: lineColors.next().value as string
    }
  })

  const withCells = pushCells(extendLayout(previousLayout), firstLayer, nextTo)

  console.log('Started layout')

  console.log({
    // program,

    nextTo,
    previousLayout,
    programBody,
    firstLayer,
    withCells
  })

  return continueLayout(programBody, withCells)
}
