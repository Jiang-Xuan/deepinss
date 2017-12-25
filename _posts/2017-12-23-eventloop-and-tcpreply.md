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

#### 常量

```python
MAX_EVENTS = 1024
```

类常量, 定义一次轮询取出来的事件数目的上限.

#### 构造函数

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

#### _control 私有方法

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

#### poll 方法

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

#### register 方法

```python
def register(self, fd, mode):
    self._fds[fd] = mode
    self._control(fd, mode, select.KQ_EV_ADD)
```

用来注册 `socket` 的方法, 所有进入 `Kqueue` 事件队列的都要从这里通过, `_fds` 变量存储了该文件描述符的模式(数据流方向). 传递 `select.KQ_EV_ADD` flag 来标识是添加事件

#### unregister 方法

```python
def unregister(self, fd):
    self._control(fd, self._fds[fd], select.KQ_EV_DELETE)
    del self._fds[fd]
```

用来取消注册 `socket `的方法, 所有想要删除事件的 `socket` 都要经过这里, 从 `_fds` 拿出来添加事件当时的模式(数据流方向), 传递 `select.KQ_EV_DELETE` flag 来标识是删除事件. 从 `Kqueue` 事件队列中移除事件之后, 删除 `_fds` 中关于该文件描述符的模式数据

#### modify 方法

```python
def modify(self, fd, mode):
    self.unregister(fd) # 删除注册 file descriptor => mode
    self.register(fd, mode) # 重新注册 file descriptor => mode
```

用来修改文件描述符的监听模式, 首先需要删除已经注册的事件, 然后重新添加.

#### close 方法

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

#### 构造函数

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

*\_impl* 全称为 *implement*

_fdmap 是一个对象, 例子如下:

```python
{
    fd: (f, handler) # 文件描述符: (socket文件, socket文件的处理器)
}
```

在其他的方法中会向 `_fdmap` 中添加数据.

**\_last\_time** 为时间戳

**\_periodic\_callbacks** 为周期性的回调函数

这是一个数组, 存储着在一次事件从获取到处理完成的周期之后的 处理函数, 比如超时 `socket` 的处理, 系统资源的释放等

**_stopping** 是否是停止状态的标志变量

#### poll 方法

```python
def poll(self, timeout=None):
    events = self._impl.poll(timeout)
    return [(self._fdmap[fd][0], fd, event) for fd, event in events]
```

传入超时时间, 调用事件轮询机制获取发生的事件, 然后根据发生的事件数组来构造新的数组, 根据文件描述符取出来 `socket`, 这里返回的数组举例:

```python
[
    (f, fd, event), # (socket 文件. 该 socket 文件的文件描述符, 发生的事件模式(POLL_IN, POLL_OUT)亦称数据流方向)
    (f, fd, event)
]
```

#### add 方法

```python
def add(self, f, mode, handler): 
    fd = f.fileno()
    self._fdmap[fd] = (f, handler)
    self._impl.register(fd, mode)
```

参数:

1. f 要监听的 socket 文件
2. 要监听的模式 (POLL\_IN, POLL\_OUT) 数据流方向
3. 该 `socket` 的处理器

存储下来 fd -> (f, handler), 调用 `_impl` 注册该文件描述符.

感觉这里就是一段很棒👍的代码, 代码也许并不多高深, 但是将数据存储到了其该存储的地方, `socket` 和 `handler` 这两个变量是 **事件轮询机制(kevent)** 并不关心的, 它需要一个文件描述符和一个 mode(数据流方向) 就可以, 至于是添加还是移除则是由不同的方法确定的. 该类需要的数据是 `socket` 和其的处理器 `handler`, 所以这两个变量存放在了 `EventLoop` 类中.

#### remove

```python
def remove(self, f):
    fd = f.fileno() # 获取该 socket 的 file dscriptor
    del self._fdmap[fd]  # 删除关于该文件描述符 在 _fdmap 中的(f, handler)引用
    self._impl.unregister(fd) # 解除在 监听器 kqueue(或者是其他) 的注册
```

根据 `socket` 来移除事件监听

#### add_periodic

```python
def add_periodic(self, callback): # 添加周期性函数
    self._periodic_callbacks.append(callback)
```

添加周期性的函数 `callback`

#### remove_periodic

```python
def remove_periodic(self, callback):
    self._periodic_callbacks.remove(callback)
```

移除周期性的函数 callback

#### modify

```python
def modify(self, f, mode):
    fd = f.fileno()
    self._impl.modify(fd, mode)
```

根据 `socket` 和传递过来的 `mode` 来修改该 `socket` 的监听模式

#### stop

```python
def stop(self):
    self._stopping = True
```

将 `_stopping` 标志位置为 `True`, 用来 grace(优雅) 停止.

#### run

```python
def run(self):
    events = []
    while not self._stopping:
        asap = False
        try:
            events = self.poll(TIMEOUT_PRECISION) # 取出来所有发生事件的 socket
        except (OSError, IOError) as e:
            if errno_from_exception(e) in (errno.EPIPE, errno.EINTR):
                # EPIPE: Happens when the client closes the connection
                # EINTR: Happens when received a signal
                # handles them as soon as possible
                asap = True
                logging.debug('poll:%s', e)
            else:
                logging.error('poll:%s', e)
                traceback.print_exc()
                continue

        for sock, fd, event in events: # 事件 socket 事件文件描述符 事件模式(POLL_IN POLL_OUT)
            handler = self._fdmap.get(fd, None) # 根据 file descriptor 获取 处理器 shadowsocks.tcpreply.TCPReply
            if handler is not None:
                handler = handler[1]
                try:
                    handler.handle_event(sock, fd, event)
                except (OSError, IOError) as e:
                    shell.print_exception(e)
        now = time.time()
        if asap or now - self._last_time >= TIMEOUT_PRECISION:
            for callback in self._periodic_callbacks:
                callback()
            self._last_time = now
```

终于迎来了 `run` 函数, 注入能量🎆, Power!

`events` 是发生的事件的数组, `while` 循环, 只要 `_stopping` 标志位为 `False`, 就继续循环.

`asap` 是 as soon as possible 的缩写, 标志着是否应该尽快处理有问题的 `socket`, 因为获取事件的时候有可能出错.

调用 `eventloop.poll` 并且传入时间精度来控制获取事件的最大超时时间, 一旦有数据流入或者是流出或者是其他的事件发生, 在这里就能拿到发生事件的数据 (sock, fd, event).

接下来处理每一个事件, 从 `_fdmap` 里面拿出来关于该文件描述符的数据(f, handler), 然后取出 `handler`, 然后将数据传递给处理器处理.

获取当前的时间戳, 如果获取事件的时候出错或者是现在距离上次调用周期性的函数超过了时间精度, 则调用周期性的函数然后更新调用的时间戳.

#### close

```python
def __del__(self):
    self._impl.close()
```

销毁函数, 在销毁该对象的时候调用该方法.

#### 来点图形吧

都是在介绍代码🤔, 好像违背了我刚开始说的图形化😣, 所以现在来画一张图形吧, 

[L2540]: <https://github.com/python/cpython/blob/master/Modules/selectmodule.c#L2540>
[freebsb-kqueue]: <https://www.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2&apropos=0&manpath=FreeBSD+11.1-RELEASE+and+Ports>
[Python-kqueue-control]: <https://docs.python.org/2.7/library/select.html#select.kqueue.control>
[understanding-kevent-control-method]: </deepinss/2017/12/23/understanding-kevent-control-method.html>