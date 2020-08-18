import type { Ast, Program } from './lc'
import { draw } from '@thi.ng/hiccup-canvas'
import { group, rect } from '@thi.ng/geom'
import { renderLambda } from './render'
import { startLayout } from './layout'

const canvas = document.getElementById('canvas') as HTMLCanvasElement | null

if (canvas === null) throw new Error('Cannot find canvas in the dom.')

const context = canvas.getContext('2d')

if (context === null) throw new Error('Cannot create rendering context.')

const resizeCanvas = () => {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}

window.onresize = resizeCanvas

resizeCanvas()

const mkNumber = (n: number): Program => {
  const result: Ast[] = []

  for (let index = 0; index < n; index++) {
    const arg = index === 0 ? 'zero' : String(index - 1)

    result.push({
      _type: 'call',
      argument: arg,
      func: 'succ',
      name: index + 1 === n ? 'result' : String(index)
    })
  }

  return {
    expressions: result,
    output: 'result',
    name: String(n),
    arguments: ['succ', 'zero']
  }
}

const succ: Program = {
  expressions: [
    {
      _type: 'call',
      func: 'num',
      argument: 'succ',
      name: "num'"
    },
    {
      _type: 'call',
      func: "num'",
      argument: 'zero',
      name: "num''"
    },
    {
      _type: 'call',
      func: 'succ',
      argument: "num''",
      name: 'result'
    }
  ],
  output: 'result',
  arguments: ['num', 'succ', 'zero'],
  name: 'succ'
}

const flipProgram: Program = {
  expressions: [
    {
      _type: 'call',
      argument: 'h',
      func: 'f',
      name: 'temp'
    },
    {
      _type: 'call',
      argument: 'g',
      func: 'temp',
      name: 'result'
    }
  ],
  output: 'result',
  arguments: ['f', 'h', 'g'],
  name: 'flip'
}

const program = mkNumber(7)

const layout = startLayout(program)

console.log(layout)

const shapes = renderLambda(layout)

const go = () => {
  draw(context, group({}, shapes))

  requestAnimationFrame(go)
}

go()
