const parser = require('@babel/parser');
const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const t = require('@babel/types');

const materialCodePos = path.join(
  __dirname,
  '..',
  'test.d.ts'
);
const code = fs.readFileSync(materialCodePos).toString();
const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['typescript']
});
traverse(ast, {
  ExportNamedDeclaration(p) {
    p.replaceWith(p.node.declaration);
  }
});
const {code: file} = generator(ast, {compact: false, retainLines: true, retainFunctionParens: true}, code);

const pos = path.join(__dirname, '..', 'parse.ts');
fs.writeFileSync(pos, file);
