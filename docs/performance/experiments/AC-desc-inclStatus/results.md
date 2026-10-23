# Measurement 'experiments/AC-desc-inclStatus' (disabled: IX_Requests_AssignedTo_Status)

UTC 2026-10-23 09:33; version=17.0.1145.4; edition=Standard Developer Edition (64-bit); compatibility=170; requests=100000; history=179178; sqlCommittedMb=525; sqlTargetMb=3283; osAvailableMb=3495; maxdop=10; costThreshold=5; sqlCommittedMbAtEnd=536; sqlTargetMbAtEnd=3221; osAvailableMbAtEnd=3487

| Id | Statement | Rows | Logical reads | Sort | Key Lookup | Grant KB (used) | DOP | CPU ms | Elapsed ms | Client ms (max) | Indexes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Q1.count | list: status IN (InProgress,Waiting) + priority=High – COUNT | 1 | 695 | yes |  | 1,024 (16) | 1 | 0 | 1 | 1.9 (11) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1.page | list: same filter, sort createdAt desc, page 1 x 20 | 20 | 779 |  | yes |  | 1 | 0 | 0 | 0.7 (2) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q1s.count | list: status=New + priority=High – COUNT | 1 | 44 |  |  |  | 1 | 0 | 0 | 0.3 (1) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1s.page | list: status=New + priority=High, sort createdAt desc, page 1 x 20 | 20 | 44 | yes |  | 6,656 (400) | 1 | 0 | 0 | 0.9 (1) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q2.page | list: same filter, sort updatedAt desc, page 1 x 20 | 20 | 695 | yes |  | 8,352 (1,336) | 1 | 0 | 4 | 4.4 (20) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q3.count | list: no filter – COUNT | 1 | 225 |  |  |  | 1 | 8 | 10 | 11.0 (21) | Requests.IX_Requests_CreatedAt |
| Q3.page | list: no filter, sort createdAt desc, page 1 x 20 | 20 | 70 |  | yes |  | 1 | 0 | 0 | 0.3 (1) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q4.updated | list: no filter, sort updatedAt desc, page 1 x 20 | 20 | 2,544 | yes |  | 79,440 (24,304) | 10 | 78 | 54 | 55.0 (116) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.priority | list: no filter, sort priority desc, page 1 x 20 | 20 | 2,544 | yes |  | 79,440 (24,304) | 10 | 95 | 59 | 59.7 (111) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.status | list: no filter, sort status desc, page 1 x 20 | 20 | 2,544 | yes |  | 79,440 (24,296) | 10 | 109 | 59 | 60.6 (119) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.title | list: no filter, sort title asc, page 1 x 20 | 20 | 2,544 | yes |  | 79,440 (24,376) | 10 | 158 | 86 | 87.0 (151) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q5.created | deep page 1000 x 100, sort createdAt desc | 100 | 306,484 |  | yes |  | 1 | 157 | 165 | 165.8 (206) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q5.title | deep page 1000 x 100, sort title asc | 100 | 2,544 | yes |  | 79,440 (24,304) | 10 | 281 | 169 | 169.9 (218) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q6.count | search=bonus (LIKE '%x%') – COUNT | 1 | 2,425 |  |  |  | 1 | 375 | 408 | 409.8 (454) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q6.page | search=bonus, sort createdAt desc, page 1 x 20 | 20 | 1,638 |  | yes |  | 1 | 0 | 1 | 2.2 (5) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7a.count | assignedTo=adi.ezra – COUNT | 1 | 19 |  |  |  | 1 | 0 | 0 | 0.3 (0) | Requests.IX_x_AC |
| Q7a.page | assignedTo=adi.ezra, page 1 x 20 | 20 | 2,408 |  | yes |  | 1 | 0 | 0 | 0.9 (1) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7b.count | organization=Hermon (prefix) – COUNT | 1 | 49 |  |  |  | 1 | 0 | 1 | 7.4 (20) | Requests.IX_Requests_OrganizationName |
| Q7b.page | organization=Hermon, page 1 x 20 | 20 | 580 |  | yes |  | 1 | 0 | 0 | 0.4 (5) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7c.count | createdFrom/To = January 2026 – COUNT | 1 | 13 |  |  |  | 1 | 0 | 0 | 0.3 (0) | Requests.IX_Requests_CreatedAt |
| Q7c.page | January 2026, page 1 x 20 | 20 | 70 |  | yes |  | 1 | 0 | 0 | 0.2 (0) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q8.status | summary: count by status | 4 | 539 |  |  | 1,040 (248) | 1 | 16 | 20 | 20.4 (28) | Requests.IX_x_AC |
| Q8.priority | summary: count by priority | 3 | 2,425 |  |  | 1,040 (248) | 1 | 15 | 16 | 16.0 (27) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q8.orgs | summary: top 10 organizations by open requests | 10 | 895 | yes |  | 1,728 (360) | 1 | 16 | 19 | 19.7 (26) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q9.history | history of request 12345 | 2 | 9 |  | yes |  | 1 | 0 | 0 | 0.1 (0) | RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt, RequestStatusHistory.PK_RequestStatusHistory |
| W1 | status change New -> InProgress (UPDATE + history INSERT, rolled back) | 1 | 21 |  |  |  | 1 | 0 | 0 | 0.7 (3) | Requests.PK_Requests, Requests.IX_Requests_Status_Priority_CreatedAt, Requests.IX_x_AC, RequestStatusHistory.PK_RequestStatusHistory, RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt |

