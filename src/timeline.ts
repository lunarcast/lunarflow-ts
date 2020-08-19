import type { ADT } from 'ts-adt'
import type { IndexedAst } from './lc'

export type TimelineStep = ADT<{
  startLine: { name: number }
  call: { func: number; argument: number }
  nested: { name: number }
  flatten: { output: number; name: number }
}>

export type Timeline = TimelineStep[]

/**
 * Internal function which builds a timeline and finds he output id of any ast.
 *
 * @param ast THe ast to work with.
 */
function buildTimelineAndId(ast: IndexedAst): [Timeline, number] {
  if (ast._type === 'lambda') {
    const [nestedTimeline, output] = buildTimelineAndId(ast.body)

    const timeline: Timeline = [
      { _type: 'nested', name: ast.id },
      {
        _type: 'startLine',
        name: ast.argumentId
      },
      ...nestedTimeline,
      {
        _type: 'flatten',
        name: ast.id,
        output
      }
    ]

    return [timeline, ast.id]
  }

  if (ast._type === 'var') {
    return [[], ast.id]
  }

  if (ast._type === 'call') {
    const [funcTimeline, funcId] = buildTimelineAndId(ast.func)
    const [argTimeline, argId] = buildTimelineAndId(ast.argument)

    const timeline: Timeline = [
      ...funcTimeline,
      ...argTimeline,
      {
        _type: 'call',
        func: funcId,
        argument: argId
      }
    ]

    return [timeline, ast.id]
  }

  throw new Error(
    `Cannot create timeline for ast ${ast} because it has an unknown type.`
  )
}

/**
 * Transpile an ast into a timeline we can use for rendering.
 *
 * @param ast The ast to build.
 */
export const buildTimeline = (ast: IndexedAst) => buildTimelineAndId(ast)[0]
