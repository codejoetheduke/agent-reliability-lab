# Evaluation metric definitions — extractive-v1

Each result retains raw question, selected synthetic fixture identifiers, expected criteria, retrieved records, answer/claims/citations, checks, elapsed time, and metric numerators/denominators. Dataset, fixture, and metric hashes/versions are recorded with every run.

| Metric                     | Numerator                                                                               | Denominator                                    |
| -------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Recall@k                   | Retrieved identifiers intersecting labeled relevant identifiers                         | Number of labeled relevant identifiers         |
| Precision@k                | Same relevant intersection                                                              | Requested k, including unfilled slots          |
| Required sources retrieved | 1 if every required source was retrieved                                                | 1 for cases with required sources; otherwise 0 |
| Citation correctness       | Citations whose identifier was retrieved and nonempty quote occurs verbatim in its body | Citation count                                 |
| Extractive claim support   | Claims whose complete text equals a valid cited excerpt                                 | Claim count                                    |
| Labeled answer checks      | 1 if the expected reason and all expected text fragments match                          | 1 per labeled case                             |
| Appropriate abstention     | Correct abstention on an expected abstention scenario                                   | Number of expected abstention scenarios        |
| Case pass rate             | Cases satisfying every recorded check                                                   | Completed case count                           |
| Failure rate               | Cases with an execution/provider error                                                  | Completed case count                           |

Zero-denominator metrics are `null`, never silently perfect. Run-level metrics sum numerators and denominators (micro aggregation). A case also requires valid citations, supported extractive claims, expected abstention behavior, and required source retrieval. These deterministic checks are **not semantic answer accuracy**, and no LLM judge is used.

Latency is elapsed wall-clock time around the real case execution. Median and p95 linearly interpolate sorted observations at `(n-1)*p`. Mock-provider timings describe the mock workflow, not a hosted model. Token counts remain unavailable unless reported by a real provider. Monetary estimates remain unavailable until both usage and explicitly configured pricing exist.

Summary usage sums accepted responses with reported metadata; a missing count in an accepted response makes that aggregate unavailable. Failed or timed-out calls can have additional unreported usage or charges. These figures are not provider billing totals. Comparisons flag ordinary provider failures, and costs remain estimates for the reported responses. Gemini pacing is part of measured request/case latency and must match between compared runs.

Synthetic fixtures are the only benchmark source. Workspace instructions cannot authorize actions. The core dataset starts with 20 labeled cases; subsequent versions add fault-injection and action scenarios, recording changed content hashes so incompatible runs cannot be compared.

## Actions and faults

Version 1.2.0 contains 29 cases: 20 QA/restraint, four injected provider faults, and five isolated mock-action scenarios. Action selection and execution authorization use one binary check per action case. Parameter/deadline correctness apply to four authorized cases; duplicate prevention and recovery each have one explicit scenario. Recovery includes rollback after an injected partial operation and an explicit successful retry. These are deterministic lifecycle checks, not evidence of natural-language action-planning quality.

Expected safe rejection of a fault can pass its case while recording an execution error. Failure rate counts error-bearing outcomes / all completed cases, including injected faults. Provider failure rate excludes injected and local-action scenarios; it is a workflow statistic, not a population reliability estimate. Injected-fault counts are exposed separately. Missing usage remains null; local mocks and blocked action requests have no model token usage.

## Reproducibility and comparison

New runs retain complete synthetic dataset and fixture snapshots, content hashes, prompt/metric versions, retrieval k, provider/model, execution conditions, and pricing assumptions. The runner uses saved snapshots and recorded provider timeout/prices. Credentials are loaded privately at execution and never recorded. Model aliases and external provider behavior can still change; use pinned model identifiers where available.

Comparisons require two completed, distinct runs with matching dataset ID/version/hash, fixture hash, metric version, prompt version, retrieval k, condition hash, simulation mode, and complete matching case IDs. Missing legacy metadata causes an explicit incompatibility result. The compared model identifier may differ, which is the intended experiment variable. Usage/cost availability is shown independently and assumptions are recorded; model overrides do not inherit another model's prices.

Metric changes are B minus A in percentage points, retaining each rate's numerator and denominator. Latency histograms use six shared bins from zero to the largest recorded elapsed time. Pass proportions include Wilson 95% intervals, using z=1.959963984540054. Curated cases are few and correlated; these intervals are descriptive and do not justify significance claims or population accuracy. Case changes track pass/fail and error-code differences; raw checks remain inspectable in run details.

The committed sample reports come from two executed mock runs. They contain only synthetic fixtures and measured local timings. Their 29/29 pass results establish expected baseline behavior on these fixtures, not model intelligence or real-world reliability. Four deliberate error cases remain visible despite passing their safety checks.
