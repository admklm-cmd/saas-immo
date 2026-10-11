# Third-party notices

This product includes code adapted from third-party projects. Their copyright
and permission notices are reproduced below, as their licences require.

## React Bits — TechText

- Source: https://github.com/DavidHDev/react-bits (https://reactbits.dev),
  component `src/content/TextAnimations/TechText`.
- Adapted in: `components/ui/tech-accent/` (`TechAccent.tsx`,
  `TechAccent.module.css`, `tech-accent.ts`, `paint-tech-accent.ts`,
  `tech-accent-engine.ts`). Re-implemented without `motion`, restyled to the
  product's art direction.
- Scope of use: decorative effect of one word of a title of the agency
  website (« décide », control section of the home page). The adapted
  component is never sold, sublicensed or redistributed on its own, in a
  bundle or as a ported version (Commons Clause below).

Licence text, reproduced verbatim (retrieved 2026-10-01 from `LICENSE.md` on
the `main` branch):

```
MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## React Bits — TrueFocus (idea only)

The "focus" effect of the accented title word (`components/ui/EditorialTitle.module.css`)
takes the idea of React Bits' TrueFocus (blur on the rest, four-corner frame).
It is an independent CSS implementation (gradient corners, no `motion`, no
code reused), credited here as a courtesy.

## anime.js

- Source: https://github.com/juliangarnier/anime (https://animejs.com), npm
  package `animejs`, version 4.5.0 (pinned, no range).
- Used in: `components/landing/roi/**` only (number counting and arrival
  sequences of the ROI widgets of the home page). No other file imports it.
- Licence: MIT, reproduced below as shipped in the package (`LICENSE.md`).

```
The MIT License

Copyright (c) 2025 Julian Garnier

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Bklit UI (area chart, funnel chart)

- Source: https://ui.bklit.com (https://github.com/bklit/bklit-ui), shadcn registry
  items `@bklit/area-chart` and `@bklit/funnel-chart` with their registry dependencies
  (chart-context, chart-animation, chart-series, grid, x-axis, chart-tooltip,
  shimmering-text, utils, chart-utils), retrieved 2026-10-11.
- Copied into: `components/charts/bklit/`. Changes: the two imports of `@/lib/utils` and
  `../components/shimmering-text` now point to local files (`cn.ts`, `shimmering-text.tsx`);
  `chart-formatters.ts` (date and number formatters) is switched from `en-US` to `fr-FR` / Europe/Paris;
  nothing else is edited. Excluded from the project lint (see `eslint.config.mjs`).
- Licence: MIT, reproduced verbatim.

```
MIT License

Copyright (c) 2026 uixmat

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## visx (curve, shape, event, responsive, scale, grid) 4.0.0

- Source: https://github.com/airbnb/visx, npm packages `@visx/curve`, `@visx/shape`,
  `@visx/event`, `@visx/responsive`, `@visx/scale`, `@visx/grid` (pinned 4.0.0).
- Used by: `components/charts/bklit/**`.
- Licence: MIT, as shipped in the packages (`LICENSE`).

```
MIT License

Copyright (c) 2017-2018 Harrison Shoff

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Motion (`motion`) 14.1.0

- Source: https://motion.dev (https://github.com/motiondivision/motion), npm package `motion`
  (pinned 14.1.0).
- Used by: `components/charts/bklit/**` (draw and hover animation internal to the charts).
- Licence: MIT, as shipped in the package (`LICENSE.md`).

```
The MIT License (MIT)

Copyright (c) 2024 [Motion](https://motion.dev) B.V.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## d3-array 3.2.4, d3-shape 3.2.0, clsx 2.1.1, tailwind-merge 3.7.0

Used by `components/charts/bklit/**`. Licences as shipped in each package: d3-array and
d3-shape are ISC (Copyright Mike Bostock), clsx is MIT (Copyright Luke Edwards),
tailwind-merge is MIT (Copyright 2021 Dany Castillo). The full texts are in the
`LICENSE` files of the corresponding packages in `node_modules`.
