// Global type declarations to resolve Vite's rollup/parseAst dependency
declare module 'rollup/parseAst' {
  export interface AcornNode {
    type: string;
    start: number;
    end: number;
    [key: string]: any;
  }
  export function parseAst(input: string, options?: any): any;
  export function parseAstAsync(input: string, options?: any): Promise<any>;
}