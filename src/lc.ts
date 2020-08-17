import type { ADT } from 'ts-adt'

export type Ast = ADT<{
  // let: { name: string; value: Ast; in: Ast }
  call: { func: string; argument: string; name: string }
}>
