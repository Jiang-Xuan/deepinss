---
title: "eventloop.py"
---

**eventloop.py** 事件轮询器
=========================

**_Work in progress stage 1(尚在进展中)_**

* [wip](#wip)

该模块负责监听所有的 socket, 获取这些 socket 发生的事件, 然后将其分发给注册的监听器

import
-------

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

* [\_\_future\_\_](https://docs.python.org/2/library/__future__.html)
* [os](https://docs.python.org/2/library/os.html)
* [time](https://docs.python.org/2/library/time.html)
* [socket](https://docs.python.org/2/library/socket.html)
* [select](https://docs.python.org/2/library/select.html)
* [traceback](https://docs.python.org/2/library/traceback.html)
* [errno](https://docs.python.org/2/library/errno.html)
* [logging](https://docs.python.org/2/library/logging.html)
* [collections](https://docs.python.org/2/library/collections.html)
* [shadowsocks](https://docs.python.org/2/library/shadowsocks.html)

导出
-----

```python
__all__ = ['EventLoop', 'POLL_NULL', 'POLL_IN', 'POLL_OUT', 'POLL_ERR',
           'POLL_HUP', 'POLL_NVAL', 'EVENT_NAMES']
```

\_\_all\_\_ 声明从该模块导出的变量, 该变量在 `from xxx import *` 生效. 详细见[这里](https://docs.python.org/2/tutorial/modules.html#importing-from-a-package).

模块常量
-------

```python
POLL_NULL = 0x00
POLL_IN = 0x01
POLL_OUT = 0x04
POLL_ERR = 0x08
POLL_HUP = 0x10
POLL_NVAL = 0x20

EVENT_NAMES = {
    POLL_NULL: 'POLL_NULL',
    POLL_IN: 'POLL_IN',
    POLL_OUT: 'POLL_OUT',
    POLL_ERR: 'POLL_ERR',
    POLL_HUP: 'POLL_HUP',
    POLL_NVAL: 'POLL_NVAL',
}
TIMEOUT_PRECISION = 10
```

`POLL_*` 变量标识发生的一个事件的数据状态

* `POLL_NULL` `00000000` 用来初始化位运算
* `POLL_IN`   `00000001` 数据可以流入(可读)
* `POLL_OUT`  `00000100` 数据可以流出(可写)
* `POLL_ERR`  `00001000` 事件发生了错误
  > A POLLERR means the socket got an asynchronous error. In TCP, this typically means a RST has been received or sent. If the file descriptor is not a socket, POLLERR might mean the device does not support polling.

  > 引用自: <https://stackoverflow.com/questions/24791625/how-to-handle-the-linux-socket-revents-pollerr-pollhup-and-pollnval>

  > POLLERR 意味着该 socket 获得了一个异步错误. 在 TCP 里, 这尤其意味着一个 RST 包被收到或者是被发送了. 如果这个文件描述符不是 socket, POLLERR 可能意味着该设备不支持轮询
* `POLL_HUP`  `00001010` 事件发生了错误
  > A POLLHUP means the socket is no longer connected. In TCP, this means FIN has been received and sent.

  > 引用自: <https://stackoverflow.com/questions/24791625/how-to-handle-the-linux-socket-revents-pollerr-pollhup-and-pollnval>

  > POLLHUP 意味着该 socket 不再连接了. 在 TCP 里, 这意味着 FIN 包被收到或者是被发送了
* `POLL_NVAL`  `00010000` 事件发生了错误
  > A POLLNVAL means the socket file descriptor is not open. It would be an error to close() it.

  > 引用自: <https://stackoverflow.com/questions/24791625/how-to-handle-the-linux-socket-revents-pollerr-pollhup-and-pollnval>

  > POLLNVAL 意味着该 socket 文件描述符没有打开. 在调用 close() 的时候会抛出这个错误.

* `EVENT_NAMES` 变量方便从二进制的数值获得关于该二进制数值的文字描述(其实就是变量的字符串形式, 方便打印日志)

* `TIMEOUT_PRECISION` 超时精度, 如果一个请求超过了该时间没有活跃, 会清除关于该请求的资源, 在调试的时候将该值调大会方便单步调试.

class KqueueLoop
----------------

### 简介

[Kqueue](https://en.wikipedia.org/wiki/Kqueue) 形式的轮询, 获取发生的事件. 支持的平台有 NetBSD, OpenBSD, DragonflyBSD, and OS X(数据来源自维基百科)

### 类常量

```python
MAX_EVENTS = 1024
```

一次循环中取出来的最多的事件数量

### 类构造器 \_\_init\_\_

```python
def __init__(self):
    self._kqueue = select.kqueue()
    self._fds = {}
```

`select.kqueue()` 创建一个 kqueue 事件获取方式

`_fds` 存储着 file descriptor(文件描述符) -> 对应的监听的 mode(POLL_IN 或 POLL_OUT)

### \_control

#### 简介

监听或者是移除监听一个文件描述符的状态

```python
def _control(self, fd, mode, flags):
    events = []
    if mode & POLL_IN:
        events.append(select.kevent(fd, select.KQ_FILTER_READ, flags))
    if mode & POLL_OUT:
        events.append(select.kevent(fd, select.KQ_FILTER_WRITE, flags))
    for e in events:
        self._kqueue.control([e], 0)
```

#### 接收参数

* *self* 实例自身
* *fd* 文件描述符
* *mode* 模式, POLL_IN 或 POLL_OUT
* *flags* KQ_EV_ADD 是添加监听, KQ_EV_DELETE 是移除监听(移除监听传入的 mode 需要和添加监听时候的一致)

#### 交互式程序流

<!-- EVENTLOOPANIMATION
CODECONTENT:
  `
def _control(self, fd, mode, flags):
    events = []
    if mode & POLL_IN:
        events.append(select.kevent(fd, select.KQ_FILTER_READ, flags))
    if mode & POLL_OUT:
        events.append(select.kevent(fd, select.KQ_FILTER_WRITE, flags))
    for e in events:
        self._kqueue.control([e], 0)
  `

CODETYPE: `python`

ID: `_control-inter`

TITLE: 'EventLoop _control 程序执行流'

-->

{% include eventloopanimation.html %}

<script>
;(() => {
  const _controlDOM = $('#_control-inter')
  const _controlELA = $ela(_controlDOM)

  _controlELA
    .state().moveToLine(1).showCodeBar().commentary('执行函数')
    .state().hideCommentary().moveToLine(2).commentary('该监听模式下需要监听的事件 list')
    .state().hideCommentary().moveToLine(3).commentary('如果监听模式含有 POLL_IN')
    .state().hideCommentary().moveToLine(4).commentary('创建一个 kevent, 传递参数 fd(文件描述符), select.KQ_FILTER_READ(读筛选器), flags(标志, 删除还是添加)')
    .state().hideCommentary().moveToLine(5).commentary('如果监听模式含有 POLL_OUT')
    .state().hideCommentary().moveToLine(6).commentary('创建一个 kevent, 传递参数 fd(文件描述符), select.KQ_FILTER_WRITE(写筛选器), flags(标志, 删除还是添加)')
    .state().hideCommentary().moveToLine(7).commentary('循环需要监听的事件')
    .state().hideCommentary().moveToLine(8).commentary('调用 self._kqueue.control 传入 [e](需要监听的事件), 0(取出来的最大事件, 这里只是开始该监听模式, 并不处理事件)')
})();
</script>
