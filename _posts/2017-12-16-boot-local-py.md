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
* [shell.get_config](#shellget_config)

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
    # 是否启动守护模式, 暂不解释
    daemon.daemon_exec(config)
    # log 启动地址
    logging.info("starting local at %s:%d" %
                 (config['local_address'], config['local_port']))
    # 创建 dns_resover
    dns_resolver = asyncdns.DNSResolver()
    # 创建 tcp 服务, 并且传入 dns_resover 服务, 和表明自己是 local 的True
    tcp_server = tcprelay.TCPRelay(config, dns_resolver, True)
    # 创建 udp 服务, 并且传入 dns_resover 服务, 和表明自己是 local 的True
    udp_server = udprelay.UDPRelay(config, dns_resolver, True)
    # 创建事件轮询
    loop = eventloop.EventLoop()
    # 将 dns_resover 加入事件轮询
    dns_resolver.add_to_loop(loop)
    # 将 tcp 服务 加入事件轮询
    tcp_server.add_to_loop(loop)
    # 将 ucp 服务 加入事件轮询
    udp_server.add_to_loop(loop)

    # 处理系统信号 <https://www.gnu.org/software/libc/manual/html_node/Termination-Signals.html>
    def handler(signum, _):
        logging.warn('received SIGQUIT, doing graceful shutting down..')
        tcp_server.close(next_tick=True)
        udp_server.close(next_tick=True)
    signal.signal(getattr(signal, 'SIGQUIT', signal.SIGTERM), handler)

    def int_handler(signum, _):
        sys.exit(1)
    signal.signal(signal.SIGINT, int_handler)
    # 处理系统信号 END

    daemon.set_user(config.get('user', None))
    # 启动轮询
    loop.run()

# 如果当前模块被直接运行, 执行 main 函数
# <https://stackoverflow.com/questions/419163/what-does-if-name-main-do>
if __name__ == '__main__':
    main()

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

## shell.get_config

```python

def get_config(is_local):
    global verbose # shell 模块的全局变量
    # 配置 logging
    logging.basicConfig(level=logging.DEBUG,
                        format='%(levelname)-s: %(message)s')
    if is_local: # 分析 local 端, 这里 一定是 True
        shortopts = 'hd:s:b:p:k:l:m:c:t:vqa'
        longopts = ['help', 'fast-open', 'pid-file=', 'log-file=', 'user=',
                    'libopenssl=', 'libmbedtls=', 'libsodium=', 'version']
    # else:
    #     shortopts = 'hd:s:p:k:m:c:t:vqa'
    #     longopts = ['help', 'fast-open', 'pid-file=', 'log-file=', 'workers=',
    #                 'forbidden-ip=', 'user=', 'manager-address=', 'version',
    #                 'libopenssl=', 'libmbedtls=', 'libsodium=', 'prefer-ipv6']
    try:
        config_path = find_config() # find_config 用来获取默认的项目内的配置文件
        # 获取命令行参数
        optlist, args = getopt.getopt(sys.argv[1:], shortopts, longopts)
        for key, value in optlist:
            if key == '-c':
                config_path = value # 如果命令行中指定了配置文件目录, 覆盖默认

        # 配置目录存在, 则从配置文件中读取配置
        if config_path:
            # log 从哪里读取的配置文件
            logging.info('loading config from %s' % config_path)
            with open(config_path, 'rb') as f:
                try:
                    # 解析配置文件
                    config = parse_json_in_str(f.read().decode('utf8'))
                except ValueError as e:
                    # 解析配置文件出错, 退出程序
                    logging.error('found an error in config.json: %s',
                                  e.message)
                    sys.exit(1)
        else:
            # 配置文件路径不存在, 默认为空
            config = {}

        # 记录日志输出详细等级
        v_count = 0
        # 格式化参数
        for key, value in optlist:
            if key == '-p': # 服务器端口 int 类型
                config['server_port'] = int(value)
            elif key == '-k': # 秘钥 bytes 类型
                config['password'] = to_bytes(value)
            elif key == '-l': # 本地端口 int 类型
                config['local_port'] = int(value)
            elif key == '-s': # 服务器地址 str 类型
                config['server'] = to_str(value)
            elif key == '-m': # 加密方式 str 类型
                config['method'] = to_str(value)
            elif key == '-b': # 本地监听地址
                config['local_address'] = to_str(value)
            elif key == '-v': # 提高日志输出详细等级
                v_count += 1
                # '-vv' turns on more verbose mode
                config['verbose'] = v_count
            elif key == '-a': # 是否启用一次性验证 bool 类型
                config['one_time_auth'] = True
            elif key == '-t': # 过期时间 int 类型
                config['timeout'] = int(value)
            elif key == '--fast-open': # 是否启用 fast open bool 类型
                config['fast_open'] = True
            elif key == '--libopenssl': # openssl 库地址 str 类型
                config['libopenssl'] = to_str(value)
            elif key == '--libmbedtls': # mbedtls 库地址 str 类型
                config['libmbedtls'] = to_str(value)
            elif key == '--libsodium': # sodium 库地址 str 类型
                config['libsodium'] = to_str(value)
            elif key == '--workers': # worker 数量 int 类型
                config['workers'] = int(value)
            elif key == '--manager-address': # 管理地址 str 类型
                config['manager_address'] = to_str(value)
            elif key == '--user': # 启动用户 str 类型
                config['user'] = to_str(value)
            elif key == '--forbidden-ip': # 禁止 IP str 类型, 切割成 list 类型
                config['forbidden_ip'] = to_str(value).split(',')
            elif key in ('-h', '--help'): # 输出帮助信息并退出
                if is_local:
                    print_local_help()
                # else:
                #     print_server_help()
                sys.exit(0)
            elif key == '--version': # 输出 shadowsocks 的版本信息
                print_shadowsocks()
                sys.exit(0)
            elif key == '-d': # 守护模式命令 str 类型
                config['daemon'] = to_str(value)
            elif key == '--pid-file': # pid file 路径 str 类型
                config['pid-file'] = to_str(value)
            elif key == '--log-file': # log file 日志路径 str 类型
                config['log-file'] = to_str(value)
            elif key == '-q': # 降低日志输出详细等级
                v_count -= 1
                config['verbose'] = v_count
            elif key == '--prefer-ipv6': # 更偏爱 ipv6
                config['prefer_ipv6'] = True
    except getopt.GetoptError as e: # 如果命令行参数获取出错, 打印 local 帮助信息, 退出程序
        print(e, file=sys.stderr)
        print_help(is_local)
        sys.exit(2)

    if not config: # 如果 config 没有任何属性, 打印 local 帮助信息, 退出程序
        logging.error('config not specified')
        print_help(is_local)
        sys.exit(2)

    # 格式化完毕参数, 开始整理参数, 如果没有指定, 启用默认参数
    config['password'] = to_bytes(config.get('password', b''))
    config['method'] = to_str(config.get('method', 'aes-256-cfb'))
    config['port_password'] = config.get('port_password', None)
    config['timeout'] = int(config.get('timeout', 300))
    config['fast_open'] = config.get('fast_open', False)
    config['workers'] = config.get('workers', 1)
    config['pid-file'] = config.get('pid-file', '/var/run/shadowsocks.pid')
    config['log-file'] = config.get('log-file', '/var/log/shadowsocks.log')
    config['verbose'] = config.get('verbose', False)
    config['local_address'] = to_str(config.get('local_address', '127.0.0.1'))
    config['local_port'] = config.get('local_port', 1080)
    config['one_time_auth'] = config.get('one_time_auth', False)
    config['prefer_ipv6'] = config.get('prefer_ipv6', False)
    config['server_port'] = config.get('server_port', 8388)
    config['dns_server'] = config.get('dns_server', None)
    config['libopenssl'] = config.get('libopenssl', None)
    config['libmbedtls'] = config.get('libmbedtls', None)
    config['libsodium'] = config.get('libsodium', None)

    config['tunnel_remote'] = to_str(config.get('tunnel_remote', '8.8.8.8'))
    config['tunnel_remote_port'] = config.get('tunnel_remote_port', 53)
    config['tunnel_port'] = config.get('tunnel_port', 53)

    logging.getLogger('').handlers = []
    logging.addLevelName(VERBOSE_LEVEL, 'VERBOSE')
    if config['verbose'] >= 2:
        level = VERBOSE_LEVEL
    elif config['verbose'] == 1:
        level = logging.DEBUG
    elif config['verbose'] == -1:
        level = logging.WARN
    elif config['verbose'] <= -2:
        level = logging.ERROR
    else:
        level = logging.INFO
    verbose = config['verbose']
    # 根据config参数配置logging
    logging.basicConfig(level=level,
                        format='%(asctime)s %(levelname)-8s %(message)s',
                        datefmt='%Y-%m-%d %H:%M:%S')

    # 检查config文件, 主要是检查配置的加密算法是否由本机支持
    check_config(config, is_local)

    # 返回config参数, 运行到这里说明所有的参数都是符合要求的
    return config
```

* logging.basicConfig: <https://docs.python.org/2.7/library/logging.html#logging.basicConfig>
* getopt: <https://docs.python.org/2.7/library/getopt.html>

## shell.find_config

```python
def find_config():
    config_path = 'config.json' # 当前目录下面的 配置文件
    if os.path.exists(config_path): # 如果存在则返回路径
        return config_path
    config_path = os.path.join(os.path.dirname(__file__), '../', 'config.json') # 寻找项目根目录下面的配置文件, 如果找到就返回路径
    if os.path.exists(config_path):
        return config_path
    return None # 没有找到任何项目内的配置文件, 返回 None
```

* os.path.exists: <https://docs.python.org/2.7/library/os.path.html#os.path.exists>
* os.path.join: <https://docs.python.org/2.7/library/os.path.html#os.path.join>
