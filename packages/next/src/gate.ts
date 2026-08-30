import { NextResponse, type NextRequest } from "next/server"

/**
 * The production gate, run before anything renders.
 *
 * A `notFound()` in a layout sets the status to 404 and still streams the page
 * segment into the RSC payload -- every unshipped screen, every waiver, every
 * fixture -- to anyone who ignores a status line. A proxy answers before the
 * render exists.
 */
export function createSpecProxy({ route = "/spec" }: { route?: string } = {}) {
  return function specProxy(request: NextRequest) {
    if (
      process.env.NODE_ENV === "production" &&
      (request.nextUrl.pathname === route ||
        request.nextUrl.pathname.startsWith(route + "/"))
    ) {
      return new NextResponse(null, { status: 404 })
    }
    return NextResponse.next()
  }
}
