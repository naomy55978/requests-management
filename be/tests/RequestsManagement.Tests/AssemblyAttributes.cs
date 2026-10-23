// The integration tests share one database and one running API (and its in-memory summary cache), and the
// concurrency tests need a quiet system, so test classes do not run in parallel. Inside a test, requests do
// run in parallel when the test needs it. The suite is small, so this costs seconds.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
