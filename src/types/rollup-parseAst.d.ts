// Minimal shim to satisfy Vite's type references
// Avoid re-exporting from rollup internals to prevent resolution issues
declare module 'rollup/parseAst' {
  export interface AcornNode {
    [key: string]: any;
  }
  export function parseAst(input: string, options?: any): any;
  export function parseAstAsync(input: string, options?: any): Promise<any>;
}
