| Id | Statement | Reads final → experiments/final-OrgCreatedAt | Sort | Grant KB | DOP | Elapsed ms | Client ms | Indexes (experiments/final-OrgCreatedAt) |
|---|---|---|---|---|---|---|---|---|
| Q1.count | list: status IN (InProgress,Waiting) + priority=High – COUNT | 75 → 76 | yes → yes | 1,024 → 1,024 | 1 → 1 | 4 → 1 | 12.2 → 1.5 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1.page | list: same filter, sort createdAt desc, page 1 x 20 | 839 → 839 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 1.2 → 0.6 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q1s.count | list: status=New + priority=High – COUNT | 8 → 8 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.6 → 0.3 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1s.page | list: status=New + priority=High, sort createdAt desc, page 1 x 20 | 62 → 62 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.8 → 0.3 | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.PK_Requests |
| Q2.page | list: same filter, sort updatedAt desc, page 1 x 20 | 499 → 499 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.9 → 0.5 | Requests.IX_Requests_UpdatedAt, Requests.PK_Requests |
| Q3.count | list: no filter – COUNT | 138 → 138 | no → no | 0 → 0 | 1 → 1 | 13 → 7 | 14.3 → 7.3 | Requests.IX_Requests_Priority |
| Q3.page | list: no filter, sort createdAt desc, page 1 x 20 | 62 → 62 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.7 → 0.3 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q4.updated | list: no filter, sort updatedAt desc, page 1 x 20 | 62 → 62 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.8 → 0.3 | Requests.IX_Requests_UpdatedAt, Requests.PK_Requests |
| Q4.priority | list: no filter, sort priority desc, page 1 x 20 | 62 → 62 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.7 → 0.3 | Requests.IX_Requests_Priority, Requests.PK_Requests |
| Q4.status | list: no filter, sort status desc, page 1 x 20 | 805 → 808 | yes → yes | 14,968 → 14,968 | 10 → 10 | 59 → 48 | 60.5 → 48.7 | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.PK_Requests |
| Q4.title | list: no filter, sort title asc, page 1 x 20 | 63 → 63 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.7 → 0.3 | Requests.IX_Requests_Title, Requests.PK_Requests |
| Q5.created | deep page 1000 x 100, sort createdAt desc | 525 → 525 | yes → yes | 1,024 → 1,024 | 1 → 1 | 13 → 12 | 13.8 → 13.5 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q5.title | deep page 1000 x 100, sort title asc | 1,518 → 1,518 | yes → yes | 1,024 → 1,024 | 1 → 1 | 24 → 9 | 26.2 → 10.2 | Requests.IX_Requests_Title, Requests.PK_Requests |
| Q6.count | search=bonus (LIKE '%x%') – COUNT | 2,460 → 2,460 | no → no | 0 → 0 | 1 → 1 | 74 → 28 | 74.8 → 29.2 | Requests.PK_Requests |
| Q6.page | search=bonus, sort createdAt desc, page 1 x 20 | 1,698 → 1,698 | yes → yes | 1,024 → 1,024 | 1 → 1 | 1 → 0 | 2.5 → 1.0 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7a.count | assignedTo=adi.ezra – COUNT | 19 → 19 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 1.8 → 0.4 | Requests.IX_Requests_AssignedTo_CreatedAt |
| Q7a.page | assignedTo=adi.ezra, page 1 x 20 | 63 → 63 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.8 → 0.3 | Requests.IX_Requests_AssignedTo_CreatedAt, Requests.PK_Requests |
| Q7b.count | organization=Hermon (prefix) – COUNT | 49 → 56 | no → no | 0 → 0 | 1 → 1 | 2 → 1 | 3.0 → 1.3 | Requests.IX_x_OC |
| Q7b.page | organization=Hermon, page 1 x 20 | 334 → 116 | yes → yes | 5,080 → 1,888 | 1 → 1 | 23 → 2 | 24.5 → 2.4 | Requests.IX_x_OC, Requests.PK_Requests |
| Q7c.count | createdFrom/To = January 2026 – COUNT | 13 → 13 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.7 → 0.4 | Requests.IX_Requests_CreatedAt |
| Q7c.page | January 2026, page 1 x 20 | 62 → 62 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.5 → 0.3 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q8.status | summary: count by status | 250 → 251 | no → no | 0 → 0 | 1 → 1 | 16 → 11 | 17.8 → 11.7 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q8.priority | summary: count by priority | 138 → 138 | no → no | 0 → 0 | 1 → 1 | 16 → 13 | 16.8 → 14.8 | Requests.IX_Requests_Priority |
| Q8.orgs | summary: top 10 organizations by open requests | 842 → 944 | yes → yes | 11,952 → 11,952 | 1 → 1 | 58 → 44 | 58.7 → 45.0 | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.IX_x_OC |
| Q9.history | history of request 12345 | 9 → 9 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.2 | RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt, RequestStatusHistory.PK_RequestStatusHistory |
| W1 | status change New -> InProgress (UPDATE + history INSERT, rolled back) | 23 → 23 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 1.7 → 0.8 | Requests.PK_Requests, Requests.IX_Requests_AssignedTo_CreatedAt, Requests.IX_Requests_Status_Priority_CreatedAt, Requests.IX_Requests_UpdatedAt, RequestStatusHistory.PK_RequestStatusHistory, RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt |

W1 log bytes: 1,396 → 1,396; reads 23 → 23
Index count (Requests): 8 → 8; nonclustered KB (Requests): 26,768 → 27,576
