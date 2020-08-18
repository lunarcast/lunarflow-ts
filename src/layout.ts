import type { Ast, Lambda, Program, Call } from './lc'
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
  line: ILine
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
  nothing: {}
}>

// Constructors for layout cells
const line = (color: string, name: string): LayoutCell => ({
  _type: 'line',
  color,
  name
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
  lines: LayoutColumn[]
}

/**
 * Group multiple lambdas together in a single program.
 *
 * @param lambda The lambda to start from.
 */
const getProgram = (lambda: Lambda): Program => {
  if (
    lambda.expressions.length !== 1 ||
    lambda.expressions[0]._type !== 'lambda'
  ) {
    return { ...lambda, arguments: [lambda.argument] }
  }

  const nested = getProgram(lambda)

  return {
    ...nested,
    arguments: [lambda.argument, ...nested.arguments]
  }
}

const occurs = (name: string, expression: Ast): boolean => {
  if (expression._type === 'call') {
    return expression.argument === name || expression.func === name
  }

  if (expression.argument === name) return false

  return expression.output === name || occursIn(name, expression.expressions)
}

function occursIn(name: string, expressions: Ast[]): boolean {
  return expressions.some((expression) => occurs(name, expression))
}

const occursInProgram = (name: string, program: Program): boolean => {
  if (program.arguments.includes(name)) {
    return false
  }

  return program.output === name || occursIn(name, program.expressions)
}

const mergeLayouts = (first: Layout, second: Layout): Layout => {
  return {
    lines: [...first.lines, ...second.lines]
  }
}

/**
 * Split a layout into its head and the rest.
 *
 * @param layout The layout to split.
 */
export const unconsLayout = (layout: Layout): [LayoutColumn, Layout] => {
  return [
    layout.lines[0],
    {
      lines: layout.lines.slice(1)
    }
  ]
}

/**
 * Split a program into its head and the rest.
 *
 * @param program The program to split.
 */
const unconsProgram = (program: Program): [Ast, Program] => {
  return [
    program.expressions[0],
    {
      ...program,
      arguments: [],
      expressions: program.expressions.slice(1)
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

const createLayout = (program: Program, previous: Layout): Layout => {
  if (program.expressions.length === 0) {
    return previous
  }

  const [lastLayer] = reversed(previous.lines)
  const [expression, remainingProgram] = unconsProgram(program)

  if (expression._type !== 'call') throw new Error('Cannot handle lambdas yet')

  const withContinuations = mapColumn(
    lastLayer,
    match({
      line: ({ color, name }) => line(color, name),
      created: ({ color, name }) => line(color, name),
      called: ({ color, continues, name }) =>
        continues ? line(color, name) : nothing,
      fork: ({ continues, color, name }) =>
        continues ? line(color, name) : nothing,
      nothing: constantly(nothing)
    })
  )

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

  const updatedPrevious = {
    lines: previous.lines.map((line) => ({
      data: line.data,
      cells: line.cells.flatMap((cell, index) => {
        if (spot._type === 'existing' || index !== spot.nextTo) {
          return [cell]
        }

        return spot.before ? [nothing, cell] : [cell, nothing]
      })
    }))
  }

  const layout = mergeLayouts(updatedPrevious, {
    lines: [layer]
  })

  return createLayout(remainingProgram, layout)
}

export const startLayout = (program: Program): Layout => {
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

  return createLayout(programBody, {
    lines: [{ cells: firstLayer, data: { _type: 'empty' } }]
  })
}
