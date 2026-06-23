# Chat visual polish: reading-room theme

Date: 2026-06-23
Branch: `feat/chat-visual-polish`
Time since implementation: under an hour (theme built and committed `3930998` the same session).

## Summary

A purely aesthetic pass over the chat UI. No behavior, data flow, or API change.
Gives the research chatbot a distinct visual identity (a "reading room / research
desk"), a cohesive color scheme, entrance motion on chat bubbles, and a centered
reading-width column with a sticky composer.

## What changed

- `src/app/globals.scss`: a design-token system in `:root` (palette + type roles),
  a cool paper page background with a faint radial wash, base ink color and font.
- `src/components/Chat/Chat.module.scss` and `Chat.tsx`: centered 45rem column; a
  masthead (mono eyebrow, serif title, tagline); an empty-state invitation; a
  sticky bottom composer with a styled input, focus ring, and accent Send button.
- `src/components/Message/Message.module.scss`: indigo right-aligned reader bubbles,
  white left-aligned dossier cards with a soft shadow, a serif reading face for the
  assistant body, and a rise-and-fade entrance animation.
- `src/components/ToolStep/ToolStep.module.scss` and `ToolStep.tsx`: the "catalog
  trail" signature: a hairline rail with a node per source that pulses while
  searching and fills solid red once the source lands. A `running`/`done` class is
  toggled from the existing `step.summary` state.

Only styles plus two additive JSX changes (a masthead/empty-state, and a state
class on the tool step). The DOM the Chat test relies on (labelled input, Send
button, message text) is unchanged.

## Architectural decisions

- **Design tokens as CSS custom properties in `:root`** (chosen) vs per-module SCSS
  variables (alternative). Why: one shared palette and type scale across all
  modules, runtime-themeable, and it matches the project styling convention.
- **System font stacks** (chosen) vs `next/font` web fonts (alternative). Why: this
  is a quick pass; system stacks add zero network/infra and no layout shift. Cost:
  less type uniqueness, mitigated by separating three roles (ui sans, reading serif,
  mono trail).
- **Serif for the assistant body only** (chosen) vs a serif display hero
  (alternative). Why: gives the dossier a "reading" feel and a clear contrast with
  the UI, without the cream-background + serif-display look that reads as
  AI-generated.
- **Manuscript-red accent on a cool indigo/paper base** (chosen) vs the common AI
  defaults (cream + terracotta, near-black + acid-green, broadsheet). Why: grounded
  in the subject (an archive / reference desk) and deliberately off the defaults.
- **Tool-step state via a class toggle** (chosen) vs a data attribute or extra
  prop. Why: simplest path using the `summary === null` signal that already exists.

## Testing

- `npx tsc --noEmit`: clean.
- `npm test`: full suite still 39/39 (styling does not change behavior); the Chat
  component test passes against the unchanged accessible queries (label + role).
- `npm run lint`: clean.
- `npm run build`: Next.js production build succeeds.
- No new tests added: this is pure pixel/color/motion work with no behavioral
  component (the project's stated exception to test-first). Accessibility floor
  kept: one `<h1>`, labelled input, AA-contrast palette, visible focus rings, and
  `prefers-reduced-motion: reduce` disables all animation.

## Reflection

What I understand now: the previous assistant bubble was literally the AI-default
cream (`#f4f1ea`), so the "make it pleasant" ask was really "give it an identity."
Anchoring the palette and the tool-trail to the subject (a reference desk) did more
for distinctiveness than any single color choice.

What I got wrong first: I considered a warm amber accent, which sits too close to
the terracotta AI-default; switched to a manuscript red that reads archival against
the indigo. I also had to confirm the new empty-state copy (which mentions
"Anthropic") would not collide with the Chat test's `getByText('Tell me about
Anthropic')` assertion; it does not, because the strings differ and the empty state
is removed once a message is sent.
