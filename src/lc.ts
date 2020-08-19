import type { ADT } from 'ts-adt'
import type { Fn } from '@thi.ng/api'

export type Lambda<T> = {
  argument: string
  body: Ast<T>
}

export type Program<T = {}> = {
  arguments: string[]
  body: Ast<T>
}

export type Var = { name: string }
export type Call<T> = { func: Ast<T>; argument: Ast<T> }

/**
 * Our own weird representation for the lambda calculus. Designed for ease of rendering.
 */
export type Ast<T> = T &
  ADT<{
    // let: { name: string; value: Ast; in: Ast }
    call: Call<T>
    lambda: Lambda<T>
    var: Var
  }>

/**
 * type which has an unique id.
 */
type IId<T> = { id: T }

/**
 * Run a function on each node of an ast.
 *
 * @param f The function to run on each layer.
 */
const everywhereOnAst = <T, U = {}>(f: Fn<Ast<T>, Ast<T> & U>) => (
  ast: Ast<T>
): Ast<U> => {
  const updated = f(ast)
  const go = everywhereOnAst(f)

  if (updated._type === 'call') {
    return {
      ...updated,
      argument: go(updated.argument),
      func: go(updated.func)
    }
  }

  if (updated._type === 'lambda') {
    return {
      ...updated,
      body: go(updated.body)
    }
  }

  return updated
}

/**
 * Add an id to every node in the ast.
 *
 * @param ast The ast to add ids to.
 * @param ids Generator for the actual ids.
 */
export const withIds = <T = {}, I = number>(
  ast: Ast<T>,
  ids: Generator<I, void>
): Ast<T & IId<I>> => {
  const go = everywhereOnAst<T, T & IId<I>>((expression) => {
    const id = ids.next()

    if (id.done) {
      throw new Error(`Cannot generate enough ids for the entire ast`)
    }

    return {
      ...expression,
      id: id.value
    }
  })

  return go(ast)
}
