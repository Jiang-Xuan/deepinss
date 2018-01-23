const fs = require('fs')
const path = require('path')
const exec = require('./eventloopanimation')

let projectRootDirOri

projectRootDirOri = path.resolve(__filename, '../../_posts_ori')

fs.watch(projectRootDirOri, (eventType, filename) => {
  if (filename) {
    console.log('执行转换')
    exec()
  } else {
    console.log('没有 filename')
  }
})
