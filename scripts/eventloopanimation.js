const fs = require('fs')
const path = require('path')

let projectRootDirOri;
let projectRootDir;

projectRootDirOri = path.resolve(__filename, '../../_posts_ori')
projectRootDir = path.resolve(__filename, '../../_posts')

const posts = fs.readdirSync(projectRootDir)

posts.forEach(post => {
    const postPath = path.resolve(projectRootDir, `./${post}`)

    const postContent = fs.readFileSync(postPath).toString();

    console.log(postContent.slice(0, 100))
})
