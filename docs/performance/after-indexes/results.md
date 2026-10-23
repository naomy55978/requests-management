# Measurement 'after-indexes'

UTC 2026-10-23 09:45; version=17.0.1145.4; edition=Standard Developer Edition (64-bit); compatibility=170; requests=100000; history=179178; sqlCommittedMb=639; sqlTargetMb=2640; osAvailableMb=2775; maxdop=10; costThreshold=5; sqlCommittedMbAtEnd=657; sqlTargetMbAtEnd=2629; osAvailableMbAtEnd=2764

| Id | Statement | Rows | Logical reads | Sort | Key Lookup | Grant KB (used) | DOP | CPU ms | Elapsed ms | Client ms (max) | Indexes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Q1.count | list: status IN (InProgress,Waiting) + priority=High – COUNT | 1 | 75 | yes |  | 1,024 (16) | 1 | 0 | 1 | 1.5 (12) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1.page | list: same filter, sort createdAt desc, page 1 x 20 | 20 | 779 |  | yes |  | 1 | 0 | 0 | 0.6 (1) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q1s.count | list: status=New + priority=High – COUNT | 1 | 8 |  |  |  | 1 | 0 | 0 | 0.4 (11) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1s.page | list: status=New + priority=High, sort createdAt desc, page 1 x 20 | 20 | 70 |  | yes |  | 1 | 0 | 0 | 0.3 (0) | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.PK_Requests |
| Q2.page | list: same filter, sort updatedAt desc, page 1 x 20 | 20 | 439 |  | yes |  | 1 | 0 | 0 | 0.6 (14) | Requests.IX_Requests_UpdatedAt, Requests.PK_Requests |
| Q3.count | list: no filter – COUNT | 1 | 138 |  |  |  | 1 | 8 | 8 | 12.2 (18) | Requests.IX_Requests_Priority |
| Q3.page | list: no filter, sort createdAt desc, page 1 x 20 | 20 | 70 |  | yes |  | 1 | 0 | 0 | 0.9 (6) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q4.updated | list: no filter, sort updatedAt desc, page 1 x 20 | 20 | 70 |  | yes |  | 1 | 0 | 0 | 0.3 (1) | Requests.IX_Requests_UpdatedAt, Requests.PK_Requests |
| Q4.priority | list: no filter, sort priority desc, page 1 x 20 | 20 | 70 |  | yes |  | 1 | 0 | 0 | 1.8 (2) | Requests.IX_Requests_Priority, Requests.PK_Requests |
| Q4.status | list: no filter, sort status desc, page 1 x 20 | 20 | 2,579 | yes |  | 79,440 (24,296) | 10 | 86 | 47 | 49.4 (108) | Requests.PK_Requests |
| Q4.title | list: no filter, sort title asc, page 1 x 20 | 20 | 71 |  | yes |  | 1 | 0 | 0 | 0.5 (7) | Requests.IX_Requests_Title, Requests.PK_Requests |
| Q5.created | deep page 1000 x 100, sort createdAt desc | 100 | 306,484 |  | yes |  | 1 | 141 | 152 | 152.5 (172) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q5.title | deep page 1000 x 100, sort title asc | 100 | 307,477 |  | yes |  | 1 | 141 | 148 | 148.5 (164) | Requests.IX_Requests_Title, Requests.PK_Requests |
| Q6.count | search=bonus (LIKE '%x%') – COUNT | 1 | 2,067 |  |  | 1,856 (848) | 1 | 446 | 481 | 482.3 (498) | Requests.IX_Requests_Title, Requests.IX_Requests_OrganizationName_CreatedAt |
| Q6.page | search=bonus, sort createdAt desc, page 1 x 20 | 20 | 1,638 |  | yes |  | 1 | 0 | 2 | 3.6 (14) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7a.count | assignedTo=adi.ezra – COUNT | 1 | 19 |  |  |  | 1 | 0 | 0 | 0.8 (1) | Requests.IX_Requests_AssignedTo_CreatedAt |
| Q7a.page | assignedTo=adi.ezra, page 1 x 20 | 20 | 71 |  | yes |  | 1 | 0 | 0 | 0.4 (1) | Requests.IX_Requests_AssignedTo_CreatedAt, Requests.PK_Requests |
| Q7b.count | organization=Hermon (prefix) – COUNT | 1 | 56 |  |  |  | 1 | 0 | 1 | 2.5 (16) | Requests.IX_Requests_OrganizationName_CreatedAt |
| Q7b.page | organization=Hermon, page 1 x 20 | 20 | 580 |  | yes |  | 1 | 0 | 0 | 1.0 (3) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7c.count | createdFrom/To = January 2026 – COUNT | 1 | 13 |  |  |  | 1 | 0 | 0 | 0.9 (1) | Requests.IX_Requests_CreatedAt |
| Q7c.page | January 2026, page 1 x 20 | 20 | 70 |  | yes |  | 1 | 0 | 0 | 0.4 (10) | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q8.status | summary: count by status | 4 | 250 |  |  |  | 1 | 15 | 15 | 15.3 (21) | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q8.priority | summary: count by priority | 3 | 138 |  |  |  | 1 | 16 | 15 | 16.3 (34) | Requests.IX_Requests_Priority |
| Q8.orgs | summary: top 10 organizations by open requests | 10 | 943 | yes |  | 11,952 (2,640) | 1 | 47 | 51 | 51.7 (60) | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.IX_Requests_OrganizationName_CreatedAt |
| Q9.history | history of request 12345 | 2 | 9 |  | yes |  | 1 | 0 | 0 | 0.3 (0) | RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt, RequestStatusHistory.PK_RequestStatusHistory |
| W1 | status change New -> InProgress (UPDATE + history INSERT, rolled back) | 1 | 23 |  |  |  | 1 | 0 | 0 | 1.2 (2) | Requests.PK_Requests, Requests.IX_Requests_AssignedTo_CreatedAt, Requests.IX_Requests_Status_Priority_CreatedAt, Requests.IX_Requests_UpdatedAt, RequestStatusHistory.PK_RequestStatusHistory, RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt |

