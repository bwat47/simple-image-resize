> [!important]
> My coding knowledge is currently very limited. This plugin was created entirely with AI tools, and I may be limited in my ability to fix any issues.

# Simple Image Resize

A Joplin plugin that provides a simple dialogue to switch image syntax between markdown/html and losslessly resize images by adjusting the width/height attributes.

![simple-image-resize-example](https://github.com/user-attachments/assets/72540ff9-f8bc-4f6e-b332-32b7c0b6c3b5)


## How to use

In the markdown editor, right click anywhere inside a markdown or HTML image embed and select "Resize Image".

Alternately, you can highlight the entire image embed and select Edit | Resize Image (or use the keyboard shortcut if bound).

This will open a simple image resize dialogue, the following options are provided.

### Switch image syntax

You can switch the image syntax between markdown (`![alt text](:/resourceId)`) and HTML (`<img src=":/resourceId" alt="alt text" width="315" height="238" />`).

External URLs are also supported (`![alt text](https://example.com/image.png)` and `<img src="https://example.com/image.png" alt="alt text" width="315" height="238 />`).

HTML Syntax is selected by default (and resizing is only supported using HTML syntax). You can switch to markdown syntax if you want to revert the image to a standard markdown image embed without a custom size.

### Resize Image

With image syntax set to HTML, you can resize the image by Percentage (default) or Absolute size.

Enter the desired image size (in percentage or pixels) and click OK, and the plugin will automatically update the image embed with the new image syntax.

> [!note]
> When using absolute size, populating one of the dimensions and leaving the other blank will automatically maintain aspect ratio.

### Settings

You can choose if the default resize mode is Percentage or Absolute in the plugin settings (default is Percentage).
