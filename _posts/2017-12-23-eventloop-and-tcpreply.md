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

超时的时间精度, 我们将在 TIMEOUT_PRECISION 秒之后检查是否有请求超时, 如果有超时则销毁该请求, 释放关于该请求的系统资源, 否则有可能造成内存溢出. 在调试的时候将该值调大, 可以将请求的生命周期增长, 方便调试.

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

KqueueLoop 的构造器, 创建一个 kqueue 内核事件监听队列和一个用来 key 为 file descriptor, value 为 其注册时的监听模式的对象, 下面是一个例子:
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

**私有方法, 不为外部调用!**

_control 函数作用是向 _kqueue 里面添加新的 kevent 事件, 下划线开头.

'''
:param fd: 要监听的 文件描述符
:param mode: 监听模式 `POLL\_IN` 对应 `select.KQ\_FILTER\_READ` `POLL_OUT` 对应 `select.KQ_FILTER_WRITE`
:param flags: 传递给 kevent 的 flags, 这个参数会表明是删除事件还是添加事件, 如果删除事件那么**mode**要和添加时候的一致, 会用到 `_fds` 变量
'''

这里要强调说明一点的是 `self._kqueue.control` 方法, 该方法不是系统调用提供的, 而是 Python 提供的, 深入解释篇幅会用的很多, 为了不打断流程, 将放在一个单独的文章内解释, [前往][understanding-kevent-control-method], 这里传递的参数 0 标识是非阻塞调用.

```python
def poll(self, timeout):
    if timeout < 0:
        timeout = None  # kqueue behaviour
    events = self._kqueue.control(
        None, KqueueLoop.MAX_EVENTS, timeout
    )  # 在 timeout 时间内是否有事件发生, 如果没有, 在timeout之后会返回一个空数组, 我们就可以进行自己内部程序的处理, 如果有事件发生, 会将事件返回, 我们在接下来处理发生的一系列事件 <https://docs.python.org/2/library/select.html#select.kqueue.control>
    results = defaultdict(lambda: POLL_NULL)
    for e in events:
        fd = e.ident
        if e.filter == select.KQ_FILTER_READ:
            results[fd] |= POLL_IN
        elif e.filter == select.KQ_FILTER_WRITE:
            logging.info('发生 POLL_OUT 事件')
            results[fd] |= POLL_OUT
    return results.items()
```

该方法是轮询, 获取事件, `POLL_NULL` 是在这里用到的, 用来生成该文件描述符的数据流方向. 生成的事件是 `kevent` 对象数组, 在 C 里是 `kevent` 结构体. Shadowsocks 用的是自己定义的 `POLL_IN`, `POLL_OUT` 来标识数据流的方向, 而不是 `select` 模块的 `filter` 里定义的 `KQ_FILTER_READ` 和 `KQ_FILTER_WRITE`. 这也不是 C 原生的变量名, C 原生的变量名分别为 `EVFILT_READ` , `EVFILT_WRITE`. 另见: [L2540][L2540]

在这里会格式化发生事件的对象为 fd -> mode(文件描述符 -> 事件模式或者称之为数据流方向), return 回一个数组 [(fd, mode), (anotherFd, mode)]

```python
def register(self, fd, mode):
    self._fds[fd] = mode
    self._control(fd, mode, select.KQ_EV_ADD)
```

用来注册 `socket` 的方法, 所有进入 `Kqueue` 事件队列的都要从这里通过, `_fds` 变量存储了该文件描述符的模式(数据流方向). 传递 `select.KQ_EV_ADD` flag 来标识是添加事件

```python
def unregister(self, fd):
    self._control(fd, self._fds[fd], select.KQ_EV_DELETE)
    del self._fds[fd]
```

用来取消注册 `socket `的方法, 所有想要删除事件的 `socket` 都要经过这里, 从 `_fds` 拿出来添加事件当时的模式(数据流方向), 传递 `select.KQ_EV_DELETE` flag 来标识是删除事件. 从 `Kqueue` 事件队列中移除事件之后, 删除 `_fds` 中关于该文件描述符的模式数据

```python
def modify(self, fd, mode):
    self.unregister(fd) # 删除注册 file descriptor => mode
    self.register(fd, mode) # 重新注册 file descriptor => mode
```

用来修改文件描述符的监听模式, 首先需要删除已经注册的事件, 然后重新添加.

```python
def close(self):
    self._kqueue.close()
```

关闭该内核事件队列.

## 事件轮询器 EventLoop

```python
class EventLoop(object):
    ...
```

该类责任:

1. 负责创建事件轮询机制, run 起来事件轮询, 存储着每个 `socket` 的处理器(TCPReply 和 UDPReply 或者是其他类)
2. 根据 (f, mode, handler) 创建相应的监听, 根据 fd 移除监听
3. 获取发生的事件, 然后处理每一个事件, 将其分发到对应的处理类中
4. 负责调用被注册的周期性的函数

```python
def __init__(self):
    if hasattr(select, 'epoll'):
        self._impl = select.epoll()
        model = 'epoll'
    elif hasattr(select, 'kqueue'):
        self._impl = KqueueLoop()
        model = 'kqueue'
    elif hasattr(select, 'select'):
        self._impl = SelectLoop()
        model = 'select'
    else:
        raise Exception('can not find any available functions in select '
                        'package')
    self._fdmap = {}
    self._last_time = time.time()
    self._periodic_callbacks = []
    self._stopping = False
```

\_\_init\_\_ 构建函数, 判断 `select` 模块支持的事件机制, 这里只讨论 `kqueue` 事件队列机制, 执行 `self._impl = KqueueLoop()`.

*_impl* 全称为 *implement*

_fdmap 是一个对象, 例子如下:

```python
{
    fd: (f, handler) # 文件描述符: (socket文件, socket文件的处理器)
}
```


[L2540]: <https://github.com/python/cpython/blob/master/Modules/selectmodule.c#L2540>
[freebsb-kqueue]: <https://www.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2&apropos=0&manpath=FreeBSD+11.1-RELEASE+and+Ports>
[Python-kqueue-control]: <https://docs.python.org/2.7/library/select.html#select.kqueue.control>
[understanding-kevent-control-method]: </deepinss/2017/12/23/understanding-kevent-control-method.html>