W1 log bytes: 1,396; reads per table: Requests 17, RequestStatusHistory 6

## Index sizes

| Table | Index | Type | KB | Rows |
|---|---|---|---|---|
| Requests | PK_Requests | CLUSTERED | 19,680 | 100,000 |
| Requests | IX_Requests_AssignedTo_CreatedAt | NONCLUSTERED | 4,328 | 100,000 |
| Requests | IX_Requests_CreatedAt | NONCLUSTERED | 1,800 | 100,000 |
| Requests | IX_Requests_OrganizationName_CreatedAt | NONCLUSTERED | 6,792 | 100,000 |
| Requests | IX_Requests_Priority | NONCLUSTERED | 1,104 | 100,000 |
| Requests | IX_Requests_Status_Priority_CreatedAt | NONCLUSTERED | 2,008 | 100,000 |
| Requests | IX_Requests_Title | NONCLUSTERED | 9,744 | 100,000 |
| Requests | IX_Requests_UpdatedAt | NONCLUSTERED | 1,800 | 100,000 |
| RequestStatusHistory | PK_RequestStatusHistory | CLUSTERED | 9,288 | 179,178 |
| RequestStatusHistory | IX_RequestStatusHistory_RequestId_ChangedAt | NONCLUSTERED | 3,944 | 179,178 |

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
  Nested Loops (Inner Join) – 20 rows
    Index Seek [IX_Requests_Status_Priority_CreatedAt] – 20 rows
    Key Lookup [PK_Requests] – 20 rows, 20 executions
```

### Q2.page – list: same filter, sort updatedAt desc, page 1 x 20
```
Top – 20 rows
  Nested Loops (Inner Join) – 20 rows
    Index Scan [IX_Requests_UpdatedAt] – 140 rows
    Key Lookup [PK_Requests] – 20 rows, 140 executions
```

### Q3.count – list: no filter – COUNT
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Index Scan [IX_Requests_Priority] – 100,000 rows
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
  Nested Loops (Inner Join) – 20 rows
    Index Scan [IX_Requests_UpdatedAt] – 20 rows
    Key Lookup [PK_Requests] – 20 rows, 20 executions
```

### Q4.priority – list: no filter, sort priority desc, page 1 x 20
```
Top – 20 rows
  Nested Loops (Inner Join) – 20 rows
    Index Scan [IX_Requests_Priority] – 20 rows
    Key Lookup [PK_Requests] – 20 rows, 20 executions
```

### Q4.status – list: no filter, sort status desc, page 1 x 20
```
Top – 20 rows
  Parallelism (Gather Streams) – 20 rows
    Sort – 3,588 rows
      Clustered Index Scan [PK_Requests] – 100,000 rows
```

### Q4.title – list: no filter, sort title asc, page 1 x 20
```
Top – 20 rows
  Nested Loops (Inner Join) – 20 rows
    Index Scan [IX_Requests_Title] – 20 rows
    Key Lookup [PK_Requests] – 20 rows, 20 executions
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
  Nested Loops (Inner Join) – 100,000 rows
    Index Scan [IX_Requests_Title] – 100,000 rows
    Key Lookup [PK_Requests] – 100,000 rows, 100,000 executions
```

### Q6.count – search=bonus (LIKE '%x%') – COUNT
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Hash Match (Aggregate) – 3,291 rows
      Concatenation – 3,291 rows
        Nested Loops (Inner Join) – 3,291 rows
          Compute Scalar
            Constant Scan – 1 rows
          Index Seek [IX_Requests_Title] – 3,291 rows
        Nested Loops (Inner Join) – 0 rows
          Compute Scalar
            Constant Scan – 1 rows
          Index Seek [IX_Requests_OrganizationName_CreatedAt] – 0 rows
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
    Index Seek [IX_Requests_AssignedTo_CreatedAt] – 3,043 rows
```

### Q7a.page – assignedTo=adi.ezra, page 1 x 20
```
Top – 20 rows
  Nested Loops (Inner Join) – 20 rows
    Index Seek [IX_Requests_AssignedTo_CreatedAt] – 20 rows
    Key Lookup [PK_Requests] – 20 rows, 20 executions
```

### Q7b.count – organization=Hermon (prefix) – COUNT
```
Compute Scalar
  Stream Aggregate (Aggregate) – 1 rows
    Nested Loops (Inner Join) – 6,109 rows
      Compute Scalar
        Constant Scan – 1 rows
      Index Seek [IX_Requests_OrganizationName_CreatedAt] – 6,109 rows
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
    Index Scan [IX_Requests_Status_Priority_CreatedAt] – 100,000 rows
```

### Q8.priority – summary: count by priority
```
Compute Scalar
  Stream Aggregate (Aggregate) – 3 rows
    Index Scan [IX_Requests_Priority] – 100,000 rows
```

### Q8.orgs – summary: top 10 organizations by open requests
```
Top – 10 rows
  Sort – 10 rows
    Compute Scalar
      Hash Match (Aggregate) – 400 rows
        Hash Match (Inner Join) – 37,128 rows
          Index Seek [IX_Requests_Status_Priority_CreatedAt] – 37,128 rows
          Index Scan [IX_Requests_OrganizationName_CreatedAt] – 100,000 rows
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
  Clustered Index Update (Update) [PK_Requests], [IX_Requests_AssignedTo_CreatedAt], [IX_Requests_Status_Priority_CreatedAt], [IX_Requests_UpdatedAt] – 1 rows
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
