// Global rollup type declarations to resolve vite's dependency issues
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

declare module 'rollup/dist/parseAst' {
  export * from 'rollup/parseAst';
}

declare module 'rollup/dist/parseAst.d.ts' {
  export * from 'rollup/parseAst';
}