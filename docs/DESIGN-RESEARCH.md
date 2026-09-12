# OpsStudio design refinement

Reference review: 13 September 2026. These are deliberately selected examples of strong craft, not a claim of a universal website ranking. Public pages were inspected in a browser; all OpsStudio artwork remains original.

## What the references contribute

| Reference                                                                                                               | Observed strength                                                                                                                                | Application to OpsStudio                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Linear](https://linear.app/) and its [2026 interface refresh](https://linear.app/now/behind-the-latest-design-refresh) | Quiet navigation, predictable placement of actions, restrained separators, and a clear distinction between orientation and work.                 | Reduce the selected-navigation block, soften redundant borders, give the architecture and current mission priority, and place the mission action before the canvas.                                  |
| [Stripe Payments](https://stripe.com/payments)                                                                          | The product illustration explains a concrete transaction alongside readable copy and an immediately visible action.                              | Give the project illustration explicit, inspectable request stages and keep the current mission button visible on a typical laptop.                                                                  |
| [Vercel Geist typography](https://vercel.com/geist/typography)                                                          | Text sizes, line height, spacing, and weight form named roles rather than isolated choices. Interactive examples connect the rules to their use. | Retain Barlow Condensed and IBM Plex, establish a consistent utility/body/display hierarchy, and replace tiny low-contrast functional labels.                                                        |
| [Work Louder](https://worklouder.cc/)                                                                                   | A tactile object leads the composition. Product material, lighting, and depth establish identity while navigation recedes.                       | Refine the original isometric model with physical selection feedback and a controlled inspection layer. Keep OpsStudio's quiet palette rather than importing the reference's saturated campaign art. |

## Critique of the current workspace

The new identity is recognizable, but the heading and illustration push the mission action toward the bottom of a 720px-tall laptop viewport. Many functional labels are only 7–9px. Several competing divider systems make the page look more boxed-in than it needs to. The architecture offers a replay, but it cannot be paused and lacks an obvious step-by-step control. The studio's main execution action is below the full diagram, which makes the learning loop harder to find.

## Refinement plan

Keep the copper server, olive ink, paper background, condensed display face, and numbered chapter sequence. Use warm paper #f5f4ee, ink #263029, copper #ad4d30, sage #8b9b77, chalk #fffdf7, and quiet line #d9ddd0. Copper remains the action color. The large display type is limited to the project identity and page titles; body text and controls use IBM Plex Sans, with IBM Plex Mono reserved for actual labels and numbers.

The overview uses a compact masthead followed by the original architectural model and a current-mission sheet. Below it, progress and five chapter rows provide a quieter second reading level. Each chapter displays its four actual mission states. The model's inspection controls expose the four real components of the teaching model, with pause, resume, and replay. The workbench puts its execution action in the mission bar, retains the explanatory brief, and uses the same action label in both places.

The signature remains the claims platform model. The refinement adds readable control states, small physical movement on selection, and a guided request trail. It does not add unrelated ambient motion or externally generated artwork.

## Evaluation

Verify desktop and narrow mobile layouts, action visibility, readable supporting text, focus states, reduced-motion CSS, model pause/resume/step selection, mission execution, evidence, and absence of horizontal overflow. Re-run existing checks and the production build. No Gemini requests are needed for this design work.

## Implemented and checked

- Preserved the original palette, custom server illustration, and display fonts; refined contrast, spacing, line treatments, and control shape.
- Moved the request player's controls into the architecture header. Added pause/resume/restart, four directly selectable components, state-aware badges, and a request path that stops at an unavailable claims service.
- Added a run action to the mission bar without changing the simulation engine or charging for an AI request.
- Put the current mission before the illustration on mobile, with a shorter summary and an immediately available action. Desktop keeps the diagram and mission side by side.
- Added four progress marks per chapter, reflecting actual completion state.
- Consolidated 59 superseded CSS declarations instead of retaining conflicting copies.
- Browser checks at 1280×720 and 390×844 found no horizontal document overflow. On the tested second mission, the overview action ended at approximately 602px on desktop and 615px on mobile. The workbench action ended at approximately 253px on desktop and 331px on mobile.
- Verified model pause/resume, completion and direct component inspection. Verified the new mission-bar action produces the existing commit evidence. TypeScript, ESLint, and all eight tests passed.
