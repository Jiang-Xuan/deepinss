目录
=======

<ul>
  {% for post in site.posts %}
    <li>
      <a href=".{{ post.url }}">{{ post.title }}</a>
      <!-- post.url 的链接是 / 根目录 -->
      <!-- 但是 github.io 是带有 deepinss 前缀的 -->
      <!-- 所以这里加了个点, 表示相对路径 -->
    </li>
  {% endfor %}
</ul>

SSS
====

[![first-timers-only](http://img.shields.io/badge/first--timers--only-friendly-blue.svg?style=flat-square)](http://www.firsttimersonly.com/)

解读 shadowsocks 源码

[README in English](README.md)

该项目发生了什么
-------------

还没有

介绍
----

该项目始于 2017.12.13 , 致力于让每个人读懂 shadowsocks 的源码, 项目被命名为 SSS, 理解成 shadowsocks study, 或者是 study shadowsocks 都可.

该项目是我定于 2018 年完成的目标.

特点
----

* 覆盖每一行代码
* 交互式解读代码

开发中
-----

* 在线 centos 环境

行为准则
-------

* 尊重原创文章

获取源码
-------

```shell
git clone https://github.com/shadowsocks/shadowsocks.git
```

克隆下 shadowsocks 主仓库, 该仓库目前有两个分支, **rm**分支的源代码被移除, **master**分支的代码依旧是可用.

致敬
-----

* [github.io](https://github.io)

项目维护者
--------

* [Jiang Xuan](https://github.com/Jiang-Xuan)
