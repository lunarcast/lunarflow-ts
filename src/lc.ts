import type { ADT } from 'ts-adt'
import { Fn } from '@thi.ng/api'

export type Lambda = {
  argument: string
  expressions: Ast[]
  output: string
  name: string
}

export type Program = {
  arguments: string[]
  expressions: Ast[]
  output: string
  name: string
}

export type Call = { func: string; argument: string; name: string }

/**
 * Our own weird representation for the lambda calculus. Designed for ease of rendering.
 */
export type Ast = ADT<{
  // let: { name: string; value: Ast; in: Ast }
  call: Call
  lambda: Lambda
}>

/**
 * Find all free terms inside an expression.
 *
 * @param ast The expression to look inside.
 * @param except The current scope.
 */
export function* free(ast: Ast, except: Set<string>): Generator<string> {
  const check = function* (name: string) {
    if (!except.has(name)) {
      yield name
    }
  }

  if (ast._type === 'call') {
    yield* check(ast.func)
    yield* check(ast.argument)
  }

  if (ast._type === 'lambda') {
    const names = ast.expressions.map((e) => e.name).concat([...except])
    if (!names.includes(ast.output)) yield ast.output

    yield* freeMany(ast.expressions, new Set([...except, ast.argument]))
  }
}

/**
 * Find all free terms in a series of expressions
 *
 * @param expressions The list of expressions to collect from.
 * @param set The current scope.
 */
function* freeMany(expressions: Ast[], set: Set<string>): Generator<string> {
  for (const ast of expressions) {
    yield* free(ast, set)

    set.add(ast.name)
  }
}

/**
 * Group multiple lambdas together in a single program.
 *
 * @param lambda The lambda to start from.
 */
export const lambdaToProgram = (lambda: Lambda): Program => {
  if (
    lambda.expressions.length !== 1 ||
    lambda.expressions[0]?._type !== 'lambda'
  ) {
    return {
      name: lambda.name,
      output: lambda.output,
      expressions: lambda.expressions,
      arguments: [lambda.argument]
    }
  }

  const nested = lambdaToProgram(lambda.expressions[0])

  return {
    arguments: [lambda.argument, ...nested.arguments],
    output: lambda.output,
    name: lambda.name,
    expressions: nested.expressions
  }
}

/**
 * Check if a name appears inside an expression.
 *
 * @param name The name to search for.
 * @param expression The expression to search in.
 */
export const occurs = (name: string, expression: Ast): boolean => {
  if (expression._type === 'call') {
    return expression.argument === name || expression.func === name
  }

  if (expression.argument === name) return false

  return expression.output === name || occursIn(name, expression.expressions)
}

/**
 * Check if a name appears inside a sequence of expressions.
 *
 * @param name The name to search for.
 * @param expressions The expressions to search in.
 */
function occursIn(name: string, expressions: Ast[]): boolean {
  return expressions.some((expression) => occurs(name, expression))
}

/**
 * Split a program into its head and the rest.
 *
 * @param program The program to split.
 */
export const unconsProgram = (program: Program): [Ast, Program] => {
  return [
    program.expressions[0],
    {
      ...program,
      arguments: [],
      expressions: program.expressions.slice(1)
    }
  ]
}

/**
 * Check if a name appears inside a program.
 *
 * @param name The name to search for.
 * @param program The program to search in.
 */
export const occursInProgram = (name: string, program: Program): boolean => {
  if (program.arguments.includes(name)) {
    return false
  }

  return program.output === name || occursIn(name, program.expressions)
}

/**
 * Get a series of nested lambdas from a program
 *
 * @param program The program to transform.
 */
export const programToLambda = (program: Program): ADT<{ lambda: Lambda }> => {
  if (program.arguments.length === 0) {
    throw new Error(`Cannot convert empty program to a lambda.`)
  }

  const [first, ...rest] = program.arguments

  return rest.reduce(
    (acc, curr) => {
      const outerName = `__outer-${acc.output}`

      return {
        _type: 'lambda',
        argument: curr,
        output: outerName,
        name: acc.name,
        expressions: [
          {
            ...acc,
            name: outerName
          }
        ]
      }
    },
    {
      _type: 'lambda',
      argument: first,
      name: program.name,
      expressions: program.expressions,
      output: program.output
    }
  )
}
