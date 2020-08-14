import type { Ast } from './lc'
import { rect, Rect, polygon, Polygon, Line, line, Circle } from '@thi.ng/geom'
import {
  lineSpace,
  lineWidth,
  segmentLength,
  sinCallAngle,
  tgCallAngle,
  callOffset
} from './constants'
import { add2, sub2, exp } from '@thi.ng/vectors'

type LineDescriptor = {
  nextTo: string
  name: string
  argContinues: boolean
  funcContinues: boolean
}

const getAstName = (ast: Ast): string =>
  ast.name ?? `${ast.func}(${ast.argument})`

const occurs = (name: string, ast: Ast[], past: number, output: string) => {
  return (
    output === name ||
    ast.some(
      (value, index) =>
        (value.argument === name || value.func === name) && index > past
    )
  )
}
const generateAstLine = (
  ast: Ast,
  continues: (name: string) => boolean
): LineDescriptor => {
  return {
    nextTo: ast.func,
    name: getAstName(ast),
    argContinues: continues(ast.argument),
    funcContinues: continues(ast.func)
  }
}

const reversed = <T>(array: T[]): T[] => [...array].reverse()

type DataLine = {
  name: string
  continuity?: {
    argument: boolean
    function: boolean
  }
}

const generateAstLines = (
  oldInputs: string[],
  ast: Ast[],
  output: string
): DataLine[] => {
  const lines = ast.map((expression, index) =>
    generateAstLine(expression, (name) => occurs(name, ast, index, output))
  )

  const names = reversed(
    lines.reduce(
      (acc, current, index, arr) => {
        return acc.flatMap((element) =>
          element.name === current.nextTo
            ? [
                element,
                {
                  name: current.name,
                  continuity: {
                    argument: current.argContinues,
                    function: current.funcContinues
                  }
                }
              ]
            : [element]
        )
      },
      oldInputs.map((name) => ({ name }))
    )
  )

  return names
}

const toIndexMap = <T>(array: T[]): Map<T, number> => {
  const result = new Map<T, number>()

  for (let index = 0; index < array.length; index++) {
    const element = array[index]

    result.set(element, index)
  }

  return result
}

const getLineYPosition = (index: number): number => {
  return lineSpace + index * (lineSpace + lineWidth)
}

const createSegment = (
  index: number,
  offset: number,
  length = segmentLength
) => {
  return rect([offset, getLineYPosition(index)], [length, lineWidth], {
    fill: '#F37878'
  })
}

export const removeElement = <T>(el: T, arr: T[]) => arr.filter((a) => a !== el)

export const renderLambda = (inputs: string[], ast: Ast[], output: string) => {
  const lines = generateAstLines(inputs, ast, output)
  const lineIndices = toIndexMap(lines.map(({ name }) => name))
  const lineMap = new Map(lines.map((line) => [line.name, line]))

  const shapes: Array<Rect | Polygon | Line | Circle> = []
  let activeLines: string[] = []

  for (const input of inputs) {
    const index = lineIndices.get(input)!

    const shape = createSegment(index, 0)

    shapes.push(shape)
    activeLines.push(input)
  }

  let offset = segmentLength

  for (const expression of ast) {
    shapes.push(
      line([offset, 0], [offset, window.innerHeight], { stroke: 'white' })
    )

    const name = getAstName(expression)

    const startIndex = lineIndices.get(expression.argument)!
    const endIndex = lineIndices.get(name)!

    const start = [
      offset + callOffset,
      getLineYPosition(startIndex) + lineWidth
    ]

    const endY = getLineYPosition(endIndex) + lineWidth
    const endX = start[0] + tgCallAngle * (-endY + start[1])
    const diff = sub2(null, [endX, endY], start)

    // I used geometry to come up with this weird formula.
    // There might be a shorter form, but I'm too lazy to find it
    const intersectionOffset =
      tgCallAngle * (lineWidth / sinCallAngle - lineWidth)

    const intersectionPoint = sub2([], start, [intersectionOffset, lineWidth])
    shapes.push(
      polygon(
        [
          [offset, getLineYPosition(startIndex) + lineWidth],
          start,
          [endX, endY],
          [endX + callOffset, endY],
          [endX + callOffset, endY - lineWidth],
          add2([], intersectionPoint, diff),
          intersectionPoint,
          [offset, getLineYPosition(startIndex)]
        ],
        { fill: '#F37878' }
      )
    )

    const visibleXDiff = diff[0] + callOffset * 2

    for (const line of activeLines) {
      if (
        line === name ||
        (line === expression.argument &&
          !lineMap.get(name)?.continuity?.argument === true)
      )
        continue

      const index = lineIndices.get(line)!

      shapes.push(createSegment(index, offset, visibleXDiff))
    }

    activeLines.push(name)

    const continuity = lineMap.get(name)?.continuity

    if (continuity) {
      if (!continuity.argument) {
        activeLines = removeElement(expression.argument, activeLines)
      }

      if (!continuity.function) {
        activeLines = removeElement(expression.func, activeLines)
      }
    }

    offset += visibleXDiff
  }

  return shapes
}
