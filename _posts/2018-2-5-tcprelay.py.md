---
title: "tcprelay.py"
---

tcprelay 处理 TCP 请求
=====================

**_Work in process(尚未完结)_**

该模块负责监听 TCP 请求, 在有请求发生的时候, EventLoop 会将事件分发到此

import
------

```python
from __future__ import absolute_import, division, print_function, \
    with_statement

import time
import socket
import errno
import struct
import logging
import traceback
import random

from shadowsocks import cryptor, eventloop, shell, common
from shadowsocks.common import parse_header, onetimeauth_verify, \
    onetimeauth_gen, ONETIMEAUTH_BYTES, ONETIMEAUTH_CHUNK_BYTES, \
    ONETIMEAUTH_CHUNK_DATA_LEN, ADDRTYPE_AUTH
```

* [\_\_future\_\_](https://docs.python.org/2/library/__future__.html)
* [socket](https://docs.python.org/2/library/socket.html)
* [errno](https://docs.python.org/2/library/errno.html)
* [struct](https://docs.python.org/2/library/struct.html)
* [logging](https://docs.python.org/2/library/logging.html)
* [traceback](https://docs.python.org/2/library/traceback.html)
* [random](https://docs.python.org/2/library/random.html)
* cryptor(暂无链接)
* [eventloop](/deepinss/2018/02/01/eventloop.py.html)
* [shell](/deepinss/2018/01/24/shell.py.html)
* common(暂无链接)
* parse_header(暂无链接)
* onetimeauth_verify(暂无链接)
* onetimeauth_gen(暂无链接)
* ONETIMEAUTH_BYTES(暂无链接)
* ONETIMEAUTH_CHUNK_BYTES(暂无链接)
* ONETIMEAUTH_CHUNK_DATA_LEN(暂无链接)
* ADDRTYPE_AUTH(暂无链接)

模块常量
-------

```python
TIMEOUTS_CLEAN_SIZE = 512
```

一次清理超时请求的上线

```python
MSG_FASTOPEN = 0x20000000
```


```python

```