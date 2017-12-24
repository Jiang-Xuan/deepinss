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

`kqueue()` 系统调用会创建一个新的内核级别的事件队列并且返回一个文件描述符. 如果创建内核级别的事件队列的时候出现了错误, -1 值会被返回并且设置 `errno`(Error Number).

知道了 `fd` 从哪里来, 回到 select 模块的源码, 在第 [L1600][L1600] 行.
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

## C 代码中有很多系统调用, 可以深究一下 FreeBSD 的文档

本节来自 [freebsd][man-kqueue-kevent] 的官方文档.

### NAME

```plaintext
kqueue, kevent -- kernel event notification mechanism
```

kqueue, kevent -- 内核事件通知机制

### LIBRARY

```plaintext
Standard C	Library	(libc, -lc)
```

标准的 C 库文件

### SYNOPSIS

```c
#include <sys/types.h>
#include <sys/event.h>
#include <sys/time.h>

int
kqueue(void);

int
kevent(int	kq, const struct kevent	*changelist, int nchanges,
struct	kevent *eventlist, int nevents,
const struct timespec *timeout);

EV_SET(kev, ident,	filter,	flags, fflags, data, udata);
```

### DESCRIPTION

```plaintext
The kqueue() system call provides a generic method	of notifying the user
when an event happens or a	condition holds, based on the results of small
pieces of kernel code termed filters.  A kevent is	identified by the
(ident, filter) pair; there may only be one unique	kevent per kqueue.
```

kqueue()系统调用提供一个普通的方法来通知调用者当一个事件发生或者是条件成立,
基于一小块内核代码被称为 `filter` 的结果(译者注: 基于 `filter` 过滤器过滤出来的结果, 这段代码就是过滤器). 一个 kevent 通过(ident, filter)对进行唯一标识, 每一个 kqueue 只能包含一个独特的 kqueue.(译者注: kqueue里面的所有 kevent 都不能相同)

```plaintext
The kevent() system call is used to register events with the queue, and
return any	pending	events to the user.  The changelist argument is	a
pointer to	an array of kevent structures, as defined in <sys/event.h>.
All changes contained in the changelist are applied before	any pending
events are	read from the queue.  The nchanges argument gives the size of
changelist.  The eventlist	argument is a pointer to an array of kevent
structures.  The nevents argument determines the size of eventlist.  When
nevents is	zero, kevent() will return immediately even if there is	a
timeout specified unlike select(2).  If timeout is	a non-NULL pointer, it
specifies a maximum interval to wait for an event,	which will be inter-
preted as a struct	timespec.  If timeout is a NULL	pointer, kevent()
waits indefinitely.  To effect a poll, the	timeout	argument should	be
non-NULL, pointing	to a zero-valued timespec structure.  The same array
may be used for the changelist and	eventlist.
```

kevent() 系统调用时用来注册在队列中的事件, 并且返回 `pending` 事件给调用者. `changelist` 参数是一个指针, 指向一个数组, 数组里是 kevent 结构体, 定义在 `<sys/event.h>` 中. 在从队列中读取任何挂起的事件之前, 所有包含在 changelist 中的改变会被应用. `nchanges` 参数表明 `changelist` 的 size. `eventlist` 参数是一个指针, 指向一个数组, 数组里面是 kevent 结构体. `nevents` 参数表明 `eventlist` 的 size. 当 `nevents` 是0, kevent() 调用将会立即返回, 即使有 timeout 被指定(unlike select(2)). 如果 timeout 是一个 non-NULL 指针, 它指定一个去等待事件的最大的时间间隔, 它将被解释为 一个 timespec 结构体. 如果 timeout 是一个 NULL 指针, kevent 无限期的等待. 去影响一个轮询, timeout 参数应该是 non-NULL或者是指向一个 zero-valued 的 timespec 结构体. 相同的数组可以用在 `changelist` 和 `eventlist`.

```plaintext
The kevent	structure is defined as:

struct kevent {
    uintptr_t ident;	     /*	identifier for this event */
    short     filter;	     /*	filter for event */
    u_short   flags;	     /*	action flags for kqueue	*/
    u_int     fflags;	     /*	filter flag value */
    intptr_t  data;	     /*	filter data value */
    void      *udata;	     /*	opaque user data identifier */
};
```

## Notes

1. C 语言中, 结构体和函数可以同名, 所以 `struct kevent` 和 `kevent(...)` 调用是两个不同的事情, 这两个 `kevent` 不同!!!

## 总结

control 就是 C 库函数 `kevent` 的变体, 注意这里的 `kevent` 不是结构体, 而是函数, 在 Notes 中说明了这点, 之前我没有理解这一点, 我一直以为 `kevent` 结构体和 `kevent` 函数是同一个, 所以导致了很多困惑. 在 Python 中 `select.kevent` 指向了 `kevent` 结构体, Python 语言的开发者应该是想让 C 中的 `kevent` 这个函数能更好的说明是来控制 `kqueue` 内核事件队列的, 所以把这个函数放在了 `kqueue` 下面, 并命名为 `control`, 所以官方文档说这是 `kevent` 的底层接口, 这个 `kevent` 指的就是 C 中的 `kevent` 函数, 而非结构体. 如果你之前懂得 C 中的 `kevent`, `kqueue`, 你应该能理解, 但是对于没有 C 经验的我, 读源码的过程也是收获很多:).

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
[man-kqueue-kevent]: <https://www.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2>