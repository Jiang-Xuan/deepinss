const fs = require('fs')
const path = require('path')
const util = require('util')
const { exec } = require('child_process')
const eventLoopAnimationExec = require('./eventloopanimation')

const promisifyExec = util.promisify(exec)

let projectRootDirOri

projectRootDirOri = path.resolve(__filename, '../../_posts_ori')

try {
  eventLoopAnimationExec()
} catch (e) {
  console.log(e)
}

fs.watch(projectRootDirOri, (eventType, filename) => {
  if (filename) {
    console.log('执行转换')

    try {
      eventLoopAnimationExec()
    } catch(e) {
      console.log(e)
    }
  } else {
    console.log('没有 filename')
  }
})
