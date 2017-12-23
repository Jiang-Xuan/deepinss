---
title: eventloop ♺ 和TCPReply ⚒
---

在请求 google.com 的时候总是不断的建立 TCP 连接, TCP 连接会创建 socket 进行通讯, 和浏览器的请求通讯需要和 socket 通讯, 接受浏览器的请求需要创建 socket, 和 SS server 通讯需要创建 socket, 所以监听 socket 的事件将是通讯的基础

## TL;DR

<!-- TODO: 添加 TL;DR -->

## 引入模块

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

Kqueue 是一种内核事件通知机制, 这里用来监听 socket 的[可读/可写]事件.

```python
MAX_EVENTS = 1024
```

类常量, 定义一次轮询取出来的事件数目的上限.

[freebsb-kqueue]: <https://www.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2&apropos=0&manpath=FreeBSD+11.1-RELEASE+and+Ports>