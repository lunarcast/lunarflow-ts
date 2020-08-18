import { rect, polygon, circle } from '@thi.ng/geom'
import type { IHiccupShape } from '@thi.ng/geom-api'
import {
  lineSpace,
  lineWidth,
  segmentLength,
  sinCallAngle,
  tgCallAngle,
  callOffset,
  cosCallAngle,
  intersectionColor
} from './constants'
import { add2, sub2 } from '@thi.ng/vectors'
import { Layout, unconsLayout, Direction, LayoutCell } from './layout'

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

const renderSegment = (
  cell: LayoutCell,
  getIndex: (name: string) => number,
  length: number,
  offset: number
): IHiccupShape[] => {
  if (
    cell._type === 'line' ||
    (cell._type === 'called' && cell.continues) ||
    (cell._type === 'fork' && cell.continues)
  ) {
    const shape = createSegment(getIndex(cell.name), offset, cell.color, length)

    return [shape]
  }

  return []
}

export const renderLambda = (layout: Layout, offset = 0): IHiccupShape[] => {
  if (layout.lines.length === 0) return []

  const [{ cells, data }, remainingLayout] = unconsLayout(layout)

  const lineIndices = toIndexMap(
    cells.map((cell) => (cell._type === 'nothing' ? '__unknown' : cell.name))
  )

  const getIndex = (name: string) => lineIndices.get(name)!

  const lineMap = new Map(
    cells.flatMap((cell) =>
      cell._type === 'nothing' ? [] : [[cell.name, cell]]
    )
  )

  const debug: IHiccupShape[] = []
  const segments: IHiccupShape[] = []

  if (data._type === 'call') {
    const startIndex = lineIndices.get(data.argument)!

    const endIndex = lineIndices.get(data.output)!
    const functionIndex = lineIndices.get(data.called)!

    const functionCell = lineMap.get(data.called)!
    const argument = lineMap.get(data.argument)

    if (functionCell._type !== 'called')
      throw new Error(`Cannot call line of type ${functionCell._type}`)

    if (argument?._type !== 'fork')
      throw new Error(`Cannot use line of type ${argument?._type} as argument`)

    const direction = functionCell.direction === Direction.Up ? -1 : 1

    const whenUp = (a: number, b = 0) =>
      functionCell.direction === Direction.Down ? a : b

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
      { fill: argument.color }
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
        fill: functionCell.color
      }
    )

    const visibleXDiff = diff[0] + callOffset * 2

    const func = rect(
      [offset, getLineYPosition(functionIndex)],
      [intersection[0] - offset, lineWidth],
      { fill: functionCell.color }
    )

    const intersectionMark = circle(
      sub2([], intersection, [lineWidth / 2, 0]),
      lineWidth / 1.1,
      {
        fill: intersectionColor
      }
    )

    return [
      ...cells.flatMap((cell) =>
        renderSegment(cell, getIndex, visibleXDiff, offset)
      ),
      func,
      argToFunction,
      functionToResult,
      func,
      intersectionMark,
      ...debug,
      ...renderLambda(remainingLayout, offset + visibleXDiff)
    ]
  }

  return [
    ...cells.flatMap((cell) =>
      renderSegment(cell, getIndex, segmentLength, offset)
    ),
    ...debug,
    ...renderLambda(remainingLayout, offset + segmentLength)
  ]
}
