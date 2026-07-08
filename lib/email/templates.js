/**
 * @param {string} bodyHtml
 */
export function wrapEmailHtml(bodyHtml) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 600px; margin: 0 auto; padding: 24px;">
    ${bodyHtml}
  </body>
</html>`;
}
