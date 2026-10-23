# Measurement 'experiments/narrow-SPC-asc' (disabled: IX_Requests_Status_Priority_CreatedAt)

UTC 2026-10-23 09:32; version=17.0.1145.4; edition=Standard Developer Edition (64-bit); compatibility=170; requests=100000; history=179178; sqlCommittedMb=561; sqlTargetMb=3219; osAvailableMb=3469; maxdop=10; costThreshold=5; sqlCommittedMbAtEnd=480; sqlTargetMbAtEnd=3205; osAvailableMbAtEnd=3536

| Id | Statement | Rows | Logical reads | Sort | Key Lookup | Grant KB (used) | DOP | CPU ms | Elapsed ms | Client ms (max) | Indexes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Q1.count | list: status IN (InProgress,Waiting) + priority=High – COUNT | 1 | 75 | yes |  | 1,024 (16) | 1 | 0 | 1 | 1.5 (12) | Requests.IX_x_SPC |
| Q1.page | list: same filter, sort createdAt desc, page 1 x 20 | 20 | 779 |  | yes |  | 1 | 0 | 0 | 0.6 (1) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q1s.count | list: status=New + priority=High – COUNT | 1 | 8 |  |  |  | 1 | 0 | 0 | 0.2 (1) | Requests.IX_x_SPC |
| Q1s.page | list: status=New + priority=High, sort createdAt desc, page 1 x 20 | 20 | 70 |  | yes |  | 1 | 0 | 0 | 0.3 (0) | Requests.IX_x_SPC, Requests.PK_Requests |
| Q2.page | list: same filter, sort updatedAt desc, page 1 x 20 | 20 | 2,643 | yes |  | 8,328 (1,336) | 1 | 16 | 17 | 18.6 (39) | Requests.PK_Requests |
| Q3.count | list: no filter – COUNT | 1 | 225 |  |  |  | 1 | 0 | 4 | 4.7 (6) | Requests.IX_Requests_CreatedAt |
| Q3.page | list: no filter, sort createdAt desc, page 1 x 20 | 20 | 70 |  | yes |  | 1 | 0 | 0 | 0.3 (0) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q4.updated | list: no filter, sort updatedAt desc, page 1 x 20 | 20 | 2,776 | yes |  | 79,440 (24,280) | 10 | 110 | 60 | 63.8 (113) | Requests.PK_Requests |
| Q4.priority | list: no filter, sort priority desc, page 1 x 20 | 20 | 2,776 | yes |  | 79,440 (24,288) | 10 | 101 | 56 | 56.9 (124) | Requests.PK_Requests |
| Q4.status | list: no filter, sort status desc, page 1 x 20 | 20 | 2,776 | yes |  | 79,440 (24,280) | 10 | 94 | 52 | 52.7 (59) | Requests.PK_Requests |
| Q4.title | list: no filter, sort title asc, page 1 x 20 | 20 | 2,776 | yes |  | 79,440 (24,296) | 10 | 189 | 99 | 99.9 (164) | Requests.PK_Requests |
| Q5.created | deep page 1000 x 100, sort createdAt desc | 100 | 306,484 |  | yes |  | 1 | 140 | 148 | 148.7 (168) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q5.title | deep page 1000 x 100, sort title asc | 100 | 2,776 | yes |  | 79,440 (24,272) | 10 | 311 | 169 | 169.4 (214) | Requests.PK_Requests |
| Q6.count | search=bonus (LIKE '%x%') – COUNT | 1 | 2,643 |  |  |  | 1 | 398 | 428 | 429.2 (5521) | Requests.PK_Requests |
| Q6.page | search=bonus, sort createdAt desc, page 1 x 20 | 20 | 1,638 |  | yes |  | 1 | 0 | 3 | 3.4 (4) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7a.count | assignedTo=adi.ezra – COUNT | 1 | 15 |  |  |  | 1 | 0 | 0 | 0.6 (2) | Requests.IX_Requests_AssignedTo_Status |
| Q7a.page | assignedTo=adi.ezra, page 1 x 20 | 20 | 2,408 |  | yes |  | 1 | 0 | 1 | 1.6 (2) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7b.count | organization=Hermon (prefix) – COUNT | 1 | 49 |  |  |  | 1 | 0 | 2 | 2.3 (6) | Requests.IX_Requests_OrganizationName |
| Q7b.page | organization=Hermon, page 1 x 20 | 20 | 580 |  | yes |  | 1 | 0 | 0 | 0.8 (2) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7c.count | createdFrom/To = January 2026 – COUNT | 1 | 13 |  |  |  | 1 | 0 | 0 | 0.7 (2) | Requests.IX_Requests_CreatedAt |
| Q7c.page | January 2026, page 1 x 20 | 20 | 70 |  | yes |  | 1 | 0 | 0 | 0.3 (0) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q8.status | summary: count by status | 4 | 250 |  |  |  | 1 | 16 | 13 | 13.8 (17) | Requests.IX_x_SPC |
| Q8.priority | summary: count by priority | 3 | 250 |  |  | 1,040 (248) | 1 | 16 | 20 | 20.9 (23) | Requests.IX_x_SPC |
| Q8.orgs | summary: top 10 organizations by open requests | 10 | 842 | yes |  | 11,952 (2,640) | 1 | 47 | 51 | 51.6 (72) | Requests.IX_x_SPC, Requests.IX_Requests_OrganizationName |
| Q9.history | history of request 12345 | 2 | 9 |  | yes |  | 1 | 0 | 0 | 0.2 (0) | RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt, RequestStatusHistory.PK_RequestStatusHistory |
| W1 | status change New -> InProgress (UPDATE + history INSERT, rolled back) | 1 | 22 |  |  |  | 1 | 0 | 0 | 1.4 (2) | Requests.PK_Requests, Requests.IX_Requests_AssignedTo_Status, Requests.IX_x_SPC, RequestStatusHistory.PK_RequestStatusHistory, RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt |

