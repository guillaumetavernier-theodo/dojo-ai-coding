The ticket's section of the feature's pull request. Keep its shape: the heading, then each paragraph in this order. The words are yours.

```markdown
### <ticket> · <the ticket's title, as the tickets table on top of the description names it>

<What the ticket does, and why, in one to three sentences.> Ticket: `<the path of the ticket's file>`.

**Tested:** <the tests that prove it, by kind and by what they cover>.

**Left from the review:** <the findings left unfixed, then each reviewer that reviewed fewer files than it was given, named as a gap in the review>.

| Lens | Rank | Cause | Action | Cost | Change | Trade-off | Expected gain | Watch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <failures or usage> | <🔴 major, 🟡 minor, or — for a cause already fixed> | `<id>` | <✅ changed, 📝 issue, ➕ #<number> or ⚪ none> | <cost> | <change> | <tradeoff, or —> | <expectedGain, or —> | <watch, or —> |

🔴 major · 🟡 minor · — fixed already · ✅ changed in the overlay · 📝 new issue drafted · ➕ addition drafted to the description of issue #<number> · ⚪ no action

**Drafted issues:** <each new issue's title and each addition's #<number>, with the `optimise.json` files that hold its body or addition>. A human files them.
```

Leave out the review paragraph when the review left nothing. The table, its legend and the drafted issues come only after a step that ran the `optimise` skill: one row per entry of its handoff's `causes`, in their order, each cell a few words; leave out the drafted issues when none is drafted.
