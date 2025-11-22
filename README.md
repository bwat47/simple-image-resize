> [!important]
> My coding knowledge is currently very limited. This plugin was created entirely with AI tools, and I may be limited in my ability to fix any issues.

> [!important]
> As of version 1.5.1, the legacy editor is no longer supported.

# Simple Image Resize

A Joplin plugin that provides a simple dialogue to switch image syntax between markdown/html and losslessly resize images by adjusting the width/height attributes.

![simple-image-resize-example](https://github.com/user-attachments/assets/72540ff9-f8bc-4f6e-b332-32b7c0b6c3b5)

## How to use

In the markdown editor, right-click anywhere inside a markdown or HTML image embed and select "Resize Image" (or put your cursor inside the image embed and use the keyboard shortcut).

This will open a simple image resize dialogue, the following options are provided.

> [!note]
> On mobile/web you can open the dialog using the toolbar icon

### Switch image syntax

You can switch the image syntax between markdown (`![alt text](:/resourceId)`) and HTML (`<img src=":/resourceId" alt="alt text" width="315" height="238" />`).

External URLs are also supported (`![alt text](https://example.com/image.png)` and `<img src="https://example.com/image.png" alt="alt text" width="315" height="238 />`).

HTML Syntax is selected by default (and resizing is only supported using HTML syntax). You can switch to markdown syntax if you want to revert the image to a standard markdown image embed without a custom size.

### Resize Image

With image syntax set to HTML, you can resize the image by Percentage (default) or Absolute size.

Enter the desired image size (in percentage or pixels) and click OK, and the plugin will automatically update the image embed with the new image syntax.

> [!note]
> The resized image will only include the width attribute (Joplin's markdown viewer, Rich text editor, and Rich markdown plugin ignore the height and always use auto-calculated height).

### Quick Resize

You can quickly resize images to 25%, 50%, 75%, or 100% (original size) using keyboard shortcuts or the right-click context menu.

### Settings

**Default resize mode** - You can choose if the default resize mode is Percentage or Absolute in the plugin settings (default is Percentage).

**HTML syntax style** - Include both width/height in HTML syntax (default, best compatibility when pasting images outside of Joplin) or width-only.

**Display quick resize options in context menu** - Show quick resize options (25%, 50%, 75%, 100%) in the right-click context menu

### Default keyboard shortcuts:

- Resize Image dialog (CmdOrCtrl+Shift+R)
- Resize 100% (CmdOrCtrl+Shift+1)
- Resize 75% (CmdOrCtrl+Shift+2)
- Resize 50% (CmdOrCtrl+Shift+3)
- Resize 25% (CmdOrCtrl+Shift+4)
