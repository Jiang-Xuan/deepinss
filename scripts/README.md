文件作用:

* babel-transform

参数:

1. mdString: markdown 原始字符串
2. @return: 返回整个 Markdown 字符串, 其中的 JavaScript 代码已经被转换

功能:

提取 Markdown 原始字符串中的 script 标签之中的代码, 然后将其转换成 `"chrome": 40` 兼容的代码.

**目前只提取发现的第一个 script 标签中的代码**

* template

参数:

1. codeContent: 代码字符串
2. codeType: JavaScript 代码 or Python 代码 or 其他任何语言
3. config: config 参数, 在 template 中有默认的配置文件
4. @return: 返回整个 Markdown 字符串, 其中的 `<!-- EVENTLOOPANIMATION ... -->` 被替换成需要的 `程序流控制面板` 的 HTML 结构.

功能:

为了不重复书写 `程序流控制面板` 的 HTML 结构, 也是为了防止 Markdown 源码中过多的 HTML 结构

**目前只提取发现的第一个 `<!-- EVENTLOOPANIMATION ... -->` 标签块**


