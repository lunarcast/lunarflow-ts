import type { Ast } from './lc'
import {
  rect,
  Rect,
  polygon,
  Polygon,
  Line,
  line,
  circle,
  Circle
} from '@thi.ng/geom'
import {
  lineSpace,
  lineWidth,
  segmentLength,
  sinCallAngle,
  tgCallAngle,
  callOffset
} from './constants'
import { add2, sub2 } from '@thi.ng/vectors'

type LineDescriptor = { nextTo: string; name: string }

const getAstName = (ast: Ast): string =>
  ast.name ?? `${ast.func}(${ast.argument})`

const generateAstLine = (ast: Ast): LineDescriptor => {
  return { nextTo: ast.func, name: getAstName(ast) }
}

const reversed = <T>(array: T[]): T[] => [...array].reverse()

const generateAstLines = (oldInputs: string[], ast: Ast[]) => {
  const lines = ast.map(generateAstLine)

  return reversed(
    lines.reduce(
      (acc, curr) =>
        acc.flatMap((element) =>
          element === curr.nextTo ? [element, curr.name] : [element]
        ),
      oldInputs
    )
  )
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

export const renderLambda = (inputs: string[], ast: Ast[], output: string) => {
  const lines = generateAstLines(inputs, ast)
  const lineMap = toIndexMap(lines)

  const shapes: Array<Rect | Polygon | Line | Circle> = []
  const activeLines: string[] = []

  for (const input of inputs) {
    const index = lineMap.get(input)!

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

    const startIndex = lineMap.get(expression.argument)!
    const endIndex = lineMap.get(name)!

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
      if (line === name || line === expression.argument) continue

      const index = lineMap.get(line)!

      shapes.push(createSegment(index, offset, visibleXDiff))
    }

    activeLines.push(name)
    offset += visibleXDiff
  }

  return shapes
}
