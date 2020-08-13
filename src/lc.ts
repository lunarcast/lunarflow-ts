import type { ADT } from 'ts-adt'

export const enum AstKind {
  Var,
  Call,
  Abs
}

export type Ast = ADT<{
  [AstKind.Var]: { name: string }
  [AstKind.Abs]: { name: string; body: Ast }
  [AstKind.Call]: { function: Ast; input: Ast }
}>

export const lambda = (name: string, body: Ast): Ast => ({
  _type: AstKind.Abs,
  name,
  body
})

export const call = (lambda: Ast, input: Ast): Ast => ({
  _type: AstKind.Call,
  input,
  function: lambda
})

export const mkVar = (name: string): Ast => ({ _type: AstKind.Var, name })

export const calls = (func: Ast, ...args: Ast[]) => args.reduce(call, func)

/**
 * Check if a variable occurs inside an ast
 *
 * @param name THe name of the variable to search/
 * @param ast The ast to search trough.
 */
const occurs = (name: string, ast: Ast): boolean => {
  if (ast._type === AstKind.Var) {
    return name === ast.name
  }

  if (ast._type === AstKind.Abs) {
    if (ast.name === name) return false

    return occurs(name, ast.body)
  }

  return occurs(name, ast.function) || occurs(name, ast.input)
}

export const normalize = function* (
  ast: Ast,
  ctx: Record<string, Ast> = {}
): Generator<Ast> {
  if (ast._type === AstKind.Var && ctx[ast.name] !== undefined) {
    yield ctx[ast.name]
  } else if (ast._type === AstKind.Abs) {
    for (const body of normalize(ast.body, ctx)) {
      yield {
        ...ast,
        body
      }
    }
  } else if (ast._type === AstKind.Call) {
    let lambda = ast.function

    for (const newLambda of normalize(ast.function, ctx)) {
      lambda = newLambda
      yield call(newLambda, ast.input)
    }

    if (lambda._type === AstKind.Abs && !occurs(lambda.name, lambda.body)) {
      return yield lambda.body
    }

    let argument = ast.input

    for (const newArgument of normalize(ast.input, ctx)) {
      argument = newArgument
      yield call(lambda, newArgument)
    }

    if (lambda._type === AstKind.Abs) {
      yield* normalize(lambda.body, { ...ctx, [lambda.name]: argument })
    }
  }
}

export const common = {
  False: lambda('true', lambda('false', mkVar('false'))),
  True: lambda('true', lambda('false', mkVar('true'))),
  if: lambda(
    'condition',
    lambda(
      'then',
      lambda(
        'else',
        call(call(mkVar('condition'), mkVar('then')), mkVar('else'))
      )
    )
  ),
  or: lambda(
    'a',
    lambda('b', call(call(mkVar('a'), mkVar('True')), mkVar('b')))
  )
}

const wrapWhen = (value: string, condition: boolean) =>
  condition ? `(${value})` : value

export const printAst = (ast: Ast, insideCall = false): string => {
  if (ast._type === AstKind.Var) {
    return ast.name
  }

  if (ast._type === AstKind.Abs) {
    return `λ${ast.name}. ${printAst(ast.body)}`
  }

  const argNeedParenthesis =
    ast.input._type === AstKind.Call ||
    (insideCall && ast.input._type === AstKind.Abs)
  const lambdaNeedsParenthesis = ast.function._type === AstKind.Abs

  return `${wrapWhen(
    printAst(ast.function, true),
    lambdaNeedsParenthesis
  )} ${wrapWhen(printAst(ast.input), argNeedParenthesis)}`
}
