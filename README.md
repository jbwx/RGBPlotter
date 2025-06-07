# RGB Plotter

[jacobwestra.com/RGBPlotter](https://jacobwestra.com/RGBPlotter)

Graph any (x,y) -> (r,g,b) function on 1000x1000 pixels. In javascript.

Share the code via URL, or download as PNG.

## Use

Use any javascript expression in the box, as long as r, g, and b ultimately get assigned.

Example:

```javascript
r = (x / 4); // gradient
g = (y / 4); // gradient
b = 100 + sin(x / 50 + PI) * 50 + cos(y / 30 + PI) * 50; // cool blue pattern
```

## Todo

-  [ ] Expandable/custom canvas size
-  [ ] LaTeX support
-  [ ] T value, which can be used to generate multiple frames / animations
