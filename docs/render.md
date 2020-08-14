# Rendering

The ast:

```haskell
type Var = String

data Ast = Call Var Var | Abs Var Ast | Let Var Ast Ast
```

The pred function looks like this:

```
\num succ. let
        big g h = let temp = g succ in h temp
        i1 = num big
    in \zero. let
        always0 a = zero
        i2 = i1 always0
        id x = x
        i3 = i2 id
    in i3
```
