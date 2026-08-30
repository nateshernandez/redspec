# @redspec/next

The spec route, the board, and the production gate for Next.js 16.

```ts
// proxy.ts
import { createSpecProxy } from "@redspec/next/gate"
export const proxy = createSpecProxy({ route: "/spec" })
export const config = { matcher: ["/spec", "/spec/:path*"] }

// app/spec/_routes.ts
import { createSpecRoutes } from "@redspec/next"
import { specs } from "../../specs"
export const {
  SpecLayout,
  SpecIndexPage,
  SpecBoardPage,
  SpecCasePage,
  generateStaticParams,
} = createSpecRoutes(specs)
```

`redspec init` writes all of it. The gate is a proxy rather than a layout `notFound()` because the latter still serializes the page — every unshipped screen and fixture — into a 404 response body.
