import type { Ast } from './lc'
import type { ADT } from 'ts-adt'
import TsAdt from 'ts-adt'
import { lineColors } from './constants'
import { constantly } from '@thi.ng/compose'
import { isBefore, reversed } from './utils'
import type { Fn } from '@thi.ng/api'
import * as tx from '@thi.ng/transducers'

// TODO: See what I can do so I can just import this directly without breaking snowpack
const match = TsAdt.match

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

export type Layout = {
  lines: LayoutCell[][]
}

export type Program = {
  expressions: Ast[]
  output: string
}

const occurs = (name: string, program: Program) => {
  return (
    program.output === name ||
    program.expressions.some(
      (value) => value.argument === name || value.func === name
    )
  )
}

const mergeLayouts = (first: Layout, second: Layout): Layout => {
  return {
    lines: [...first.lines, ...second.lines]
  }
}

const unconsProgram = (program: Program): [Ast, Program] => {
  return [
    program.expressions[0],
    {
      output: program.output,
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
  existing: { cell: LayoutCell }
  new: { before: boolean; nextTo: number }
}>

/**
 * Find the place for the result of an expression.
 *
 * @param expression The expression to find the place for the result of.
 * @param layer The current layout layer.
 */
const findResultSpot = (expression: Ast, layer: LayoutCell[]): ResultSpot => {
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
      cell: spot.raw
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

const createLayout = (program: Program, previous: Layout): Layout => {
  if (program.expressions.length === 0) {
    return previous
  }

  const [lastLayer] = reversed(previous.lines)
  const [expression, remainingProgram] = unconsProgram(program)

  const withContinuations: LayoutCell[] = lastLayer.map(
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

  const spot = findResultSpot(expression, withContinuations)

  const getFunctionColor = () =>
    withContinuations
      .flatMap((cell) => (cell._type === 'nothing' ? [] : [cell]))
      .find((cell) => cell.name === expression.func)?.color ?? 'white'

  const layer: LayoutCell[] = withContinuations
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
            continues: occurs(cell.name, remainingProgram)
          }
        }

        if (cell.name === expression.func) {
          return {
            ...cell,
            _type: 'called',
            from: expression.argument,
            to: expression.name,
            continues: occurs(cell.name, remainingProgram)
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

  const updatedPrevious = {
    lines: previous.lines.map((line) =>
      line.flatMap((cell, index) => {
        if (spot._type === 'existing' || index !== spot.nextTo) {
          return [cell]
        }

        return spot.before ? [nothing, cell] : [cell, nothing]
      })
    )
  }

  const layout = mergeLayouts(updatedPrevious, {
    lines: [layer]
  })

  return createLayout(remainingProgram, layout)
}

export const startLayout = (inputs: string[], program: Program): Layout => {
  const firstLayer: LayoutCell[] = inputs.map((name) => {
    const continues = occurs(name, program)

    return {
      _type: 'line',
      continues,
      name,
      color: lineColors.next().value as string
    }
  })

  return createLayout(program, { lines: [firstLayer] })
}
