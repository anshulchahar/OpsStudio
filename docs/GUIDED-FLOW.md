# Guided mission flow

Refinement: 13 September 2026.

## Learner experience

The overview recommends the earliest unfinished mission. Its single primary action opens that mission. The system illustration is a preview; it no longer offers a competing request action.

Each mission has three stages in the same action panel:

1. **Make a change.** Read the situation and use one action button. The simulated system highlights affected components during execution.
2. **See the result.** Evidence appears automatically beside the system map. Continue with “Make your decision.”
3. **Make a decision.** Choose an explanation of the result. Incorrect choices give another hint without a penalty. A correct choice reveals the explanation, the reward, and the next mission.

Free authored hints appear next to the current action. Ada’s existing Gemini interface and component inspector open on demand. Code excerpts, request probes, experiments, checkpoints, and the two existing real verification recipes remain available under Explore tools. Advanced execution still uses the existing simulation engine; this update does not add real infrastructure recipes.

## Progress and rewards

- 100 XP for each unique, recognized completed mission.
- Six learning ranks, advancing every four completed missions.
- Five chapter badges, each requiring all four missions in that chapter.
- Completed missions remain available for practice. Replays, hints, experiments, and real labs do not award extra XP.
- Later missions explain the earlier mission to finish first. Search, the mission picker, and the mission path use the same unlock rule.
- Existing completion records immediately receive the corresponding rewards. XP is derived from saved completions, with no database migration.
- Completed missions and rewards survive refresh; an unfinished mission restarts at its change step after refresh.

Actions wait for saved progress to load. Changing missions resets transient execution state, and leaving a mission cancels its animation before state changes can be applied. Stage transitions move focus to the new heading; advancing missions brings the next brief into view. Reduced-motion preferences suppress reward particles.

## Verification

- `npm run check`: type checking, ESLint, and 15 tests passed.
- `npm run build`: production build passed.
- Added seven focused tests covering duplicate and unknown mission IDs, gaps, badge eligibility, full completion, unlock boundaries, and immutable inputs.
- Browser checked the desktop and 390px mobile layouts for overview, workbench, and mission path, with no horizontal overflow.
- Walked action → evidence → incorrect decision → free hint → correct decision → reward → next mission.
- Confirmed a replay leaves XP unchanged, completion survives reload, and completing the first chapter earns its badge and Level 2.
- Confirmed optional guide and Explore tools open correctly. No Gemini generations or metered sandbox runs were needed.
