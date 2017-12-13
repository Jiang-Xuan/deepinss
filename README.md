## Welcome to SSS

You can use the [editor on GitHub](https://github.com/Jiang-Xuan/deepinss/edit/master/README.md) to maintain and preview the content for your website in Markdown files.

Whenever you commit to this repository, GitHub Pages will run [Jekyll](https://jekyllrb.com/) to rebuild the pages in your site, from the content in your Markdown files.

### Markdown

Markdown is a lightweight and easy-to-use syntax for styling your writing. It includes conventions for

```markdown
Syntax highlighted code block

## Header 1
## Header 2
### Header 3

- Bulleted
- List

1. Numbered
2. List

**Bold** and _Italic_ and `Code` text

[Link](url) and ![Image](src)
```

For more details see [GitHub Flavored Markdown](https://guides.github.com/features/mastering-markdown/).

### Jekyll Themes

Your Pages site will use the layout and styles from the Jekyll theme you have selected in your [repository settings](https://github.com/Jiang-Xuan/deepinss/settings). The name of this theme is saved in the Jekyll `_config.yml` configuration file.

### Support or Contact

Having trouble with Pages? Check out our [documentation](https://help.github.com/categories/github-pages-basics/) or [contact support](https://github.com/contact) and we’ll help you sort it out.

### Hello, World

<ul>
  {% for post in site.posts %}
    <li>
      <a href="{{ post.url }}">{{ post.title }}</a>
    </li>
  {% endfor %}
</ul>

```shell
+-----------------------------------------------------------------------------------------------------------------------+
| +--------------+                             +--------------+                           +-----------------+           |
| |   Browser    |                             |   local.py   |                           |   server.py     |           |
| |              |                             |              |                           |                 |           |
| |              |  --------------------------------------------------- up stream ----->  |                 |           |
| |              |                                                                        |                 |           |
| |              |  <---- down stream --------------------------------------------------  |                 |           |
| |              |                             |              |                           |                 |           |
| |              |  <------- poll out  ------  |              |  <---- poll in     ----   |                 |           |
| |  Browser sk >|                             |< lsk    rsk >|                           |< sk             |           |
| |              |  -------- poll in   ----->  |              |  ----- poll out    ---->  |                 |           |
| |              |                             |              |                           |                 |           |
| +--------------+                             +--------------+                           +-----------------+           |
+-----------------------------------------------------------------------------------------------------------------------+

当本地 _local_sock 数据全部传送至 Browser, 这是属于 down stream, 数据写给浏览器之后, 等待浏览器回应, down stream 等待读(浏览器数据传送过来的时候), 如果这时候 up stream 的状态是 WAIT_READING, 说明是正常的流程下, 如果是 up stream 处于 WAIT_WRIEING 的状态下, 此时就不能读取 down stream 传送过来的数据, 因为应该传送给 server.py 的数据还没有传送完毕

# The comment of author                            #
# for each handler, we have 2 stream directions:   #
#    upstream:    from client to server direction  #
#                 read local and write to remote   # read lsk and write to rsk
#    downstream:  from server to client direction  #
#                 read remote and write to local   # read rsk and write to lsk
```
