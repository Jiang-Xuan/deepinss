const fs = require('fs')
const path = require('path')
const template = require('./template')

let projectRootDirOri;
let projectRootDir;

projectRootDirOri = path.resolve(__filename, '../../_posts_ori')
projectRootDir = path.resolve(__filename, '../../_posts')

const posts = fs.readdirSync(projectRootDir)

// const eventLoopAnimationReg = /\<\!\-\- EVENTLOOPANIMATION\n(.*?)\-\-\>/
const eventLoopAnimationReg = /\<\!\-\- EVENTLOOPANIMATION\n([\s\S]*?)\-\-\>/
let eventLoopAnimation

const codeContentReg = /CODECONTENT:\n?\s*\`([\s\S]*?)\`/
let codeContent

const codeTypeReg = /CODETYPE:\n?\s*\`([\s\S]*?)\`/
let codeType

const idReg = /ID:\n?\s*\`([\s\S]*?)\`/
let id

posts.forEach(post => {
    const postPath = path.resolve(projectRootDir, `./${post}`)

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

      // console.log(template(codeContent, codeType))

    }

    // console.log(postContent.slice(0, 100))
})
