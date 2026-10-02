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
