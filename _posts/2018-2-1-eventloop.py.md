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

[Kqueue](https://en.wikipedia.org/wiki/Kqueue) 形式的轮询, 获取发生的事件. 支持的平台有 NetBSD, OpenBSD, DragonflyBSD, and OS X(数据来源自[维基百科](https://en.wikipedia.org/wiki/Kqueue))

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

监听或者是移除监听一个文件描述符的状态, 该函数为私有函数

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


<!-- Generate by template.js -->
<div class="program-flow-walkthrough" data-panel-title="KqueueLoop _control 程序执行流" id="_control-inter">
			<div class="program-flow-walkthrough-codesource">
				<div class="line-highlight"></div>
				<div class="codehilite">
					{% highlight python %}
def _control(self, fd, mode, flags):
    events = []
    if mode & POLL_IN:
        events.append(select.kevent(fd, select.KQ_FILTER_READ, flags))
    if mode & POLL_OUT:
        events.append(select.kevent(fd, select.KQ_FILTER_WRITE, flags))
    for e in events:
        self._kqueue.control([e], 0)
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


### poll

#### 简介

取出来发生的事件, 一次取出来的最多的事件数量为 `KqueueLoop.MAX_EVENTS`, 超时时间为 `timeout`, 如果超过了超时时间依旧没有事件发生, 程序继续往下走

```python
def poll(self, timeout):
    if timeout < 0:
        timeout = None  # kqueue behaviour
    events = self._kqueue.control(
        None, KqueueLoop.MAX_EVENTS, timeout
    )
    results = defaultdict(lambda: POLL_NULL)
    for e in events:
        fd = e.ident
        if e.filter == select.KQ_FILTER_READ:
            results[fd] |= POLL_IN
        elif e.filter == select.KQ_FILTER_WRITE:
            results[fd] |= POLL_OUT
    return results.items()
```

#### 接收参数

* *self* 实例本身
* *timeout* 超时时间

#### 注意点

[`defaultdict`](https://docs.python.org/2/library/collections.html#defaultdict-objects) 类 在给一个 key 赋值的时候, 该 key 不存在, 就会调用 `lambda: POLL_NULL`, 这就是 **POLL_NULL** 常量的用处.

#### 交互式程序流


<!-- Generate by template.js -->
<div class="program-flow-walkthrough" data-panel-title="KqueueLoop poll 程序执行流" id="poll-inter">
			<div class="program-flow-walkthrough-codesource">
				<div class="line-highlight"></div>
				<div class="codehilite">
					{% highlight python %}
def poll(self, timeout):
    if timeout < 0:
        timeout = None  # kqueue behaviour
    events = self._kqueue.control(
        None, KqueueLoop.MAX_EVENTS, timeout
    )
    results = defaultdict(lambda: POLL_NULL)
    for e in events:
        fd = e.ident
        if e.filter == select.KQ_FILTER_READ:
            results[fd] |= POLL_IN
        elif e.filter == select.KQ_FILTER_WRITE:
            results[fd] |= POLL_OUT
    return results.items()
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


### register

#### 简介

注册一个 fd(文件描述符) 进入监听序列, 监听模式为 mode

```python
def register(self, fd, mode):
    self._fds[fd] = mode # 文件描述符和其监听模式的对应
    self._control(fd, mode, select.KQ_EV_ADD) # 添加注册 传入 Kqueue 的添加常量
```

#### 接收参数

* *self* 实例本身
* *fd* 文件描述符
* *mode* 监听模式

#### 注意点

`self._fds[fd] = mode` 将监听的文件描述符和其监听的模式存储在 `_fd` dict 中, 方便在移除的时候取出来该文件描述符在监听时候的 mode

#### 交互式程序流


<!-- Generate by template.js -->
<div class="program-flow-walkthrough" data-panel-title="KqueueLoop register 程序执行流" id="register-inter">
			<div class="program-flow-walkthrough-codesource">
				<div class="line-highlight"></div>
				<div class="codehilite">
					{% highlight python %}
def register(self, fd, mode):
    self._fds[fd] = mode # 文件描述符和其监听模式的对应
    self._control(fd, mode, select.KQ_EV_ADD) # 添加注册 传入 Kqueue 的添加常量
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


### unregister

#### 简介

移除注册在监听序列中的 fd(文件描述符), 其监听模式已经存储在 `self._fds` 中

```python
def unregister(self, fd):
    self._control(fd, self._fds[fd], select.KQ_EV_DELETE) # KQ_EN_DELETE 删除注册 self._fds 拿出来注册该文件描述符的时候的模式
    del self._fds[fd] # 移除 KqueueLopp 关于该文件描述符的数据(mode)
```

#### 接收参数

* *self* 实例本身
* *fd* 要移除的文件描述符

#### 注意点

移除注册时候不需要传递 mode, 因为在监听的时候已经保存在 `self._fds` 中

#### 交互式程序流


<!-- Generate by template.js -->
<div class="program-flow-walkthrough" data-panel-title="KqueueLoop unregister 程序执行流" id="unregister-inter">
			<div class="program-flow-walkthrough-codesource">
				<div class="line-highlight"></div>
				<div class="codehilite">
					{% highlight python %}
def unregister(self, fd):
    self._control(fd, self._fds[fd], select.KQ_EV_DELETE) # KQ_EN_DELETE 删除注册 self._fds 拿出来注册该文件描述符的时候的模式
    del self._fds[fd] # 移除 KqueueLopp 关于该文件描述符的数据(mode)
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


### modify

#### 简介

修改一个文件描述符的监听模式, 从 POLL_IN 到 POLL_OUT 或者是反过来

```python
def modify(self, fd, mode):
    self.unregister(fd) # 删除注册 file descriptor => mode
    self.register(fd, mode) # 重新注册 file descriptor => mode
```

#### 接收参数

* *self* 实例本身
* *fd* 文件描述符
* *mode* 修改成的监听模式

#### 交互式程序流


<!-- Generate by template.js -->
<div class="program-flow-walkthrough" data-panel-title="KqueueLoop modify 程序执行流" id="modify-inter">
			<div class="program-flow-walkthrough-codesource">
				<div class="line-highlight"></div>
				<div class="codehilite">
					{% highlight python %}
def modify(self, fd, mode):
    self.unregister(fd) # 删除注册 file descriptor => mode
    self.register(fd, mode) # 重新注册 file descriptor => mode
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
  var _controlDOM = $('#_control-inter');
  var _controlELA = $ela(_controlDOM);

  _controlELA.state().moveToLine(1).showCodeBar().commentary('执行函数').state().hideCommentary().moveToLine(2).commentary('该监听模式下需要监听的事件 list').state().hideCommentary().moveToLine(3).commentary('如果监听模式含有 POLL_IN').state().hideCommentary().moveToLine(4).commentary('创建一个 kevent, 传递参数 fd(文件描述符), select.KQ_FILTER_READ(读筛选器), flags(标志, 删除还是添加)').state().hideCommentary().moveToLine(5).commentary('如果监听模式含有 POLL_OUT').state().hideCommentary().moveToLine(6).commentary('创建一个 kevent, 传递参数 fd(文件描述符), select.KQ_FILTER_WRITE(写筛选器), flags(标志, 删除还是添加)').state().hideCommentary().moveToLine(7).commentary('循环需要监听的事件').state().hideCommentary().moveToLine(8).commentary('调用 self._kqueue.control 传入 [e](需要监听的事件), 0(取出来的最大事件, 这里只是开始该监听模式, 并不处理事件)');
})();
;(function () {
  var pollDOM = $('#poll-inter');
  var pollELA = $ela(pollDOM);

  pollELA.state().moveToLine(1).showCodeBar().commentary('执行函数').state().hideCommentary().moveToLine(2).commentary('如果 timeout 参数小于零').state().hideCommentary().moveToLine(3).commentary('将 None 赋值给 timeout, 根据注释意为让 kqueue 自行决定行为').state().hideCommentary().moveToLine(4).commentary('调用 self._kqueue.control 函数, 传入合适的参数, 获取发生的所有事件').state().hideCommentary().moveToLine(7).commentary('创建 defaultdict 类型变量 results').state().hideCommentary().moveToLine(8).commentary('循环所有发生的事件').state().hideCommentary().moveToLine(9).commentary('获取发生该事件的文件描述符').state().hideCommentary().moveToLine(10).commentary('如果事件的过滤器类型为 select.KQ_FILTER_READ, 说明该事件是可读事件, 有数据流入').state().hideCommentary().moveToLine(11).commentary('给 results 的 fd 数据赋予 POLL_IN').state().hideCommentary().moveToLine(12).commentary('如果事件的过滤器类型为 select.KQ_FILTER_WRITE, 说明该事件是可写事件, 表示数据可以被写入').state().hideCommentary().moveToLine(13).commentary('给 results 的 fd 数据赋予 POLL_OUT').state().hideCommentary().moveToLine(14).commentary('调用 results.items() 返回 list 类型数据 [(6(文件描述符), 0x02(事件模式)), (4, 0x01)]');
})();
;(function () {
  var registerDOM = $('#register-inter');
  var registerELA = $ela(registerDOM);

  registerELA.state().moveToLine(1).showCodeBar().commentary('执行函数').state().hideCommentary().moveToLine(2).commentary('文件描述符和其监听模式的对应').state().hideCommentary().moveToLine(3).commentary('调用 self._control, 传入参数 fd(文件描述符), mode(监听模式), select.KQ_EV_ADD(select 模块常量, 添加监听)').pushJumpFuncList('self._control', '#_control-inter');
})();
;(function () {
  var unregisterDOM = $('#unregister-inter');
  var unregisterELA = $ela(unregisterDOM);

  unregisterELA.state().moveToLine(1).showCodeBar().commentary('执行函数').state().hideCommentary().moveToLine(2).commentary('调用 self._control, 传入参数 fd(文件描述符), self._fds[fd](从 self._fds 中取出来添加监听时候的模式), select.KQ_EV_DELETE(select 模块常量, 移除监听)').state().hideCommentary().moveToLine(4).commentary('删除 self._fds 中关于该文件描述符的数据');
})();
;(function () {
  var modifyDOM = $('#modify-inter');
  var modifyELA = $ela(modifyDOM);

  modifyELA.state().moveToLine(1).showCodeBar().commentary('执行函数').state().hideCommentary().moveToLine(2).commentary('首先取消注册该文件描述符, 传入参数 fd(文件描述符)').pushJumpFuncList('self.unregister', '#unregister-inter').state().hideCommentary().moveToLine(3).commentary('然后重新注册该文件描述符, 传入参数 fd(文件描述符), mode(监听模式)').pushJumpFuncList('self.register', '#register-inter');
})();
/* Transformed by babel-transform.js END */
</script>
