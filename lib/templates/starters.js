/**
 * Four starter outreach templates seeded into each workspace.
 * Users can edit or delete these; they can also create more.
 */

/** @typedef {{ name: string; subject: string; bodyText: string; bodyHtml?: string }} StarterTemplate */

/** @type {StarterTemplate[]} */
export const STARTER_TEMPLATES = [
  {
    name: "Cold intro",
    subject: "Quick idea for {{company}}",
    bodyText: `Hi {{name}},

I came across your work and thought it was worth a short note.

We help teams like yours ship clearer websites and digital products without the usual agency overhead. If that's relevant right now, I'd love to share a couple of examples that might fit.

Would you be open to a brief reply if timing is better later?

Best regards`,
  },
  {
    name: "Follow-up",
    subject: "Following up — happy to keep this short",
    bodyText: `Hi {{name}},

Just bumping this in case it got buried.

Happy to send a one-pager or jump on a 15-minute call if useful. If now isn't the right time, no worries at all — feel free to point me to the right person.

Best regards`,
  },
  {
    name: "Proposal follow-up",
    subject: "Checking in on the proposal",
    bodyText: `Hi {{name}},

Wanted to check whether you had a chance to review the proposal we shared.

I'm happy to clarify scope, timeline, or pricing, or adjust anything so it fits your priorities better. What would be most helpful from here?

Best regards`,
  },
  {
    name: "Meeting request",
    subject: "15 minutes this week?",
    bodyText: `Hi {{name}},

I'd like to set up a short call to learn more about what you're focused on and see whether we can help.

Are you free for 15 minutes this week or next? I can work around your calendar — just share a couple of times that work, or a link if you prefer.

Looking forward to connecting.

Best regards`,
  },
];

/**
 * Rows ready for insert into email_templates.
 * @param {string} workspaceId
 * @param {string | null} [userId]
 */
export function starterTemplateRows(workspaceId, userId = null) {
  return STARTER_TEMPLATES.map((template) => ({
    workspace_id: workspaceId,
    created_by: userId,
    name: template.name,
    subject: template.subject,
    body_text: template.bodyText,
    body_html: template.bodyHtml || template.bodyText.replace(/\n/g, "<br>"),
    is_starter: true,
    logo_url: null,
    signature_image_url: null,
  }));
}
