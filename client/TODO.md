# TODO - Review and Relearn (Daily Relearning)

## Step 1: Add a new “Review and Relearn” mode to StructuredActivity
- Extend `StructuredActivity` with a prop/state that triggers a review phase after completing the last letter of the current day.
- While in review mode:
  - Show instruction text: `Tingnan ang larawan at bilugan kung anong titik ang may unang tunog sa larawang ito`
  - Use **Look & Circle** mechanics (circle cards) like existing `mode="independent"`.
  - Restrict choices and images to the **letters unlocked for that day**, not the entire unlocked set.

## Step 2: Determine “last letter of the day” and start review
- In `Home.tsx`, detect when a learner just completed the final letter for the current schedule day.
- Prevent advancing directly to the next letter until the review/relearn game is completed.

## Step 3: Track review completion per day
- Decide where to store progress that review has been completed for the day (likely localStorage per learner).
- Ensure review is triggered once per day completion (avoid repeating on reload).

## Step 4: Wire into navigation/state machine
- Add new `currentPhase` value like `review-relearn` (or similar) and route rendering accordingly.
- On review completion, transition to the next letter phase.

## Step 5: Testing
- Validate day 1 flow:
  - Learn M,S,A.
  - After A completion, force Review using choices/images from M,S,A only.
- Validate day 2 flow:
  - After completing I? (or after finishing last letter of day 2), force review using choices/images from M,S,A,I,O,B only.
- Validate that Admin unlock still works.

