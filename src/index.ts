import type { Ast } from './lc'
import { draw } from '@thi.ng/hiccup-canvas'
import { group, rect } from '@thi.ng/geom'
import { renderLambda } from './render'

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

const mkNumber = (n: number): Ast[] => {
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

  return result
}

const shapes = renderLambda(
  ['x'],
  [{ _type: 'call', argument: 'x', name: 'result', func: 'x' }],
  'result'
)

const go = () => {
  draw(context, group({}, shapes))

  requestAnimationFrame(go)
}

go()
