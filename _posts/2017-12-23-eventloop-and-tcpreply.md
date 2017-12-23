---
title: eventloop ♺ 和TCPReply ⚒
---

在请求 google.com 的时候总是不断的建立 TCP 连接, TCP 连接会创建 socket 进行通讯, 和浏览器的请求通讯需要和 socket 通讯, 接受浏览器的请求需要创建 socket, 和 SS server 通讯需要创建 socket, 所以监听 socket 的事件将是通讯的基础

## TL;DR

<!-- TODO: 添加 TL;DR -->

## 导入模块

```python
from __future__ import absolute_import, division, print_function, \
    with_statement

import os
import time
import socket
import select
import traceback
import errno
import logging
from collections import defaultdict

from shadowsocks import shell
```

## \_\_all\_\_ 导出

```python
__all__ = ['EventLoop', 'POLL_NULL', 'POLL_IN', 'POLL_OUT', 'POLL_ERR',
           'POLL_HUP', 'POLL_NVAL', 'EVENT_NAMES']
```

\_\_all\_\_ 声明该模块暴露出去的接口

## 模块常量

```python
POLL_NULL = 0x00
POLL_IN = 0x01
POLL_OUT = 0x04
POLL_ERR = 0x08
POLL_HUP = 0x10
POLL_NVAL = 0x20
```

* POLL_NULL 用来做掩码运算   00000000
* POLL_IN 数据流入的标志位   00000001
* POLL_OUT 数据流出的标志位  00000100
* POLL_ERR 数据出错的标志位  00001000
* POLL_HUP 数据出错的标志位  00001010
* POLL_NVAL 数据出错的标志位 00010100

POLLERR 意味着 socket 生成了一个异步错误. 在 TCP 连接中, 这特别指 RST 消息被接收到或者是被发送, 如果这个文件描述符不是一个 socket, POLLERR 可能意味着该设备不支持轮询.

POLLHUP 意味着这个 socket 不再可以连接. 在 TCP 连接中, 这意味着 FIN 消息被接收或者是被发送

POLLNVAL 意味着 socket 文件描述符 没有打开, 这将是一个错误在尝试关闭这个 socket 的时候

> 引至 <https://stackoverflow.com/questions/24791625/how-to-handle-the-linux-socket-revents-pollerr-pollhup-and-pollnval>

```python
EVENT_NAMES = {
    POLL_NULL: 'POLL_NULL',
    POLL_IN: 'POLL_IN',
    POLL_OUT: 'POLL_OUT',
    POLL_ERR: 'POLL_ERR',
    POLL_HUP: 'POLL_HUP',
    POLL_NVAL: 'POLL_NVAL',
}
```

辅助变量, 将标志位转换成字符串

```python
TIMEOUT_PRECISION = 10000
```

超时的时间精度, 我们将在 TIMEOUT_PRECISION 秒之后检查是否有请求超时, 如果有超时则销毁该请求, 释放关于该请求的系统资源, 否则有可能造成内存溢出

## 事件轮询机制
```python
class KqueueLoop(object):
    ...
# class SelectLoop(object):
#     ...
```

这里有两种 loop 的实现, 在我的PC上面只会用到 `KqueueLoop`, 先行只解释 `KqueueLoop` 的实现.

> NAME
>      kqueue, kevent -- kernel event notification mechanism
>
> LIBRARY
>      Standard C	Library	(libc, -lc)
>
> 引至: [freebsd-kqueue][freebsb-kqueue]

Kqueue 是一种内核事件通知机制, 是操作系统提供的, 这里用来监听 socket 的[可读/可写]事件.

```python
MAX_EVENTS = 1024
```

类常量, 定义一次轮询取出来的事件数目的上限.

```python
def __init__(self):
        self._kqueue = select.kqueue()
        self._fds = {} # file descriptor 和 其对应的监听的 mode (POLL_IN or POLL_OUT)
```

KqueueLoop 的构造器, 创建一个 kqueue 内核事件监听队列和一个用来 key 为 file descriptor, value 为 其注册时的监听模式, 下面是一个例子:
```python
{
    4: 1 # 00000001
}
```
这个例子表明, KqueueLoop 里面监听了一个 文件描述符为 4, 监听模式为 POLL_IN(00000001) 的事件

Why? 为什么需要这个 `_fds`, 这个是用来在移除 注册该文件描述符事件 的时候使用的, 因为在移除的时候需要传递相同的监听模式, 这样在移除的时候只需要传递文件描述符给 `KqueueEvent` 实例, 而不需要传递监听模式.

```python
def _control(self, fd, mode, flags):
        events = []
        if mode & POLL_IN: 
            events.append(
                select.kevent(fd, select.KQ_FILTER_READ, flags)
            )
        if mode & POLL_OUT:
            events.append(select.kevent(fd, select.KQ_FILTER_WRITE, flags))
        for e in events:
            self._kqueue.control([e], 0)
```

_control 函数作用是向 _kqueue 里面添加新的 kevent 事件

'''
:param fd: 要监听的 文件描述符
:param mode: 监听模式 `POLL\_IN` 对应 `select.KQ\_FILTER\_READ` `POLL_OUT` 对应 `select.KQ_FILTER_WRITE`
:param flags: 传递给 kevent 的 flags, 这个参数会表明是删除事件还是添加事件, 如果删除事件那么**mode**要和添加时候的一致, 会用到 `_fds` 变量
'''

这里要强调说明一点的是 `self._kqueue.control` 方法, 该方法不是系统调用提供的, 而是 Python 提供的, 深入解释篇幅会用的很多, 为了不打断流程, 将放在一个单独的文章内解释, [前往][]

[freebsb-kqueue]: <https://www.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2&apropos=0&manpath=FreeBSD+11.1-RELEASE+and+Ports>
[Python-kqueue-control]: <https://docs.python.org/2.7/library/select.html#select.kqueue.control>
[]