---
title: '启动🚀 local.py'
---

### Debugger

我一直坚信学习代码之前应该先学习 debugger.

选用 VSCode 来调试 python 代码非常的方便, 只要安装 python 的 debugger 插件就好.

### 解读 local.py

local.py 的开始指定了文件的运行环境 `/usr/bin/env python`, 第二行指定了文件的编码格式为utf8 `-*- coding: utf-8 -*-`

```python
import sys
import os
import logging
import signal
```
* sys: <https://docs.python.org/2/library/sys.html>
* os: <https://docs.python.org/2/library/os.html>
* logging: <https://docs.python.org/2/library/logging.html>
* signal: <https://docs.python.org/2/library/signal.html>

```python
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../'))
# __filename__: /Users/jiangxuan/loveTech/shadowsocks/shadowsocks/local.py
```
将项目根目录添加到模块搜寻目录中.

```python
from shadowsocks import shell, daemon, eventloop, tcprelay, udprelay, asyncdns
```
从 shadowsocks 模块引入需要的

### 页内目录

* [shell.check_python](#shellcheck_python)

### Code

```python
@shell.exception_handle(self_=False, exit_code=1) # shell 模块中捕获错误的工具
def main(): # local.py 主函数
    shell.check_python() # 检查 python 版本

    # fix py2exe 处理 window 上的问题, 暂时不予解释
    if hasattr(sys, "frozen") and sys.frozen in \
            ("windows_exe", "console_exe"):
        p = os.path.dirname(os.path.abspath(sys.executable))
        os.chdir(p)
    # 获取配置文件 传入参数, 表明是 local
    config = shell.get_config(True)
    daemon.daemon_exec(config)
    # log 启动地址
    logging.info("starting local at %s:%d" %
                 (config['local_address'], config['local_port']))

    dns_resolver = asyncdns.DNSResolver()
    tcp_server = tcprelay.TCPRelay(config, dns_resolver, True)
    udp_server = udprelay.UDPRelay(config, dns_resolver, True)
    loop = eventloop.EventLoop()
    dns_resolver.add_to_loop(loop)
    tcp_server.add_to_loop(loop)
    udp_server.add_to_loop(loop)

    def handler(signum, _):
        logging.warn('received SIGQUIT, doing graceful shutting down..')
        tcp_server.close(next_tick=True)
        udp_server.close(next_tick=True)
    signal.signal(getattr(signal, 'SIGQUIT', signal.SIGTERM), handler)

    def int_handler(signum, _):
        sys.exit(1)
    signal.signal(signal.SIGINT, int_handler)

    daemon.set_user(config.get('user', None))
    loop.run()
```

## shell.check_python

```python
def check_python():
    info = sys.version_info # 获取 version
    if info[0] == 2 and not info[1] >= 6: # 如果处于 2.x 版本, 但是
        print('Python 2.6+ required')
        sys.exit(1) # 退出
    elif info[0] == 3 and not info[1] >= 3:
        print('Python 3.3+ required')
        sys.exit(1)
    elif info[0] not in [2, 3]:
        print('Python version not supported')
        sys.exit(1)
```
* sys.version_info: <https://docs.python.org/2.7/library/sys.html#sys.version_info>
* sys.exit: <https://docs.python.org/2.7/library/sys.html#sys.exit>

```shell
                                     |--------- < 2.5.x 不支持, 退出
              |--------> 2.x.x ------|
              |                      |--------- <= 2.6.x && <= 2.9.x 支持
              |                      
              |                      |--------- < 3.3.x 不支持, 退出
x.x.x --------|--------> 3.x.x ------|
              |                      |--------- > 3.3.x 支持
              |
              |--------> x.x.x 不支持
```