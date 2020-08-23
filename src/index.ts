import { indexAst } from './lc'
import * as tx from '@thi.ng/transducers'
import { buildTimeline } from './timeline'
import { Layout, getLayoutMatrix } from './layout'

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

const layout: Layout = [
  {
    color: 'red',
    index: {
      _type: 'standalone',
      index: 2
    },
    interval: { from: 0, to: 2 }
  },
  {
    color: 'blue',
    index: {
      _type: 'standalone',
      index: 3
    },
    interval: { from: 0, to: 2 }
  },
  {
    color: 'green',
    index: { _type: 'standalone', index: 4 },
    interval: { from: 0, to: 3 }
  },
  {
    color: 'red',
    index: {
      _type: 'standalone',
      index: 1
    },
    interval: {
      from: 1,
      to: 3
    }
  },
  {
    color: 'red',
    index: {
      _type: 'standalone',
      index: 0
    },
    interval: {
      from: 2,
      to: 4
    }
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
