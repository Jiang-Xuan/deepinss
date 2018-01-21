const fs = require('fs')
const path = require('path')
const babel = require('babel-core')

const babelrc = path.resolve(__filename, '../../.babelrc')

const scriptReg = /<script>([\s\S]*?)<\/script>/
let script

function transform(mdString) {
  if (script = mdString.match(scriptReg)) {
    const result = script[1]

    const transformed = babel.transform(result, {
      extends: babelrc
    }).code
    mdString = `${mdString.replace(scriptReg, `<script>\n/* Transformed by babel-transform.js */\n${transformed}\n/* Transformed by babel-transform.js END */\n</script>\n`)}`
  }


  return mdString
}

module.exports = transform
