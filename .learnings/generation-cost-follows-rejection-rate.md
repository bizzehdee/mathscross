# Generation cost follows the rejection rate, not the grade's difficulty

Established in the Sudoku project, 2026-08-25, by measurement. Copied here for the
transferable conclusion and the cap mistake it caused. **The numbers below are that
project's and do not transfer**; MathsCross measures its own at M2.

## The transferable conclusion

For a seeded generate-and-check generator, an attempt costs roughly a constant.
Total cost is therefore almost entirely a function of **how many candidate seeds
are rejected before one qualifies** — that is, how narrow the acceptance band for
that difficulty is.

The counter-intuitive consequence: **the hardest grade is not necessarily the
slowest to generate.** In the Sudoku project the hardest grade was the second
*cheapest*, because its definition accepted almost any seed, while the
second-hardest was by far the most expensive, because its definition required
landing in a narrow band between two other grades.

So when a difficulty is slow, suspect its acceptance band before suspecting the
code.

## The cap mistake, which is the reason to read this

That project's plan set a 500-attempt cap and described it as a runaway guard
indicating a grading defect. Measurement over only 30 seeds found a worst case of
331 attempts, which put 500 **inside the normal operating range**. The cap would
have rejected legitimate seeds and reported a defect that did not exist. It was
raised to 5000.

MathsCross starts at 5000 for this reason, not by analogy.

## The reference figures, for calibration only

That project measured, over 30 seeds per grade, roughly 3 ms per attempt, and for
its most expensive grade a median of 77 attempts, 279 ms median and 1141 ms worst.

A MathsCross attempt must cost more than 3 ms: it spans mesh search, operand width
assignment, a value fill, and a uniqueness check per masking step, and multi-cell
numbers enlarge the variable count because a three-digit result is three variables
rather than one. Treat the figures above as an order of magnitude and a shape, not
a target.

## A second finding that transfers

That project's hole-digging stopped as soon as it reached the floor of its target
clue range, so every puzzle sat at the floor and clue count carried no variety.
Expect the same from a masking loop that stops at its target: the target becomes
the outcome. If varied mask density is ever wanted, the stopping rule is what to
change, not the grading.

## Where this applies again

Before changing the attempt cap, before concluding a difficulty is slow because of
the code, and when writing `.learnings/generation-measurements.md` at M2 with
MathsCross's own numbers.
