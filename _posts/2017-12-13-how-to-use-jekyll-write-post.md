## SS Directory Tree


这里是用 Shell 命令 [tree](https://www.freebsd.org/cgi/man.cgi?query=tree&apropos=0&sektion=0&manpath=FreeBSD+11.1-RELEASE+and+Ports&arch=default&format=html) 展现的 整个 SS 项目的目录

```shell
├── CHANGES
├── CONTRIBUTING.md
├── Dockerfile
├── LICENSE # 项目的开原协议
├── MANIFEST.in
├── README.md # 项目REAME.md 文件
├── README.rst # Docutils项目的文件 <https://zh.wikipedia.org/wiki/ReStructuredText>
├── config.json.example # 配置文件示例
├── debian
│   ├── changelog
│   ├── compat
│   ├── config.json
│   ├── control
│   ├── copyright
│   ├── docs
│   ├── init.d
│   ├── install
│   ├── rules
│   ├── shadowsocks.default
│   ├── shadowsocks.manpages
│   ├── source
│   │   └── format
│   ├── sslocal.1
│   └── ssserver.1
├── setup.py
├── shadowsocks
│   ├── __init__.py
│   ├── asyncdns.py
│   ├── common.py
│   ├── crypto
│   │   ├── __init__.py
│   │   ├── aead.py
│   │   ├── hkdf.py
│   │   ├── mbedtls.py
│   │   ├── openssl.py
│   │   ├── rc4_md5.py
│   │   ├── sodium.py
│   │   ├── table.py
│   │   ├── util.py
│   ├── cryptor.py
│   ├── daemon.py
│   ├── eventloop.py
│   ├── local.py
│   ├── lru_cache.py
│   ├── manager.py
│   ├── server.py
│   ├── shell.py
│   ├── tcprelay.py
│   ├── tunnel.py
│   ├── udprelay.py
├── snapcraft.yaml
├── tests
│   ├── aes-cfb1.json
│   ├── aes-cfb8.json
│   ├── aes-ctr.json
│   ├── aes-gcm.json
│   ├── aes-ocb.json
│   ├── aes-ofb.json
│   ├── aes.json
│   ├── assert.sh
│   ├── camellia.json
│   ├── chacha20-ietf-poly1305.json
│   ├── chacha20-ietf.json
│   ├── chacha20-poly1305.json
│   ├── chacha20.json
│   ├── client-multi-server-ip.json
│   ├── coverage_server.py
│   ├── fastopen.json
│   ├── gen_multiple_passwd.py
│   ├── graceful.json
│   ├── graceful_cli.py
│   ├── graceful_server.py
│   ├── ipv6-client-side.json
│   ├── ipv6.json
│   ├── jenkins.sh
│   ├── libmbedtls
│   │   └── install.sh
│   ├── libopenssl
│   │   └── install.sh
│   ├── libsodium
│   │   └── install.sh
│   ├── mbedtls-aes-ctr.json
│   ├── mbedtls-aes-gcm.json
│   ├── mbedtls-aes.json
│   ├── mbedtls-camellia.json
│   ├── nose_plugin.py
│   ├── rc4-md5-ota.json
│   ├── rc4-md5.json
│   ├── salsa20-ctr.json
│   ├── salsa20.json
│   ├── server-dnsserver.json
│   ├── server-multi-passwd-client-side.json
│   ├── server-multi-passwd-empty.json
│   ├── server-multi-passwd-performance.json
│   ├── server-multi-passwd-table.json
│   ├── server-multi-passwd.json
│   ├── server-multi-ports.json
│   ├── setup_tc.sh
│   ├── socksify
│   │   ├── install.sh
│   │   └── socks.conf
│   ├── table.json
│   ├── test.py
│   ├── test_command.sh
│   ├── test_daemon.sh
│   ├── test_graceful_restart.sh
│   ├── test_large_file.sh
│   ├── test_udp_src.py
│   ├── test_udp_src.sh
│   ├── workers.json
│   ├── xchacha20-ietf-poly1305.json
│   └── xchacha20.json
└── utils
    ├── README.md
    ├── autoban.py
    └── fail2ban
        └── shadowsocks.conf
```