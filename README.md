> [!important]
> My coding knowledge is currently very limited. This plugin was created entirely with AI tools, and I may be limited in my ability to fix any issues.

# Simple Image Resize

A Joplin plugin that provides a simple dialogue to switch image syntax between markdown/html and losslessly resize images by adjusting the width/height attributes.

![resize-example](https://github.com/user-attachments/assets/5fee085e-a9f3-4c77-9693-fa199e7d55f1)


## How to use

In the markdown editor, highlight the text for an image embed, and then right click | Resize Image.

This will open a simple image resize dialogue, the following options are provided.

### Switch image syntax

You can switch the image syntax between markdown (`![alt text](:/resourceId)`) and HTML (`<img src=":/resourceId" alt="alt text" width="315" height="238" />`).

HTML Syntax is selected by default (and resizing is only supported using HTML syntax). You can switch to markdown syntax if you want to revert the image to a standard markdown image embed without a custom size.

### Resize Image

With image syntax set to HTML, you can resize the image by Percentage (default) or Absolute size.

Enter the desired image size (in percentage or pixels) and click OK, and the plugin will populate the clipboard with the new image syntax (HTML syntax with the specified width/height). You can then paste to overwrite the original image embed with the new one.

> [!note]
> When using absolute size, populating one of the dimensions and leaving the other blank will automatically maintain aspect ratio.

### Other notes

- The plugin only works if it finds a complete image embed in the highlighted text.
- The plugin will not work if more than one image embed is found in the highlighted text (you will see a toast message that multiple images are selected).
