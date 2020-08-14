import {} from '@thi.ng/geom'
import type { Ast } from './lc'

type LineDescriptor = { nextTo: string; name: string }

const generateAstLine = (ast: Ast): LineDescriptor => {
  const name = ast.name ?? `${ast.func}(${ast.argument})`

  return { nextTo: ast.func, name }
}

const generateAstLines = (oldInputs: string[], ast: Ast[]) => {
  const lines = ast.map(generateAstLine)

  return lines.reduce(
    (acc, curr) =>
      acc.flatMap((element) =>
        element === curr.nextTo ? [element, curr.name] : [element]
      ),
    oldInputs
  )
}

export const renderLambda = (inputs: string[], ast: Ast[], output: string) => {
  const lines = generateAstLines(inputs, ast)

  console.log(lines)
}
