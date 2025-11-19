import { dts } from 'bun-plugin-dtsx'

console.log('Building...')

await Bun.build({
  entrypoints: [
    './src/index.ts',
    './src/component.ts',
  ],
  outdir: './dist',
  target: 'bun',
  external: ['@bytecodealliance/jco'],
  plugins: [
    dts(),
  ],
})

console.log('Built!')