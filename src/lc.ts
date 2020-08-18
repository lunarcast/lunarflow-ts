import type { ADT } from 'ts-adt'

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

export type Ast = ADT<{
  // let: { name: string; value: Ast; in: Ast }
  call: Call
  lambda: Lambda
}>
