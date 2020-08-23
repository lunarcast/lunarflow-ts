import type { ADT } from 'ts-adt'
import { IndexedAst, collectArguments } from './lc'

export type TimelineStep = ADT<{
  call: { func: number; argument: number; name: number }
  nested: { name: number; arguments: number[] }
  flatten: { output: number; name: number; arguments: number[] }
}>

export type Timeline = TimelineStep[]

/**
 * Internal function which builds a timeline and finds he output id of any ast.
 *
 * @param ast THe ast to work with.
 */
function buildTimelineAndId(ast: IndexedAst): [Timeline, number] {
  if (ast._type === 'lambda') {
    const grouped = collectArguments(ast)
    const [nestedTimeline, output] = buildTimelineAndId(grouped.body)

    const timeline: Timeline = [
      { _type: 'nested', name: grouped.id, arguments: grouped.argumentIds },
      ...nestedTimeline,
      {
        _type: 'flatten',
        name: grouped.id,
        output,
        arguments: grouped.argumentIds
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
        argument: argId,
        name: ast.id
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
