import { printAst, normalize, common, calls } from './lc'

for (const version of normalize(
  calls(common.or, common.True, common.False),
  common
)) {
  console.log(printAst(version))
}
