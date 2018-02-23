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
# SOCKS METHOD definition
METHOD_NOAUTH = 0
```

socket 代理协议的定义握手协商期间不用任何认证的常量, 另见[这里](https://en.wikipedia.org/wiki/SOCKS)

```python
# SOCKS command definition # 这里的变量是由 socks 协议规定的协议头的常量
CMD_CONNECT = 1
CMD_BIND = 2
CMD_UDP_ASSOCIATE = 3
```

socks 协议规定的协议头的常量, 请见上方 Wikipedia 链接

```python
# for each opening port, we have a TCP Relay

# for each connection, we have a TCP Relay Handler to handle the connection

# for each handler, we have 2 sockets:
#    local:   connected to the client
#    remote:  connected to remote server

# for each handler, it could be at one of several stages:

# as sslocal:
# stage 0 auth METHOD received from local, reply with selection message
# stage 1 addr received from local, query DNS for remote
# stage 2 UDP assoc
# stage 3 DNS resolved, connect to remote
# stage 4 still connecting, more data from local received
# stage 5 remote connected, piping local and remote

# as ssserver:
# stage 0 just jump to stage 1
# stage 1 addr received from local, query DNS for remote
# stage 3 DNS resolved, connect to remote
# stage 4 still connecting, more data from local received
# stage 5 remote connected, piping local and remote

STAGE_INIT = 0
STAGE_ADDR = 1
STAGE_UDP_ASSOC = 2
STAGE_DNS = 3
STAGE_CONNECTING = 4
STAGE_STREAM = 5
STAGE_DESTROYED = -1
```

这些注释非常重要, 解释了 ss 运作的核心机制


<!-- Generate by template.js -->
<div class="program-flow-walkthrough" data-panel-title="tcprelay 模块常量解释" id="tcprelay-constant-explain-inter">
			<div class="program-flow-walkthrough-codesource">
				<div class="line-highlight"></div>
				<div class="codehilite">
					{% highlight python %}
# for each opening port, we have a TCP Relay

# for each connection, we have a TCP Relay Handler to handle the connection

# for each handler, we have 2 sockets:
#    local:   connected to the client
#    remote:  connected to remote server

# for each handler, it could be at one of several stages:

# as sslocal:
# stage 0 auth METHOD received from local, reply with selection message
# stage 1 addr received from local, query DNS for remote
# stage 2 UDP assoc
# stage 3 DNS resolved, connect to remote
# stage 4 still connecting, more data from local received
# stage 5 remote connected, piping local and remote

# as ssserver:
# stage 0 just jump to stage 1
# stage 1 addr received from local, query DNS for remote
# stage 3 DNS resolved, connect to remote
# stage 4 still connecting, more data from local received
# stage 5 remote connected, piping local and remote

STAGE_INIT = 0
STAGE_ADDR = 1
STAGE_UDP_ASSOC = 2
STAGE_DNS = 3
STAGE_CONNECTING = 4
STAGE_STREAM = 5
STAGE_DESTROYED = -1
					{% endhighlight %}
				</div>
			</div>
			<table>
				<tr class="jump-func-list">
								<th>跳转函数列表</th>
								<td><div class="event-loop-items">
									<div class="event-loop-rail">
										
									</div>
								</div></td>
							</tr>
			</table>
			<div class="event-loop-controls">
					    <svg viewBox="0 0 5 2">
					      <path d="M2,0 L2,2 L0,1 z"></path>
					      <path d="M3,0 L5,1 L3,2 z"></path>
					      <path class="prev-btn" d="M0,0 H2.5V2H0z"></path>
					      <path class="next-btn" d="M2.5,0 H5V2H2.5z"></path>
					    </svg>
					</div>
			<div class="event-loop-commentary">
					    <div class="event-loop-commentary-item"></div>
					</div>
		</div>
<!-- Generate by template.js END -->


{% include eventloopanimation.html %}

<script>
/* Transformed by babel-transform.js */
'use strict';

;(function () {
  var tcprelayConstantExplainInterDOM = $('#tcprelay-constant-explain-inter');
  var tcprelayConstantExplainInterELA = $ela(tcprelayConstantExplainInterDOM);

  tcprelayConstantExplainInterELA.state().moveToLine(1).showCodeBar().commentary('对于每一个监听的端口, 有一个 TCP Relay').state().hideCommentary().moveByRela(2).commentary('对于每一个连接请求, 都有一个 TCP Relay Handler 来处理这个请求').state().hideCommentary().moveByRela(2).commentary('对于每一个 handler, 我们都两个 socket').state().hideCommentary().moveByRela().commentary('local socket, 连接 client(一般为浏览器) 的 socket').state().hideCommentary().moveByRela().commentary('server socket, 连接 server(ssserver) 的 socket').state().hideCommentary().moveByRela(2).commentary('对于每一个 handler, 它至少应该处在以下的这几个阶段之一');
})();
;(function () {});
/* Transformed by babel-transform.js END */
</script>
