;(function() {
  function transition(el, obj, duration, easing) {
    return new Promise((resolve, reject) => {
      if (obj.transform) {
        obj['-webkit-transform'] = obj.transform
      }

      const objKeys = Object.keys(obj)

      if (duration) {
        el.style.transitionProperty = objKeys.join() // transform, opacity, ...
        el.style.transitionTimingFunction = easing // ease-in-out
        el.style.transitionDuration = `${duration}s` // .2s
        el.offsetLeft

        el.addEventListener('transitionend', function te() {
          el.style.transitionProperty = '';
          el.style.transitionTimingFunction = '';
          el.style.transitionDuration = '';
          resolve()
          el.removeEventListener('transitionend', te)
        })
      } else {
        resolve()
      }

      objKeys.forEach((key) => {
        el.style.setProperty(key, obj[key]) // transform: translateY(0px)
      })
    })
  }

  function EventLoopAnimation(el) {
    this._initialState = el
    this._states = []
    this._el = el
    this._queue = Promise.resolve()
    this._reset()
  }

  EventLoopAnimation.prototype._reset = function() {
    const newEl = this._initialState.cloneNode(true)
    this._tasksShown = 0
    this._microtasksShown = 0
    this._tasksRemoved = 0
    this._microtasksRemoved = 0
    this._logsShown = 0
    this._currentPos = 0

    this._el.parentNode.insertBefore(newEl, this._el)
    this._el.parentNode.removeChild(this._el)
    this._el = newEl
    this._taskRail = this._el.querySelector('.task-queue .event-loop-rail')
    this._microtaskRail = this._el.querySelector('.microtask-queue .event-loop-rail')
    this._jsStack = this._el.querySelector('.js-stack .event-loop-items')
    this._log = this._el.querySelector('.event-loop-log .event-loop-items')
    this._codeBar = this._el.querySelector('.line-highlight')
    this._codePane = this._el.querySelector('.codehilite')
    this._commentary = this._el.querySelector('.event-loop-commentary-item')

    /* jump-func-list */
    this._jumpFuncList = this._el.querySelector('.jump-func-list .event-loop-items')

    const onClick = (event) => {
      const className = event.target.getAttribute('class')
      if (className === 'prev-btn') {
        event.preventDefault()
        if (event.type === 'click') {
          this.back()
        }
      } else if (className === 'next-btn') {
        event.preventDefault()
        if (event.type === 'click') {
          this.forward(true)
        }
      }
    }

    this._el.addEventListener('click', onClick)
    this._el.addEventListener('mousedown', onClick)
  }

  /**
   * animate { Boolean } 是否需要动画?
   */
  EventLoopAnimation.prototype.forward = function(animate) {
    this._queue = this._queue.then(() => {
      const state = this._states[this._currentPos]
      if (!state) return this.goTo(0)
      this._currentPos++
      return Promise.all(
        state.map(function(func) {
          return func(animate)
        })
      )
    })
  }

  /**
   * pos { Number } 进入第几步
   */
  EventLoopAnimation.prototype.goTo = function(pos) {
    this._queue = this._queue.then(() => {
      this._reset()
      while (pos--) {
        this.forward(false) // 快进不需要动画
      }
    })
  }

  /**
   * 回退一步
   */
  EventLoopAnimation.prototype.back = function() {
    this._queue = this._queue.then(() => {
      if (this._currentPos === 0) {
        return this.goTo(this._states.length)
      }

      return this.goTo(this._currentPos - 1)
    })
  }

  /**
   * 创建一个状态, state
   * 在这个数组里面存储关于该步的所有展示函数
   */
  EventLoopAnimation.prototype.state = function() {
    this._states.push([])
    return this
  }

  /**
   * 添加一个 action
   * func { Function } 动作 function
   */
  EventLoopAnimation.prototype.action = function(func) {
    this._states[this._states.length - 1].push(func)

    return this
  }

  /**
   * @param  { Boolean } activated 是不是需要高亮这个 task
   * @return { this }           链式调用(return this)
   */
  EventLoopAnimation.prototype.pushTask = function(activated) {
    return this.action(function(animate) {
      const newTask = this._taskRail.children[this._tasksShown]
      this._tasksShown++

        if (activated) {
          newTask.style.backgroundColor = '#ffdf1e'
        }

      return transition(newTask, {
        opacity: 1
      }, 0.2 * animate, 'ease-in-out')
    }.bind(this))
  }

  /**
   * 显示一个 microTask
   * @return { this } 链式调用(return this)
   */
  EventLoopAnimation.prototype.pushMicrotask = function() {
    return this.action(function(animate) {
      const newTask = this._microtaskRail.children[this._microtasksShown]
      this._microtasksShown++

        return transition(newTask, {
          opacity: 1
        }, .2 * animate, 'ease-in-out')
    }.bind(this))
  }

  /**
   * 创建 jump-func-list item
   * @param { String } text 包含的文字
   * @param { URL } link 文字的跳转地址
   */
  EventLoopAnimation.prototype.pushJumpFuncList = function(text, link) {
    return this.action((animate) => {
      const div = document.createElement('div')
      let scrollHeight
      div.className = 'event-loop-item'
      if (link) {
        const a = document.createElement('a')
        a.href = link
        if (link[0] !== '#') {
          a.setAttribute('target', '_blank')
          a.textContent = text
        } else {
          a.textContent = `${text}(本页内)`
        }
        div.appendChild(a)
      } else {
        div.textContent = text
      }
      div.style.backgroundColor = '#5b5341'
      this._jumpFuncList.appendChild(div)

      if (scrollHeight = this._jumpFuncList.scrollHeight) {
        this._jumpFuncList.scrollTop = scrollHeight
      }

      return transition(div, {
        opacity: 1
      }, .2 * animate, 'ease-in-out')
    })
  }

  /**
   * 显示一个 stack
   * @param  { String } text 该栈桢的文字
   * @return { this }      链式调用(return this)
   */
  EventLoopAnimation.prototype.pushStack = function(text) {
    return this.action(function(animate) {
      const div = document.createElement('div')
      div.className = 'event-loop-item'
      div.textContent = text
      div.style.backgroundColor = '#ffdf1e'
      this._jsStack.appendChild(div)

      return transition(div, {
        opacity: 1
      }, .2 * animate, 'ease-in-out')
    }.bind(this))
  }

  /**
   * 移除一个 stack
   * @param  { String } text 这个参数并没有被用到
   * @return { this }      链式调用(return this)
   */
  EventLoopAnimation.prototype.popStack = function(text) {
    return this.action(function(animate) {
      const div = this._jsStack.children[this._jsStack.children.length - 1]
      return transition(div, {
        opacity: 0
      }, .2 * animate, 'ease-in-out').then(function() {
        this._jsStack.removeChild(div)
      }.bind(this))
    }.bind(this))
  }

  /**
   * 显示代码高亮条
   * @return { this } 链式调用(return this)
   */
  EventLoopAnimation.prototype.showCodeBar = function() {
    return this.action(function(animate) {
      return transition(this._codeBar, {
        opacity: 1
      }, .2 * animate, 'ease-in-out')
    }.bind(this))
  }

  /**
   * 隐藏代码高亮条
   * @return { this } 链式调用(return this)
   */
  EventLoopAnimation.prototype.hideCodeBar = function() {
    return this.action(function(animate) {
      return transition(this._codeBar, {
        opacity: 0
      }, .2 * animate, 'ease-in-out')
    }.bind(this))
  }

  /**
   * 显示一个 log
   * @return { this } 链式调用(return this)
   */
  EventLoopAnimation.prototype.pushLog = function() {
    return this.action(function(animate) {
      const newLog = this._log.children[this._logsShown]
      this._logsShown++

        return transition(newLog, {
          opacity: 1
        }, .2 * animate, 'ease-in-out')
    }.bind(this))
  }

  /**
   * num { Number } 移动到第几行代码
   * @return { this } 链式调用(return this)
   */
  EventLoopAnimation.prototype.moveToLine = function(num) {
    return this.action(function(animate) {
      const barHeight = this._codeBar.getBoundingClientRect().height

      return transition(this._codePane, {
        transform: `translateY(${((num - 1) * -barHeight)}px)`
      }, .3 * animate, 'ease-in-out')
    }.bind(this))
  }

  /**
   * text { String } 想要显示是提示信息
   *
   * @return { this } 链式调用(return this)
   */
  EventLoopAnimation.prototype.commentary = function(text) {
    return this.action(function(animate) {
      this._commentary.textContent = text
      return transition(this._commentary, {
        opacity: 1
      }, .2 * animate, 'ease-in-out')
    }.bind(this))
  }

  /**
   * 隐藏提示信息
   *
   * @return { this } 链式调用(return this)
   */
  EventLoopAnimation.prototype.hideCommentary = function() {
    return this.action(function(animate) {
      return transition(this._commentary, {
        opacity: 0
      }, .2 * animate, 'ease-in-out')
    }.bind(this))
  }

  EventLoopAnimation.prototype.activateMicrotask = function() {
    return this.action(function(animate) {
      this._microtasksRemoved++
      let offset
      let offsetEl = this._microtaskRail.children[this._microtasksRemoved]

      if (offsetEl) {
        offset = offsetEl.offsetLeft
      } else {
        offset = this._microtaskRail.offsetWidth
      }

      return transition(this._microtaskRail, {
        transform: `translateX(${-offset})px`
      }, .2 * animate, 'ease-in-out')
    }.bind(this))
  }

  EventLoopAnimation.prototype.activateTask = function() {
    return this.action(function(animate) {
      const div = this._taskRail.children[this._taskRemoved]

      return transition(div, {
        'background-color': '#ffdf1e'
      }, .2 * animate, 'ease-in-out')
    }.bind(this))
  }

  EventLoopAnimation.prototype.shiftTask = function() {
    return this.action(function(animate) {
      this._tasksRemoved++
      let offset
      let offsetEl = this._taskRail.children[this._tasksRemoved]

      if (offsetEl) {
        offset = offsetEl.offsetLeft
      } else {
        offset = this._taskRail.offsetWidth
      }

      return transition(this._taskRail, {
        transform: `translateX(${-offset})`
      }, .3 * animate, 'ease-in-out')
    }.bind(this))
  }

  window.EventLoopAnimation = EventLoopAnimation
})()