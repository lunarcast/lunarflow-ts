import type { ADT } from 'ts-adt'
import type { Fn } from '@thi.ng/api'

/**
 * Base ast type. This is what we can convert other representations to.
 */
export type Ast = ADT<{
  call: { func: Ast; argument: Ast }
  lambda: { argument: string; body: Ast }
  var: { name: string }
}>

/**
 * Modified ast which indexes everything with an id.
 */
export type IndexedAst = ADT<{
  call: { func: IndexedAst; argument: IndexedAst }
  lambda: { argument: string; argumentId: number; body: IndexedAst }
  var: { name: string }
}> & { id: number }

/**
 * Add an id to every node in the ast.
 *
 * @param ast The ast to add ids to.
 * @param ids Generator for the actual ids.
 */
export const indexAst = (
  ast: Ast,
  ids: Generator<number, void>,
  scope: Record<string, number> = {}
): IndexedAst => {
  const getId = () => {
    const id = ids.next()

    if (id.done)
      throw new Error(`Cannot generate enough ids for the entire ast`)

    return id.value
  }

  if (ast._type === 'var') {
    if (!Reflect.has(scope, ast.name))
      throw new Error(`Variable ${ast.name} not in scope.`)

    return {
      ...ast,
      id: scope[ast.name]
    }
  }

  if (ast._type === 'call') {
    return {
      _type: 'call',
      argument: indexAst(ast.argument, ids, scope),
      func: indexAst(ast, ids, scope),
      id: getId()
    }
  }

  if (ast._type === 'lambda') {
    const argumentId = getId()

    return {
      _type: 'lambda',
      argument: ast.argument,
      id: getId(),
      argumentId,
      body: indexAst(ast.body, ids, { ...scope, [ast.argument]: argumentId })
    }
  }

  throw new Error(`Ast ${ast} has an unknown type.`)
}

/**
 * When we render lambdas we group them together as "visual sugar"
 */
export type LambdaGroup = {
  argumentIds: number[]
  argumentNames: string[]
  body: IndexedAst
  id: number
  ids: number[]
  raw: IndexedAst[]
}

/**
 * Collect the arguments of multiple lambdas into a lambda group.
 *
 * @param lambda The lambda to start with.
 */
export const collectArguments = (lambda: IndexedAst): LambdaGroup => {
  // TODO: Maybe find a way to enforce this at compile time?
  if (lambda._type !== 'lambda') {
    throw new Error(
      `Cannot collect arguments of non-lambda ast ${JSON.stringify(lambda)}`
    )
  }

  if (lambda.body._type !== 'lambda') {
    return {
      argumentNames: [lambda.argument],
      argumentIds: [lambda.argumentId],
      id: lambda.id,
      ids: [lambda.id],
      body: lambda.body,
      raw: [lambda]
    }
  }

  const nested = collectArguments(lambda.body)

  return {
    argumentNames: [lambda.argument, ...nested.argumentNames],
    argumentIds: [lambda.argumentId, ...nested.argumentIds],
    id: lambda.id,
    ids: [lambda.id, ...nested.ids],
    body: nested.body,
    raw: [lambda, ...nested.raw]
  }
}
