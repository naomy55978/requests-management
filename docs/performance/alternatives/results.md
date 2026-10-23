# Measurement 'alternatives'

UTC 2026-10-23 09:36; version=17.0.1145.4; edition=Standard Developer Edition (64-bit); compatibility=170; requests=100000; history=179178; sqlCommittedMb=528; sqlTargetMb=3425; osAvailableMb=3608; maxdop=10; costThreshold=5; sqlCommittedMbAtEnd=537; sqlTargetMbAtEnd=3333; osAvailableMbAtEnd=3582

| Id | Statement | Rows | Logical reads | Sort | Key Lookup | Grant KB (used) | DOP | CPU ms | Elapsed ms | Client ms (max) | Indexes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A1.created | deferred join: deep page 1000 x 100, createdAt desc | 100 | 540 | yes |  | 1,024 (32) | 1 | 8 | 8 | 8.4 (27) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| A1.title | deferred join: deep page 1000 x 100, title asc | 100 | 1,533 | yes |  | 1,024 (32) | 1 | 15 | 8 | 8.2 (16) | Requests.IX_Requests_Title, Requests.PK_Requests |
| A1.first | deferred join: page 1 x 20, createdAt desc (page 1 must not get worse) | 20 | 71 | yes |  | 1,024 (16) | 1 | 0 | 0 | 0.3 (0) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| A2.status | deferred join: sort status desc, page 1 x 20 (sorts keys only) | 20 | 808 | yes |  | 14,968 (4,096) | 10 | 63 | 50 | 51.1 (68) | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.PK_Requests |
| A3.status | sort status desc, page 1 x 20 with OPTION (MAXDOP 1) | 20 | 2,643 | yes |  | 73,824 (23,256) | 0 | 79 | 94 | 95.2 (126) | Requests.PK_Requests |
| A4.search | search: COUNT(*) OVER() + page in one query | 20 | 9,789 | yes |  | 10,264 (768) | 1 | 407 | 428 | 429.1 (482) | Requests.PK_Requests |
| A5.binary | search COUNT with a binary collation (different semantics – for analysis only) | 1 | 2,643 |  |  |  | 1 | 47 | 46 | 48.0 (57) | Requests.PK_Requests |
| A5.upper | search COUNT: UPPER(column) with a binary collation vs UPPER(pattern) | 1 | 2,643 |  |  |  | 1 | 47 | 59 | 59.4 (70) | Requests.PK_Requests |
| A6.prefix | title prefix LIKE 'Bonus%' – COUNT (seek; different semantics) | 1 | 3 |  |  |  | 1 | 0 | 0 | 0.4 (1) | Requests.IX_Requests_Title |

## Index sizes

| Table | Index | Type | KB | Rows |
|---|---|---|---|---|
| Requests | PK_Requests | CLUSTERED | 21,144 | 100,000 |
| Requests | IX_Requests_AssignedTo_CreatedAt | NONCLUSTERED | 4,328 | 100,000 |
| Requests | IX_Requests_CreatedAt | NONCLUSTERED | 1,800 | 100,000 |
| Requests | IX_Requests_OrganizationName | NONCLUSTERED | 5,984 | 100,000 |
| Requests | IX_Requests_Priority | NONCLUSTERED | 1,104 | 100,000 |
| Requests | IX_Requests_Status_Priority_CreatedAt | NONCLUSTERED | 2,008 | 100,000 |
| Requests | IX_Requests_Title | NONCLUSTERED | 9,744 | 100,000 |
| Requests | IX_Requests_UpdatedAt | NONCLUSTERED | 1,800 | 100,000 |
| RequestStatusHistory | PK_RequestStatusHistory | CLUSTERED | 11,816 | 179,178 |
| RequestStatusHistory | IX_RequestStatusHistory_RequestId_ChangedAt | NONCLUSTERED | 6,464 | 179,178 |

## Plans (actual rows)

### A1.created – deferred join: deep page 1000 x 100, createdAt desc
```
Sort – 100 rows
  Nested Loops (Inner Join) – 100 rows
    Top – 100 rows
      Index Scan [IX_Requests_CreatedAt] – 100,000 rows
    Clustered Index Seek [PK_Requests] – 100 rows, 100 executions
```

### A1.title – deferred join: deep page 1000 x 100, title asc
```
Sort – 100 rows
  Nested Loops (Inner Join) – 100 rows
    Top – 100 rows
      Index Scan [IX_Requests_Title] – 100,000 rows
    Clustered Index Seek [PK_Requests] – 100 rows, 100 executions
```

### A1.first – deferred join: page 1 x 20, createdAt desc (page 1 must not get worse)
```
Sort – 20 rows
  Nested Loops (Inner Join) – 20 rows
    Top – 20 rows
      Index Scan [IX_Requests_CreatedAt] – 20 rows
    Clustered Index Seek [PK_Requests] – 20 rows, 20 executions
```

### A2.status – deferred join: sort status desc, page 1 x 20 (sorts keys only)
Warnings: SpillToTempDb, SortSpillDetails
```
Sort – 20 rows
  Parallelism (Gather Streams) – 20 rows
    Nested Loops (Inner Join) – 20 rows
      Parallelism (Distribute Streams) – 20 rows
        Top – 20 rows
          Parallelism (Gather Streams) – 20 rows
            Sort – 33,336 rows
              Index Scan [IX_Requests_Status_Priority_CreatedAt] – 100,000 rows
      Clustered Index Seek [PK_Requests] – 20 rows
```

### A3.status – sort status desc, page 1 x 20 with OPTION (MAXDOP 1)
```
Top – 20 rows
  Sort – 20 rows
    Clustered Index Scan [PK_Requests] – 100,000 rows
```

### A4.search – search: COUNT(*) OVER() + page in one query
```
Top – 20 rows
  Sort – 20 rows
    Nested Loops (Inner Join) – 3,291 rows
      Table Spool (Lazy Spool) – 2 rows
        Segment – 3,291 rows
          Clustered Index Scan [PK_Requests] – 3,291 rows
      Nested Loops (Inner Join) – 3,291 rows, 2 executions
        Compute Scalar
          Stream Aggregate (Aggregate) – 1 rows, 2 executions
            Table Spool (Lazy Spool) – 3,291 rows, 2 executions
        Table Spool (Lazy Spool) – 3,291 rows
```

### A5.binary – search COUNT with a binary collation (different semantics – for analysis only)
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Clustered Index Scan [PK_Requests] – 3,291 rows
```

### A5.upper – search COUNT: UPPER(column) with a binary collation vs UPPER(pattern)
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Clustered Index Scan [PK_Requests] – 3,291 rows
```

### A6.prefix – title prefix LIKE 'Bonus%' – COUNT (seek; different semantics)
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Nested Loops (Inner Join) – 0 rows
      Compute Scalar
        Constant Scan – 1 rows
      Index Seek [IX_Requests_Title] – 0 rows
```
