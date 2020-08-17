import type { Ast } from './lc'
import { rect, polygon, circle, line } from '@thi.ng/geom'
import type { IHiccupShape } from '@thi.ng/geom-api'
import {
  lineSpace,
  lineWidth,
  segmentLength,
  sinCallAngle,
  tgCallAngle,
  callOffset,
  lineColors,
  cosCallAngle,
  intersectionColor
} from './constants'
import { add2, sub2 } from '@thi.ng/vectors'

type LineDescriptor = {
  nextTo: string
  name: string
  argName: string
  argContinues: boolean
  funcContinues: boolean
}

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
    argName: ast.argument,
    name: ast.name,
    argContinues: continues(ast.argument),
    funcContinues: continues(ast.func)
  }
}

const reversed = <T>(array: T[]): T[] => [...array].reverse()

const enum SpawnDirection {
  Up,
  Down
}

type DataLine = {
  name: string
  continuity?: {
    argument: boolean
    function: boolean
  }
  spawnDirection?: SpawnDirection
  color: string
}

const isBefore = <T>(
  a: T,
  b: T,
  arr: T[],
  compare: (a: T, b: T) => boolean = (a, b) => a === b
): boolean => {
  for (const el of arr) {
    if (compare(el, a)) return true
    if (compare(el, b)) return false
  }

  return false
}

const formatLines = (
  func: DataLine,
  arg: string,
  result: Omit<DataLine, 'spawnDirection'>,
  arr: DataLine[]
) => {
  if (
    isBefore(
      func.name,
      arg,
      arr.map(({ name }) => name)
    )
  ) {
    return [{ ...result, spawnDirection: SpawnDirection.Down }, func]
  }

  return [func, { ...result, spawnDirection: SpawnDirection.Up }]
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
      (acc, current) => {
        return acc.flatMap((element) =>
          element.name === current.nextTo
            ? formatLines(
                element,
                current.argName,
                {
                  name: current.name,
                  continuity: {
                    argument: current.argContinues,
                    function: current.funcContinues
                  },
                  color: element.color
                },
                acc
              )
            : [element]
        )
      },
      oldInputs.map((name) => ({
        name,
        color: lineColors.next().value as string
      }))
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
  fill = 'white',
  length = segmentLength
) => {
  return rect([offset, getLineYPosition(index)], [length, lineWidth], {
    fill
  })
}

export const removeElement = <T>(el: T, arr: T[]) => arr.filter((a) => a !== el)

export const renderLambda = (inputs: string[], ast: Ast[], output: string) => {
  const lines = generateAstLines(inputs, ast, output)
  const lineIndices = toIndexMap(lines.map(({ name }) => name))
  const lineMap = new Map(lines.map((line) => [line.name, line]))

  const shapes: Array<IHiccupShape> = []
  let activeLines: string[] = []

  for (const input of inputs) {
    const index = lineIndices.get(input)!

    const shape = createSegment(index, 0, lineMap.get(input)?.color)

    shapes.push(shape)
    activeLines.push(input)
  }

  let offset = segmentLength

  for (const expression of ast) {
    const name = expression.name

    const startIndex = lineIndices.get(expression.argument)!
    const endIndex = lineIndices.get(name)!
    const functionIndex = lineIndices.get(expression.func)!
    const argColor = lineMap.get(expression.argument)?.color
    const functionColor = lineMap.get(expression.func)?.color
    const direction =
      lineMap.get(name)?.spawnDirection === SpawnDirection.Down ? -1 : 1

    const whenUp = (a: number, b = 0) => (direction === 1 ? a : b)

    const start = [
      offset + callOffset,
      getLineYPosition(startIndex) + whenUp(lineWidth)
    ]

    const endY = getLineYPosition(endIndex) + whenUp(lineWidth)
    const endX = start[0] + direction * tgCallAngle * (-endY + start[1])
    const intersectionY = getLineYPosition(functionIndex) + lineWidth / 2
    const intersectionX =
      start[0] + tgCallAngle * direction * (-intersectionY + start[1])

    const diff = sub2(null, [endX, endY], start)

    // I used geometry to come up with this weird formula.
    // There might be a shorter form, but I'm too lazy to find it
    const anglePointOffset =
      tgCallAngle * (lineWidth / sinCallAngle - lineWidth)

    const anglePoint = sub2([], start, [
      anglePointOffset,
      direction * lineWidth
    ])
    const intersection = [intersectionX, intersectionY]
    const intersections = [
      intersection,
      sub2([], intersection, [lineWidth / cosCallAngle, 0])
    ]

    const argToFunction = polygon(
      direction === 1
        ? [
            [offset, getLineYPosition(startIndex) + lineWidth],
            start,
            ...intersections,
            anglePoint,
            [offset, getLineYPosition(startIndex)]
          ]
        : [
            [offset, getLineYPosition(startIndex) + lineWidth],
            anglePoint,
            intersections[1],
            intersections[0],
            start,
            [offset, getLineYPosition(startIndex)]
          ],
      { fill: argColor }
    )

    const functionToResult = polygon(
      direction === 1
        ? [
            intersections[1],
            intersections[0],
            [endX, endY],
            [endX + callOffset, endY],
            [endX + callOffset, endY - lineWidth],
            add2([], anglePoint, diff)
          ]
        : [
            intersections[1],
            intersections[0],
            [endX, endY],
            [endX + callOffset, endY],
            [endX + callOffset, endY + lineWidth],
            add2([], anglePoint, diff)
          ],
      {
        fill: functionColor
      }
    )

    const visibleXDiff = diff[0] + callOffset * 2
    const continuity = lineMap.get(name)?.continuity

    for (const line of activeLines) {
      if (
        line === name ||
        (line === expression.func && continuity?.function !== true) ||
        (line === expression.argument && continuity?.argument !== true)
      )
        continue

      const index = lineIndices.get(line)!

      shapes.push(
        createSegment(index, offset, lineMap.get(line)?.color, visibleXDiff)
      )
    }

    shapes.push(
      rect(
        [offset, getLineYPosition(functionIndex)],
        [intersection[0] - offset, lineWidth],
        { fill: functionColor }
      )
    )

    shapes.push(argToFunction, functionToResult)

    shapes.push(
      circle(sub2([], intersection, [lineWidth / 2, 0]), lineWidth / 1.1, {
        fill: intersectionColor
      })
    )

    activeLines.push(name)

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
