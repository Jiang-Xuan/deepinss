const fs = require('fs')
const path = require('path')
const template = require('./template')
const transform = require('./babel-transform')

let projectRootDirOri
let projectRootDir

projectRootDirOri = path.resolve(__filename, '../../_posts_ori')
projectRootDir = path.resolve(__filename, '../../_posts')

const posts = fs.readdirSync(projectRootDirOri)

const eventLoopAnimationReg = /\<\!\-\- EVENTLOOPANIMATION\n([\s\S]*?)\-\-\>/
let eventLoopAnimation

const codeContentReg = /CODECONTENT:\n?\s*\`([\s\S]*?)\`/
let codeContent

const codeTypeReg = /CODETYPE:\n?\s*\`([\s\S]*?)\`/
let codeType

const idReg = /ID:\n?\s*\`([\s\S]*?)\`/
let id

const titleReg = /TITLE:\n?\s*\`([\s\S]*?)\`/
let title

function exec() {
  posts.forEach(post => {
      const postPath = path.resolve(projectRootDirOri, `./${post}`)

      const postContent = fs.readFileSync(postPath).toString();

      const transformFunc = (content) => {
        if (eventLoopAnimation = content.match(eventLoopAnimationReg)) {
          const configContent = eventLoopAnimation[1]

          if (codeContent = configContent.match(codeContentReg)) {
          } else {
            throw new Error('codeContent is unmatched')
          }

          if (codeType = configContent.match(codeTypeReg)) {
          } else {
            throw new Error('codeType is unmatched')
          }

          if (id = configContent.match(idReg)) {
          } else {
            console.log('id is unmatched, use default')
          }

          if (title = configContent.match(titleReg)) {
          } else {
            console.log('title is unmatched, use default')
          }

          let config = {}

          if (id) {
            config.id = id[1].trim()
          }
          if (title) {
            config.title = title[1].trim()
          }

          const generateByTemplate = template(codeContent[1].trim(), codeType[1].trim(), config)

          const finelResult = content.replace(eventLoopAnimationReg, generateByTemplate).trim()

          return transformFunc(finelResult)
        } else {
          return content
        }
      }

      const result = transform(transformFunc(postContent).trim())

      try {
        console.log(`在${post}找到匹配的模式, 写入转换过的 md 文档`)
        fs.writeFileSync(path.resolve(projectRootDir, `./${post}`), result)

        console.log(`${post}: 写入成功`)
      } catch(e) {
        console.log(e)
        /* TODO: 暂时不予处理 */
      }
  })
}

if (require.main === module) {
  exec()
}

module.exports = exec


