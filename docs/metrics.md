# Evaluation metric definitions — extractive-v1

Each result retains raw question, selected synthetic fixture identifiers, expected criteria, retrieved records, answer/claims/citations, checks, elapsed time, and metric numerators/denominators. Dataset, fixture, and metric hashes/versions are recorded with every run.

| Metric | Numerator | Denominator |
| --- | --- | --- |
| Recall@k | Retrieved identifiers intersecting labeled relevant identifiers | Number of labeled relevant identifiers |
| Precision@k | Same relevant intersection | Requested k, including unfilled slots |
| Required sources retrieved | 1 if every required source was retrieved | 1 for cases with required sources; otherwise 0 |
| Citation correctness | Citations whose identifier was retrieved and nonempty quote occurs verbatim in its body | Citation count |
| Extractive claim support | Claims whose complete text equals a valid cited excerpt | Claim count |
| Labeled answer checks | 1 if the expected reason and all expected text fragments match | 1 per labeled case |
| Appropriate abstention | Correct abstention on an expected abstention scenario | Number of expected abstention scenarios |
| Case pass rate | Cases satisfying every recorded check | Completed case count |
| Failure rate | Cases with an execution/provider error | Completed case count |

Zero-denominator metrics are `null`, never silently perfect. Run-level metrics sum numerators and denominators (micro aggregation). A case also requires valid citations, supported extractive claims, expected abstention behavior, and required source retrieval. These deterministic checks are **not semantic answer accuracy**, and no LLM judge is used.

Latency is elapsed wall-clock time around the real case execution. Median and p95 linearly interpolate sorted observations at `(n-1)*p`. Mock-provider timings describe the mock workflow, not a hosted model. Token counts remain unavailable unless reported by a real provider. Monetary estimates remain unavailable until both usage and explicitly configured pricing exist.

Synthetic fixtures are the only benchmark source. Workspace instructions cannot authorize actions. The core dataset starts with 20 labeled cases; subsequent versions add fault-injection and action scenarios, recording changed content hashes so incompatible runs cannot be compared.
