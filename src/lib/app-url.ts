/** Public origin for redirects. Do not use req.url behind Docker —
 *  Next.js standalone treats HOSTNAME=0.0.0.0 as the request host. */
export function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL || "https://wholesale.theperfectpart.net"
  );
}

export function appUrl(path: string): URL {
  return new URL(path, appOrigin());
}