W1 log bytes: 1,176; reads per table: Requests 16, RequestStatusHistory 6

## Index sizes

| Table | Index | Type | KB | Rows |
|---|---|---|---|---|
| Requests | PK_Requests | CLUSTERED | 21,144 | 100,000 |
| Requests | IX_Requests_AssignedTo_Status | NONCLUSTERED | 3,536 | 100,000 |
| Requests | IX_Requests_CreatedAt | NONCLUSTERED | 1,800 | 100,000 |
| Requests | IX_Requests_OrganizationName | NONCLUSTERED | 5,984 | 100,000 |
| Requests | IX_x_SPC | NONCLUSTERED | 2,008 | 100,000 |
| RequestStatusHistory | PK_RequestStatusHistory | CLUSTERED | 11,816 | 179,178 |
| RequestStatusHistory | IX_RequestStatusHistory_RequestId_ChangedAt | NONCLUSTERED | 6,464 | 179,178 |

## Plans (actual rows)

### Q1.count – list: status IN (InProgress,Waiting) + priority=High – COUNT
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Nested Loops (Inner Join) – 5,689 rows
      Merge Interval – 2 rows
        Sort (TopN Sort) – 2 rows
          Compute Scalar
            Concatenation – 2 rows
              Compute Scalar
                Constant Scan – 1 rows
              Compute Scalar
                Constant Scan – 1 rows
      Index Seek [IX_x_SPC] – 5,689 rows, 2 executions
```

### Q1.page – list: same filter, sort createdAt desc, page 1 x 20
```
Top – 20 rows
  Nested Loops (Inner Join) – 20 rows
    Index Scan [IX_Requests_CreatedAt] – 251 rows
    Key Lookup [PK_Requests] – 20 rows, 251 executions
```

### Q1s.count – list: status=New + priority=High – COUNT
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Index Seek [IX_x_SPC] – 1,765 rows
```

### Q1s.page – list: status=New + priority=High, sort createdAt desc, page 1 x 20
```
Top – 20 rows
  Nested Loops (Inner Join) – 20 rows
    Index Seek [IX_x_SPC] – 20 rows
    Key Lookup [PK_Requests] – 20 rows, 20 executions
```

### Q2.page – list: same filter, sort updatedAt desc, page 1 x 20
```
Top – 20 rows
  Sort – 20 rows
    Clustered Index Scan [PK_Requests] – 5,689 rows
```

### Q3.count – list: no filter – COUNT
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Index Scan [IX_Requests_CreatedAt] – 100,000 rows
```

### Q3.page – list: no filter, sort createdAt desc, page 1 x 20
```
Top – 20 rows
  Nested Loops (Inner Join) – 20 rows
    Index Scan [IX_Requests_CreatedAt] – 20 rows
    Key Lookup [PK_Requests] – 20 rows, 20 executions
```

### Q4.updated – list: no filter, sort updatedAt desc, page 1 x 20
```
Top – 20 rows
  Parallelism (Gather Streams) – 20 rows
    Sort – 3,616 rows
      Clustered Index Scan [PK_Requests] – 100,000 rows
```

### Q4.priority – list: no filter, sort priority desc, page 1 x 20
```
Top – 20 rows
  Parallelism (Gather Streams) – 20 rows
    Sort – 3,596 rows
      Clustered Index Scan [PK_Requests] – 100,000 rows
```

### Q4.status – list: no filter, sort status desc, page 1 x 20
```
Top – 20 rows
  Parallelism (Gather Streams) – 20 rows
    Sort – 3,581 rows
      Clustered Index Scan [PK_Requests] – 100,000 rows
