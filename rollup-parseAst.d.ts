// Global shim for Vite's dependency on 'rollup/parseAst' when typechecking vite.config.ts
declare module 'rollup/parseAst' {
  export interface AcornNode { [key: string]: any }
  export function parseAst(input: string, options?: any): any;
  export function parseAstAsync(input: string, options?: any): Promise<any>;
}
