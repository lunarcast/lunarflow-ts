import { indexAst } from './lc'
import * as tx from '@thi.ng/transducers'
import { buildTimeline } from './timeline'
import { Layout, getLayoutMatrix, LayoutStep } from './layout'

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

// const mkNumber = (n: number): Program => {
//   const result: Ast[] = []

//   for (let index = 0; index < n; index++) {
//     const arg = index === 0 ? 'zero' : String(index - 1)

//     result.push({
//       _type: 'call',
//       argument: arg,
//       func: 'succ',
//       name: index + 1 === n ? 'result' : String(index)
//     })
//   }

//   return {
//     body: result,
//     output: 'result',
//     name: String(n),
//     arguments: ['succ', 'zero']
//   }
// }

const ast = indexAst(
  {
    _type: 'lambda',
    argument: 'x',
    body: {
      _type: 'lambda',
      argument: 'y',
      body: {
        _type: 'var',
        name: 'x'
      }
    }
  },
  tx.range(0, Infinity)[Symbol.iterator]()
)

const timeline = buildTimeline(ast)

const step = null as any

const layout: Layout = [
  {
    _type: 'nested',
    arguments: [0, 1, 2],
    color: 'pink',
    id: 10,
    index: 0,
    output: 4,
    step,
    steps: [
      {
        _type: 'call',
        color: 'red',
        index: 2,
        interval: { from: 0, to: 2 },
        step,
        id: 0
      },
      {
        _type: 'call',
        color: 'blue',
        index: 3,
        interval: { from: 0, to: 2 },
        step,
        id: 1
      },
      {
        _type: 'call',
        color: 'green',
        index: 4,
        interval: { from: 0, to: 3 },
        step,
        id: 2
      },
      {
        _type: 'call',
        color: 'red',
        index: 1,
        interval: {
          from: 1,
          to: 3
        },
        step,
        id: 3
      },
      {
        _type: 'call',
        color: 'red',
        index: 0,
        interval: {
          from: 2,
          to: 4
        },
        step,
        id: 4
      }
    ]
  }
]

console.log(timeline)

console.log(layout)
console.log(getLayoutMatrix(layout))

// const shapes = renderLambda(layout)

// const go = () => {
//   draw(context, group({}, shapes))

//   requestAnimationFrame(go)
// }

// go()
