# Upload Proxy Limits

GTV accepts documents and photos up to 5 MB each. The application reads request bodies as a stream and rejects multipart requests above 5 MB plus 64 KB of multipart overhead. Reverse proxies should reject larger bodies before forwarding them.

## Nginx

Set `client_max_body_size 5184k;` in the `http`, `server`, or GTV `location` block. Keep proxy buffering enabled unless your deployment has a tested streaming configuration. Return the default HTTP 413 response or map it to a short JSON error at the edge.

## Apache

Set `LimitRequestBody 5308416` for the GTV virtual host or upload route. Confirm that any upstream WAF uses the same or a slightly larger limit so Apache remains the first component to reject the request.

## Cloudflare

Cloudflare plan limits are much larger than GTV's application limit. Add a WAF custom rule for upload paths when early rejection is required, or rely on the origin proxy limit. Do not raise GTV's 5 MB file limit merely to match the Cloudflare account limit.

## Other Reverse Proxies

Configure a maximum request body of 5,308,416 bytes on `/api/trips/*/media/*`. Preserve HTTP 413 responses and avoid middleware that buffers unlimited request bodies. Monitor rejected-body counts and proxy memory during load tests. Keep the proxy allowance aligned with `UPLOAD_REQUEST_SIZE_LIMIT` in `src/lib/platform.ts`.
