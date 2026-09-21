## 2024-05-18 - Memoize and Hoist Array Filters
**Learning:** Found an `O(n)` array filtering inside a render path of a component. In addition to missing memoization, string operations were being performed inside the loop on each execution.
**Action:** Always verify if computations like `.toLowerCase()` or `.trim()` on dependencies can be hoisted outside array iterators during memoization to maximize optimization efficiency.
