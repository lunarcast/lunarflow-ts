import { indexAst, Ast } from './lc'
import * as tx from '@thi.ng/transducers'
import { buildTimeline } from './timeline'
import { Layout, buildLayouts, getLayoutMatrix } from './layout'

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

const rawAst2: Ast = {
  _type: 'lambda',
  argument: 'f',
  body: {
    _type: 'lambda',
    argument: 'x',
    body: {
      _type: 'call',
      argument: {
        _type: 'var',
        name: 'x'
      },
      func: {
        _type: 'var',
        name: 'f'
      }
    }
  }
}

const rawAst: Ast = {
  _type: 'lambda',
  argument: 'f',
  body: {
    _type: 'lambda',
    argument: 'x',
    body: {
      _type: 'lambda',
      argument: 'y',
      body: {
        _type: 'call',
        argument: {
          _type: 'var',
          name: 'x'
        },
        func: {
          _type: 'call',
          argument: {
            _type: 'var',
            name: 'y'
          },
          func: {
            _type: 'var',
            name: 'f'
          }
        }
      }
    }
  }
}

const ast = indexAst(rawAst, tx.range(0, Infinity)[Symbol.iterator]())

const timeline = buildTimeline(ast)
console.log(timeline)
const builtLayouts = buildLayouts(timeline)

// const step = null as any

console.log(builtLayouts)

// console.log(layout)
console.log(builtLayouts.map(getLayoutMatrix))

// const shapes = renderLambda(layout)

// const go = () => {
//   draw(context, group({}, shapes))

//   requestAnimationFrame(go)
// }

// go()
