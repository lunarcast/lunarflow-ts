import { cycle } from '@thi.ng/transducers'

export const segmentLength = 400
export const callAngle = Math.PI / 6
export const sinCallAngle = Math.sin(callAngle)
export const tgCallAngle = Math.tan(callAngle)
export const lineWidth = 60
export const lineSpace = 100
export const callOffset = 100
export const intersectionColor = '#3E386E'

export const lineColors = cycle([
  '#F37878',
  '#AA59AB',
  '#BBB684',
  '#21BEE0',
  '#38F461'
])
