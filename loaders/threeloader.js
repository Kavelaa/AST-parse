const parser = require('@babel/parser');
const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const t = require('@babel/types');

/**
 * 
 * @param {string} fileName 文件名，无需后缀扩展名 
 * @param {any} data 可被JSON序列化的数据
 * @description 将文件写入到当前函数运行时所在的文件夹的上一级目录下
 */
function data2JSONFile(fileName, data) {
  fs.writeFileSync(path.join(__dirname, '..', fileName + '.json'), JSON.stringify(data,null,2));
}

/**
 * 
 * @param {string} path 
 * @description 通过three.js材质/几何体的统一输出文件，获取所有材质/几何体文件名称
 * @returns {string[]} pathArr
 */
function parseUnifiedOutput(path) {
  const code = fs.readFileSync(path).toString();
  
  const reg = /\.\/\w+/g;
  const pathArr = code.match(reg);

  return pathArr;
}

/**
 * 
 * @param {string} p 
 * @description 通过参数路径，读取并解析路径下的.d.ts文件
 */
function parseTSDeclarationFromPath(p) {
  const tsDeclarationPath = p + '.d.ts';
  const fileCode = fs.readFileSync(tsDeclarationPath).toString();
  
  const isMaterial = p.includes('Material');
  const isGeometry = p.includes('Geometry');

  if (isMaterial) {
    return parseMaterial(fileCode)
  } else if (isGeometry) {
    return parseGeometry(fileCode)
  } else {
    return
  }
}

/**
 * 
 * @param {string[]} pathsArr 
 * @param {string} folder 
 */
function parseParamsArrFromPathsArr(pathsArr, folder) {
  return pathsArr.map(p => path.join(folder, p)).map(p => parseTSDeclarationFromPath(p));
}

/**
 * 
 * @param {Identifier | TSPropertySignature} identifier
 * @description 传入一个标准的identifier或者TSPropertySignature，输出一个键值对
 * @returns {[string, {type:string | string[], optional:boolean}]} 键值对
 */
function parseType(identifier) {
  const {name, key, typeAnnotation, optional = false} = identifier;
  let realName = name || key.name;
  let value = {type: null, optional};

  if (typeAnnotation.typeAnnotation.type === 'TSUnionType') {
    value.type = [];
    typeAnnotation.typeAnnotation.types.forEach(type => {
      if (type.type === 'TSTypeReference') {
        value.type.push(type.typeName.name);
      } else {
        value.type.push(type.type);
      }
    })
  } else {
    value.type = typeAnnotation.typeAnnotation.type;
  }

  return [realName, value];
}

/**
 * 
 * @param {string} code 文件内容的字符串形式
 * @description 可对Material一类文件进行解析
 * @returns {[string, {[propName:string]: {type:string | string[], optional: boolean}}]} [paramName, params] 键值对
 */
function parseMaterial(code) {
  let ast = parser.parse(code, {sourceType: 'module', plugins:['typescript']});
  let name = '';
  let params = {};
  
  traverse(ast, {
    ExportNamedDeclaration(p) {
      if (p.node.declaration.type === 'TSInterfaceDeclaration') {
        const {id, body} = p.node.declaration;

        name = id.name;

        body.body.forEach(prop => {
          let value = parseType(prop);

          params[value[0]] = value[1];
        })
      }
    }
  })

  return [name, params];
}

/**
 * 
 * @param {string} code 文件内容的字符串形式
 * @description 可对Geometry一类文件进行解析
 * @returns {[string, {[propName:string]: {type:string | string[], optional: boolean}}]} [paramName, params] 键值对
 */
function parseGeometry(code) {
  let ast = parser.parse(code, {sourceType: 'module', plugins: ['typescript']});
  let name = '';
  let params = {};

  traverse(ast, {
    ExportNamedDeclaration(p) {
      if (p.node.declaration.type === 'ClassDeclaration') {
        const {id, body} = p.node.declaration;

        name = id.name;

        const constructor = body.body.find(def => def.kind === 'constructor');
        const {params:cParams} = constructor;

        cParams.forEach(param => {
          const value = parseType(param);

          params[value[0]] = value[1]
        })
      }
    }
  })

  return [name, params];
}

const threeSrc = path.join(__dirname, '../node_modules', 'three/src');

const materialsSrc = path.join(threeSrc, 'materials', 'Materials.d.ts');
const materialsFolder = path.dirname(materialsSrc);

const geometriesSrc = path.join(threeSrc, 'geometries', 'Geometries.d.ts');
const geometriesFolder = path.dirname(geometriesSrc);

const materialsPathsArr = parseUnifiedOutput(materialsSrc);
const materialsParamsArr = parseParamsArrFromPathsArr(materialsPathsArr, materialsFolder);
data2JSONFile('materials', materialsParamsArr);

const geometriesPathsArr = parseUnifiedOutput(geometriesSrc);
const geometriesParamsArr = parseParamsArrFromPathsArr(geometriesPathsArr, geometriesFolder);
data2JSONFile('geometries', geometriesParamsArr);