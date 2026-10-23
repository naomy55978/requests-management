| Id | Statement | Reads after-indexes → final | Sort | Grant KB | DOP | Elapsed ms | Client ms | Indexes (final) |
|---|---|---|---|---|---|---|---|---|
| Q1.count | list: status IN (InProgress,Waiting) + priority=High – COUNT | 75 → 76 | yes → yes | 1,024 → 1,024 | 1 → 1 | 1 → 1 | 1.5 → 2.1 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1.page | list: same filter, sort createdAt desc, page 1 x 20 | 779 → 839 | no → yes | 0 → 1,024 | 1 → 1 | 0 → 0 | 0.6 → 0.6 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q1s.count | list: status=New + priority=High – COUNT | 8 → 8 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.4 → 1.1 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1s.page | list: status=New + priority=High, sort createdAt desc, page 1 x 20 | 70 → 62 | no → yes | 0 → 1,024 | 1 → 1 | 0 → 0 | 0.3 → 0.3 | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.PK_Requests |
| Q2.page | list: same filter, sort updatedAt desc, page 1 x 20 | 439 → 499 | no → yes | 0 → 1,024 | 1 → 1 | 0 → 0 | 0.6 → 0.5 | Requests.IX_Requests_UpdatedAt, Requests.PK_Requests |
| Q3.count | list: no filter – COUNT | 138 → 138 | no → no | 0 → 0 | 1 → 1 | 8 → 11 | 12.2 → 11.3 | Requests.IX_Requests_Priority |
| Q3.page | list: no filter, sort createdAt desc, page 1 x 20 | 70 → 62 | no → yes | 0 → 1,024 | 1 → 1 | 0 → 0 | 0.9 → 0.3 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q4.updated | list: no filter, sort updatedAt desc, page 1 x 20 | 70 → 62 | no → yes | 0 → 1,024 | 1 → 1 | 0 → 0 | 0.3 → 0.4 | Requests.IX_Requests_UpdatedAt, Requests.PK_Requests |
| Q4.priority | list: no filter, sort priority desc, page 1 x 20 | 70 → 62 | no → yes | 0 → 1,024 | 1 → 1 | 0 → 0 | 1.8 → 0.8 | Requests.IX_Requests_Priority, Requests.PK_Requests |
| Q4.status | list: no filter, sort status desc, page 1 x 20 | 2,579 → 808 | yes → yes | 79,440 → 14,968 | 10 → 10 | 47 → 46 | 49.4 → 47.5 | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.PK_Requests |
| Q4.title | list: no filter, sort title asc, page 1 x 20 | 71 → 63 | no → yes | 0 → 1,024 | 1 → 1 | 0 → 0 | 0.5 → 0.5 | Requests.IX_Requests_Title, Requests.PK_Requests |
| Q5.created | deep page 1000 x 100, sort createdAt desc | 306,484 → 525 | no → yes | 0 → 1,024 | 1 → 1 | 152 → 12 | 152.5 → 12.7 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q5.title | deep page 1000 x 100, sort title asc | 307,477 → 1,518 | no → yes | 0 → 1,024 | 1 → 1 | 148 → 11 | 148.5 → 12.0 | Requests.IX_Requests_Title, Requests.PK_Requests |
| Q6.count | search=bonus (LIKE '%x%') – COUNT | 2,067 → 2,460 | no → no | 1,856 → 0 | 1 → 1 | 481 → 52 | 482.3 → 52.7 | Requests.PK_Requests |
| Q6.page | search=bonus, sort createdAt desc, page 1 x 20 | 1,638 → 1,698 | no → yes | 0 → 1,024 | 1 → 1 | 2 → 1 | 3.6 → 1.5 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7a.count | assignedTo=adi.ezra – COUNT | 19 → 19 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.8 → 0.4 | Requests.IX_Requests_AssignedTo_CreatedAt |
| Q7a.page | assignedTo=adi.ezra, page 1 x 20 | 71 → 63 | no → yes | 0 → 1,024 | 1 → 1 | 0 → 0 | 0.4 → 0.6 | Requests.IX_Requests_AssignedTo_CreatedAt, Requests.PK_Requests |
| Q7b.count | organization=Hermon (prefix) – COUNT | 56 → 56 | no → no | 0 → 0 | 1 → 1 | 1 → 1 | 2.5 → 1.3 | Requests.IX_Requests_OrganizationName_CreatedAt |
| Q7b.page | organization=Hermon, page 1 x 20 | 580 → 116 | no → yes | 0 → 1,888 | 1 → 1 | 0 → 2 | 1.0 → 2.6 | Requests.IX_Requests_OrganizationName_CreatedAt, Requests.PK_Requests |
| Q7c.count | createdFrom/To = January 2026 – COUNT | 13 → 13 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.9 → 0.3 | Requests.IX_Requests_CreatedAt |
| Q7c.page | January 2026, page 1 x 20 | 70 → 62 | no → yes | 0 → 1,024 | 1 → 1 | 0 → 0 | 0.4 → 0.2 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q8.status | summary: count by status | 250 → 251 | no → no | 0 → 0 | 1 → 1 | 15 → 12 | 15.3 → 13.5 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q8.priority | summary: count by priority | 138 → 138 | no → no | 0 → 0 | 1 → 1 | 15 → 10 | 16.3 → 10.9 | Requests.IX_Requests_Priority |
| Q8.orgs | summary: top 10 organizations by open requests | 943 → 944 | yes → yes | 11,952 → 11,952 | 1 → 1 | 51 → 40 | 51.7 → 43.4 | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.IX_Requests_OrganizationName_CreatedAt |
| Q9.history | history of request 12345 | 9 → 9 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.4 | RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt, RequestStatusHistory.PK_RequestStatusHistory |
| W1 | status change New -> InProgress (UPDATE + history INSERT, rolled back) | 23 → 23 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 1.2 → 0.8 | Requests.PK_Requests, Requests.IX_Requests_AssignedTo_CreatedAt, Requests.IX_Requests_Status_Priority_CreatedAt, Requests.IX_Requests_UpdatedAt, RequestStatusHistory.PK_RequestStatusHistory, RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt |

W1 log bytes: 1,396 → 1,396; reads 23 → 23
Index count (Requests): 8 → 8; nonclustered KB (Requests): 27,576 → 27,576
