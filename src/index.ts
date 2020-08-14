import { Ast } from './lc'
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

const shapes = renderLambda(
  ['b', 'a', 'f'],
  [
    { _type: 'call', func: 'f', argument: 'b', name: 'temp' },
    {
      _type: 'call',
      func: 'temp',
      argument: 'a',
      name: 'result'
    }
  ],
  'result'
)

const go = () => {
  draw(context, group({}, shapes))

  requestAnimationFrame(go)
}

go()
