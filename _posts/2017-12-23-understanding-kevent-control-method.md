---
title: '透过 C 源码🔧深入理解 python 的 select.kqueue.control 方法'
---

# 透过 C 源码🔧深入理解 python 的 kqueue.control 方法

## 我们来看一下官方文档对于该方法的介绍

> kqueue.control(changelist, max_events[, timeout=None]) → eventlist
>
> Low level interface to kevent
> 
> changelist must be an iterable of kevent object or None
>
> max_events must be 0 or a positive integer
>
> timeout in seconds (floats possible)
>
> 引至: [Python-kqueue-control][Python-kqueue-control]

很可惜, 官方文档提供的很有限, 只是说这是一个 `kevent` 的底层接口, 没有了其他的介绍. 对于不熟悉系统级别编程的人理解有点难度, 所以我们只能通过看源码理解原理.

select 模块不是 python 代码, 而是 C 代码, 在 `help(select)` 里面的地址看到的是一个后缀为 `.so` 的文件.

找到了 Github 上面 python 的官方源码, [这里][c-source], 不详细的解释细节, 只看我们需要的.

*我虽不懂 C, 但是代码可以表露出很多意图*

第 [L1733][L1733] 行, 我们可以看到 Kqueue 暴露出来的接口, 对应于[官方文档的接口][official-doc-api]. 
```c
static PyMethodDef kqueue_queue_methods[] = {
    {"fromfd",          (PyCFunction)kqueue_queue_fromfd,
     METH_VARARGS | METH_CLASS, kqueue_queue_fromfd_doc},
    {"close",           (PyCFunction)kqueue_queue_close,        METH_NOARGS,
     kqueue_queue_close_doc},
    {"fileno",          (PyCFunction)kqueue_queue_fileno,       METH_NOARGS,
     kqueue_queue_fileno_doc},
    {"control",         (PyCFunction)kqueue_queue_control,
     METH_VARARGS ,     kqueue_queue_control_doc},
    {NULL,      NULL},
};
```

能看到 `control` 方法对应着内部的 `kqueue_queue_control` 方法. 来看第 [L1581][L1581] 行, 这里定义着 `kqueue_queue_control` 内部方法.
```c
static PyObject *
kqueue_queue_control(kqueue_queue_Object *self, PyObject *args)
{
 ...
}
```

这里的参数

1. `kqueue_queue_Object *self` 对应着调用者, 也就是 `self._kqueue.control` 里面的 `self._kqueue`
2. `PyObject *args` 对应着我们传递进去的参数, 也就是 `self._kqueue.control([e], 0)` 里面的 `([e], 0)`

在第 [L1597][L1597] 行.
```c
if (self->kqfd < 0)
    return kqueue_queue_err_closed();
```

如果 `self->kqfd` 小于零, 说明该 kqueue 不存在, 会抛出错误, self 是一个 `kqueue_queue_Object` 结构体, 来看第 [L1213][L1213] 行.
```c
typedef struct {
    PyObject_HEAD
    SOCKET kqfd;                /* kqueue control fd */
} kqueue_queue_Object;
```

看到代码里面的注释说明 `self->kqfd` 代表的是 `kqueue control fd` , 来看一下这个 `fd` 从哪里来, [这里][kqueue-return-value], 在 `RETURN_VALUES` 节可以看到这一段描述.
```plaintext
The kqueue() system call creates a	new kernel event queue and returns a
     file descriptor.  If there	was an error creating the kernel event queue,
     a value of	-1 is returned and errno set.
``` 

`kqueue()` 系统调用会创建一个新的内核级别的事件队列并且返回一个文件描述符. 如果创建内核级别的事件队列的时候出现了错误, -1 值会被返回并且设置 `errno`(Error Number)

知道了 `fd` 从哪里来, 回到 select 模块的源码, 在第 [L1600][L1600] 行,
```c
if (!PyArg_ParseTuple(args, "Oi|O:control", &ch, &nevents, &otimeout))
        return NULL;
```

解析我们传递过去的参数

1. 第一个参数是监听的列表, 里面必须是 `select.kevent`
2. 第二个参数是 获取的最大的事件数
3. 超时时间, 如果超过这个事件还没有事件发生, 则返回空 list

紧接着的代码.
```c
if (nevents < 0) {
    PyErr_Format(PyExc_ValueError,
        "Length of eventlist must be 0 or positive, got %d",
        nevents);
    return NULL;
}
```

