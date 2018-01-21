#!/usr/bin/env node

const defaultConfig = {
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
	}, {
		className: 'js-stack',
		th: 'JS Stack',
		initialEventLoopItems: [{
			textContent: 'Run script'
		}, {
			textContent: 'setTimeout callback'
		}]
	}, {
		className: 'event-loop-log',
		th: 'Log',
		initialEventLoopItems: [{
			textContent: 'Run, script'
		}, {
			textContent: 'setTimeout callback'
		}]
	}],
	eventLoopControls: true,
	eventLoopCommentary: true
}

function template(codeContent, codeType, config = defaultConfig) {
	const {
		id,
		title,
		trs,
		eventLoopControls,
		eventLoopCommentary
	} = config

	const string = `
		<div className="program-flow-walkthrough" data-panel-title="${title}" id="${id}">
			<div className="program-flow-walkthrough-codesource">
				<div className="line-highlight"></div>
				<div className="codehilite">
					{% highlight ${codeType} %}
${codeContent}
					{% endhighlight %}
				</div>
			</div>
			<table>
				${
					trs.map(tr => {
						const {
							className,
							th,
							initialEventLoopItems
						} = tr

						return `
							<tr class="${className}">
								<th>${th}</th>
								<td><div class="event-loop-items">
									<div class="event-loop-rail">
										${initialEventLoopItems.map(eventLoopItem => {
											const { textContent } = eventLoopItem
											return `
												<div class="event-loop-item">${textContent}</div>
											`.trim()
										})}
									</div>
								</div></td>
							</tr>
						`.trim()
					}).join('\n')
				}
			</table>
			${
				eventLoopControls ? `
					<div class="event-loop-controls">
					    <svg viewBox="0 0 5 2">
					      <path d="M2,0 L2,2 L0,1 z"></path>
					      <path d="M3,0 L5,1 L3,2 z"></path>
					      <path class="prev-btn" d="M0,0 H2.5V2H0z"></path>
					      <path class="next-btn" d="M2.5,0 H5V2H2.5z"></path>
					    </svg>
					</div>
				`.trim() : ''
			}
			${
				eventLoopCommentary ? `
					<div class="event-loop-commentary">
					    <div class="event-loop-commentary-item"></div>
					</div>
				`.trim() : ''
			}
		</div>
	`.trim()

	return string
}

if (require.main === module) {
	const test = template('const a = 6\nlet b = 7\nconsoel.log(\'Hello, World\')', 'javascript')

	console.log(test)
}

module.exports = template
