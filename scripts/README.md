* 代码块

* tr 数据

```javascript
{
    id: 'test',
    title: '程序流控制面板',
    trs: [{
        className: 'task-queue',
        th: 'Task',
        initialEventLoopItems: [{
            textContent: 'Run script'
        }, {
            textContent: 'setTimeout callback'
        }]
    }, {
        className: 'microtask-queue',
        th: 'Microtasks',
        initialEventLoopItems: [{
            textContent: 'Run script'
        }, {
            textContent: 'setTimeout callback'
        }]
    }],
}
```