// Shim to satisfy Vite's TS types that import from 'rollup/parseAst'
// Resolves to the actual Rollup type declarations location
declare module 'rollup/parseAst' {
  export * from 'rollup/dist/parseAst';
}
