---
title: eventloop🌕🌖🌗🌘🌑🌒🌓🌔🌕和TCPReply ⚒
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

## __all__ 导出

```python
__all__ = ['EventLoop', 'POLL_NULL', 'POLL_IN', 'POLL_OUT', 'POLL_ERR',
           'POLL_HUP', 'POLL_NVAL', 'EVENT_NAMES']
```

__all__ 声明该模块暴露出去的接口

```python
POLL_NULL = 0x00
POLL_IN = 0x01
POLL_OUT = 0x04
POLL_ERR = 0x08
POLL_HUP = 0x10
```

* POLL_NULL 用来做掩码运算 00000000
* POLL_IN 数据流入的标志位 00000001
* POLL_OUT 数据流出的标志位 00000010