```

### Q4.title – list: no filter, sort title asc, page 1 x 20
```
Top – 20 rows
  Parallelism (Gather Streams) – 20 rows
    Sort – 3,402 rows
      Clustered Index Scan [PK_Requests] – 100,000 rows
```

### Q5.created – deep page 1000 x 100, sort createdAt desc
```
Top – 100 rows
  Nested Loops (Inner Join) – 100,000 rows
    Index Scan [IX_Requests_CreatedAt] – 100,000 rows
    Key Lookup [PK_Requests] – 100,000 rows, 100,000 executions
```

### Q5.title – deep page 1000 x 100, sort title asc
```
Top – 100 rows
  Parallelism (Gather Streams) – 100,000 rows
    Sort – 100,000 rows
      Clustered Index Scan [PK_Requests] – 100,000 rows
```

### Q6.count – search=bonus (LIKE '%x%') – COUNT
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Clustered Index Scan [PK_Requests] – 3,291 rows
```

### Q6.page – search=bonus, sort createdAt desc, page 1 x 20
```
Top – 20 rows
  Nested Loops (Inner Join) – 20 rows
    Index Scan [IX_Requests_CreatedAt] – 531 rows
    Key Lookup [PK_Requests] – 20 rows, 531 executions
```

### Q7a.count – assignedTo=adi.ezra – COUNT
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Index Seek [IX_Requests_AssignedTo_Status] – 3,043 rows
```

### Q7a.page – assignedTo=adi.ezra, page 1 x 20
```
Top – 20 rows
  Nested Loops (Inner Join) – 20 rows
    Index Scan [IX_Requests_CreatedAt] – 782 rows
    Key Lookup [PK_Requests] – 20 rows, 782 executions
```

### Q7b.count – organization=Hermon (prefix) – COUNT
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Nested Loops (Inner Join) – 6,109 rows
      Compute Scalar
        Constant Scan – 1 rows
      Index Seek [IX_Requests_OrganizationName] – 6,109 rows
```

### Q7b.page – organization=Hermon, page 1 x 20
```
Top – 20 rows
  Nested Loops (Inner Join) – 20 rows
    Index Scan [IX_Requests_CreatedAt] – 186 rows
    Key Lookup [PK_Requests] – 20 rows, 186 executions
```

### Q7c.count – createdFrom/To = January 2026 – COUNT
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Index Seek [IX_Requests_CreatedAt] – 4,242 rows
```

### Q7c.page – January 2026, page 1 x 20
```
Top – 20 rows
  Nested Loops (Inner Join) – 20 rows
    Index Seek [IX_Requests_CreatedAt] – 20 rows
    Key Lookup [PK_Requests] – 20 rows, 20 executions
```

### Q8.status – summary: count by status
```
Compute Scalar
  Stream Aggregate (Aggregate) – 4 rows
    Index Scan [IX_x_SPC] – 100,000 rows
```

### Q8.priority – summary: count by priority
```
Compute Scalar
  Hash Match (Aggregate) – 3 rows
    Index Scan [IX_x_SPC] – 100,000 rows
```

### Q8.orgs – summary: top 10 organizations by open requests
```
Top – 10 rows
  Sort – 10 rows
    Compute Scalar
      Hash Match (Aggregate) – 400 rows
        Hash Match (Inner Join) – 37,128 rows
          Index Seek [IX_x_SPC] – 37,128 rows
          Index Scan [IX_Requests_OrganizationName] – 100,000 rows
```

### Q9.history – history of request 12345
```
Nested Loops (Inner Join) – 2 rows
  Index Seek [IX_RequestStatusHistory_RequestId_ChangedAt] – 2 rows
  Key Lookup [PK_RequestStatusHistory] – 2 rows, 2 executions
```

### W1 – status change New -> InProgress (UPDATE + history INSERT, rolled back)
```
Assert – 1 rows
  Clustered Index Update (Update) [PK_Requests], [IX_Requests_AssignedTo_Status], [IX_x_SPC] – 1 rows
    Compute Scalar – 1 rows
      Compute Scalar
        Top – 1 rows
          Compute Scalar – 1 rows
            Clustered Index Seek [PK_Requests] – 1 rows
Assert – 1 rows
  Nested Loops (Left Semi Join) – 1 rows
    Assert – 1 rows
      Clustered Index Insert (Insert) [PK_RequestStatusHistory], [IX_RequestStatusHistory_RequestId_ChangedAt] – 1 rows
        Compute Scalar
          Compute Scalar – 1 rows
            Constant Scan – 1 rows
    Clustered Index Seek [PK_Requests] – 1 rows
```
