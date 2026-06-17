# Property Website Template

Reusable engine for premium property landing pages.

## Template files

- `index.html` is the starter shell.
- `property-template.css` is the shared visual system.
- `property-template.js` renders a property from JSON.

## Property folder shape

Each property should live in its own folder:

```text
website/properties/property-name/
  index.html
  data.json
  images/
```

The property `index.html` links to this template folder and sets:

```html
<body class="property-page" data-property-config="./data.json">
```

The `data.json` file should use image paths relative to the property folder, for example:

```json
{
  "hero": {
    "image": "images/hero.jpg"
  }
}
```