W1 log bytes: 1,508; reads per table: Requests 15, RequestStatusHistory 6

## Index sizes

| Table | Index | Type | KB | Rows |
|---|---|---|---|---|
| Requests | PK_Requests | CLUSTERED | 21,144 | 100,000 |
| Requests | IX_Requests_CreatedAt | NONCLUSTERED | 1,800 | 100,000 |
| Requests | IX_Requests_OrganizationName | NONCLUSTERED | 5,984 | 100,000 |
| Requests | IX_Requests_Status_Priority_CreatedAt | NONCLUSTERED | 19,416 | 100,000 |
| Requests | IX_x_AC | NONCLUSTERED | 4,328 | 100,000 |
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
      Index Seek [IX_Requests_Status_Priority_CreatedAt] – 5,689 rows, 2 executions
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
    Index Seek [IX_Requests_Status_Priority_CreatedAt] – 1,765 rows
```

### Q1s.page – list: status=New + priority=High, sort createdAt desc, page 1 x 20
```
Top – 20 rows
  Sort – 20 rows
    Index Seek [IX_Requests_Status_Priority_CreatedAt] – 1,765 rows
```

### Q2.page – list: same filter, sort updatedAt desc, page 1 x 20
```
Top – 20 rows
  Sort – 20 rows
    Nested Loops (Inner Join) – 5,689 rows
      Merge Interval – 2 rows
        Sort (TopN Sort) – 2 rows
          Compute Scalar
            Concatenation – 2 rows
              Compute Scalar
                Constant Scan – 1 rows
              Compute Scalar
                Constant Scan – 1 rows
      Index Seek [IX_Requests_Status_Priority_CreatedAt] – 5,689 rows, 2 executions
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
    Sort – 3,617 rows
      Index Scan [IX_Requests_Status_Priority_CreatedAt] – 100,000 rows
```

### Q4.priority – list: no filter, sort priority desc, page 1 x 20
```
Top – 20 rows
  Parallelism (Gather Streams) – 20 rows
    Sort – 3,588 rows
      Index Scan [IX_Requests_Status_Priority_CreatedAt] – 100,000 rows
```

### Q4.status – list: no filter, sort status desc, page 1 x 20
```
Top – 20 rows
  Parallelism (Gather Streams) – 20 rows
    Sort – 3,588 rows
      Index Scan [IX_Requests_Status_Priority_CreatedAt] – 100,000 rows
```

### Q4.title – list: no filter, sort title asc, page 1 x 20
Warnings: SpillToTempDb, SortSpillDetails
```
Top – 20 rows
  Parallelism (Gather Streams) – 20 rows
    Sort – 3,417 rows
      Index Scan [IX_Requests_Status_Priority_CreatedAt] – 100,000 rows
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
      Index Scan [IX_Requests_Status_Priority_CreatedAt] – 100,000 rows
```

### Q6.count – search=bonus (LIKE '%x%') – COUNT
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Index Scan [IX_Requests_Status_Priority_CreatedAt] – 3,291 rows
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
    Index Seek [IX_x_AC] – 3,043 rows
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
  Hash Match (Aggregate) – 4 rows
    Index Scan [IX_x_AC] – 100,000 rows
```

### Q8.priority – summary: count by priority
```
Compute Scalar
  Hash Match (Aggregate) – 3 rows
    Index Scan [IX_Requests_Status_Priority_CreatedAt] – 100,000 rows
```

### Q8.orgs – summary: top 10 organizations by open requests
```
Top – 10 rows
  Sort – 10 rows
    Compute Scalar
      Hash Match (Aggregate) – 400 rows
        Index Seek [IX_Requests_Status_Priority_CreatedAt] – 37,128 rows
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
  Clustered Index Update (Update) [PK_Requests], [IX_Requests_Status_Priority_CreatedAt], [IX_x_AC] – 1 rows
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
