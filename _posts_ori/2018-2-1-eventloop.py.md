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