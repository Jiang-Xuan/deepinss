const fs = require('fs')
const path = require('path')
const template = require('./template')
const transform = require('./babel-transform')

let projectRootDirOri;
let projectRootDir;

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

posts.forEach(post => {
    const postPath = path.resolve(projectRootDirOri, `./${post}`)

    const postContent = fs.readFileSync(postPath).toString();

    if (eventLoopAnimation = postContent.match(eventLoopAnimationReg)) {
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
        console.warning('id is unmatched, use default')
      }

      const generateByTemplate = template(codeContent[1].trim(), codeType[1].trim(), {
        id: id[1].trim()
      })

      const finelResult = transform(postContent.replace(eventLoopAnimationReg, generateByTemplate).trim())

      try {
        console.log(`在${post}找到匹配的模式, 写入转换过的 md 文档`)
        fs.writeFileSync(path.resolve(projectRootDir, `./${post}`), finelResult)

        console.log(`${post}: 写入成功`)
      } catch(e) {
        console.log(e)
        /* TODO: 暂时不予处理 */
      }
    } else {
      console.log(`没有在${post}找到匹配的模式, 直接原封写入`)

      const postContent = fs.readFileSync(path.resolve(projectRootDirOri, `./${post}`))
      try {
        fs.writeFileSync(path.resolve(projectRootDir, `./${post}`), postContent)

        console.log(`${post}: 写入成功`)
      } catch(e) {
        console.log(e)
        /* TODO: 暂时不予处理 */
      }
    }
})
