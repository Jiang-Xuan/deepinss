## Welcome to SSS

该项目始于 2017.12.13 , 致力于让每个人读懂 shadowsocks 的源码, 项目被命名为 SSS, 理解成 shadowsocks study, 或者是 study shadowsocks 都可.

该项目是我定于 2018 年完成的目标.

我是 google 的忠实粉丝, 也经常使用 Wikipedia. 由于 SS 现在过于明显, 总有一天会有被检测出来的风险, 与其静待被封, 不如看下源码, 理解下原理, 也许有一天可以为下一代的科学上网奉献一份力量.


### 起源

在我的第一台 Linode 被封的时候就诞生了这个想法, 但是作为一名底层前端开发攻城狮, 对于网络协议, 加密算法, socket 编程还是有所畏惧, 在第二台 Linode 被限速的时候终于决定要读一读源码.

### 关于写这个项目

也许有很多人都诞生了读源码的想法, 但是 python 版本的 shadowsocks 的源码注释还是不足, 我希望可以用文档记录下来, 在我看源码的时候接触到了很多需要记录下来的地方, 有 shadowsocks 里用到的, 还有 shadowsocks 依赖里面用到的.

我是极客思维, 每一个参数, 每一个变量, 每一个单词缩写, 这些的含义我都想知道. 为此付出了很多, 有时候为了一个单词的缩写, Google, Stack Overflow, Wikipedia, 官方文档, 全部翻遍, 仅仅是为了一个变量的全称是什么, 在这期间也看到了很多人都有这样的想法, 记录下来这些都可以对 SS 的源码阅读有帮助, 这也不仅仅是 SS 的源码解读, 包含 python 的一些模块, openssl, 以及加密, 混淆, 摘要算法, socket编程. 也是这些技术成就了 SS, 致敬开源.

### 获取源码

```shell
git clone https://github.com/shadowsocks/shadowsocks.git
```

克隆下 shadowsocks 主仓库, 该仓库目前有两个分支, **rm**分支的源代码被移除, **master**分支的代码依旧是可用.

### 项目维护者

1. [Jiang Xuan](https://github.com/Jiang-Xuan)