检查 `nevents` 是否合法

接下来的 `if else if else` 结构也是在检查 `nevents` 参数是否合法

接下来的代码.
```c
if (ch != NULL && ch != Py_None) {
    seq = PySequence_Fast(ch, "changelist is not iterable");
    if (seq == NULL) {
        return NULL;
    }
    if (PySequence_Fast_GET_SIZE(seq) > INT_MAX) {
        PyErr_SetString(PyExc_OverflowError,
                        "changelist is too long");
        goto error;
    }
    nchanges = (int)PySequence_Fast_GET_SIZE(seq);

    chl = PyMem_New(struct kevent, nchanges);
    if (chl == NULL) {
        PyErr_NoMemory();
        goto error;
    }
    for (i = 0; i < nchanges; ++i) {
        ei = PySequence_Fast_GET_ITEM(seq, i);
        if (!kqueue_event_Check(ei)) {
            PyErr_SetString(PyExc_TypeError,
                "changelist must be an iterable of "
                "select.kevent objects");
            goto error;
        }
        chl[i] = ((kqueue_event_Object *)ei)->e;
    }
    Py_CLEAR(seq);
}
```

1. 检查我们的 `ch` 既不是 `NULL` 也不是 `Py_None`, 说明我们有事件需要监听
* `seq = PySequence_Fast(ch, "changelist is not iterable");` 会转换 ch 为 c 列表
* `nchanges = (int)PySequence_Fast_GET_SIZE(seq);` 获取我们传递过去的 `list` 的长度
* `chl = PyMem_New(struct kevent, nchanges);` 根据 nchanges 创建 `struct kevent` 结构体, 这应该是一个数组
* `if (chl == NULL) { ... } ` 如果创建失败, 抛出错误

2. 看一下这里面的逻辑 `for (i = 0; i < nchanges; ++i) { ... }`
* `ei = PySequence_Fast_GET_ITEM(seq, i);` 获取 `seq` 里面的 一个 `kevent`
* `if (!kqueue_event_Check(ei)) { ... }` 检查是不是 `kevent` 如果不是, 抛出错误
* `chl[i] = ((kqueue_event_Object *)ei)->e;` 获取 `kqueue_event_Object` 里面存储的 `kevent` 结构体, `kqueue_event_Object` 这个不是原生的 `kevent` 结构体, 而是把 `kevent` 封装了一层
* 循环结束之后, `chl` 数组变量里面储存了我们传递过去的 `kevent`

3. `if (nevents) { ... }` 要取出来多少事件, 在这里创建 `evl` 存放事件结果的数组, 如果创建出错, 抛出错误

4. `gotevents = kevent(self->kqfd, chl, nchanges, evl, nevents, ptimeoutspec);` 调用 C 库函数 `kevent`

5. `if (gotevents == -1) { ... }` 调用出错, 抛出错误

6. `result = PyList_New(gotevents);` 根据获取的事件结果创建 Python 数据结构 list

7. `for (i = 0; i < gotevents; i++) { ... }` 创建 `kqueue_event_Object` 填充 result

8. `PyMem_Free(chl);` 释放 chl 内存

9. `PyMem_Free(evl);` 释放 evl 内存

10. `return result;` 返回 result, 也就是我们调用 control 之后拿到的 list, 里面存放着 `kqueue_event_Object` 结构体

## Notes

1. C 语言中, 结构体和函数可以同名, 所以 `struct kevent` 和 `kevent(...)` 调用是两个不同的事情, 这两个 `kevent` 不同!!!

## 导航

[prev][]

[next][]

[L1213]: <https://github.com/python/cpython/blob/2.7/Modules/selectmodule.c#L1213>
[L1581]: <https://github.com/python/cpython/blob/2.7/Modules/selectmodule.c#L1581>
[L1597]: <https://github.com/python/cpython/blob/2.7/Modules/selectmodule.c#L1597>
[L1600]: <https://github.com/python/cpython/blob/2.7/Modules/selectmodule.c#L1600>
[L1733]: <https://github.com/python/cpython/blob/2.7/Modules/selectmodule.c#L1733>
[c-source]: <https://github.com/python/cpython/blob/2.7/Modules/selectmodule.c>
[official-doc-api]: <https://docs.python.org/2.7/library/select.html#kqueue-objects>
[kqueue-return-value]: <https://www.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2>
[Python-kqueue-control]: <https://docs.python.org/2.7/library/select.html#select.kqueue.control>