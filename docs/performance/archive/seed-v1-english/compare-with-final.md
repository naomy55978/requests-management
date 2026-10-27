| Id | Statement | Reads final → seed-v1-english | Sort | Grant KB | DOP | Elapsed ms | Client ms | Indexes (seed-v1-english) |
|---|---|---|---|---|---|---|---|---|
| Q1.count | list: status IN (InProgress,Waiting) + priority=High – COUNT | 76 → 75 | yes → yes | 1,024 → 1,024 | 1 → 1 | 1 → 2 | 2.1 → 2.7 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1.page | list: same filter, sort createdAt desc, page 1 x 20 | 839 → 839 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.6 → 1.0 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q1s.count | list: status=New + priority=High – COUNT | 8 → 8 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 1.1 → 0.5 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1s.page | list: status=New + priority=High, sort createdAt desc, page 1 x 20 | 62 → 62 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.3 → 0.9 | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.PK_Requests |
| Q2.page | list: same filter, sort updatedAt desc, page 1 x 20 | 499 → 499 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.5 → 0.8 | Requests.IX_Requests_UpdatedAt, Requests.PK_Requests |
| Q3.count | list: no filter – COUNT | 138 → 138 | no → no | 0 → 0 | 1 → 1 | 11 → 9 | 11.3 → 9.7 | Requests.IX_Requests_Priority |
| Q3.page | list: no filter, sort createdAt desc, page 1 x 20 | 62 → 62 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.3 → 0.8 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q4.updated | list: no filter, sort updatedAt desc, page 1 x 20 | 62 → 62 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.4 → 0.7 | Requests.IX_Requests_UpdatedAt, Requests.PK_Requests |
| Q4.priority | list: no filter, sort priority desc, page 1 x 20 | 62 → 62 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.8 → 0.6 | Requests.IX_Requests_Priority, Requests.PK_Requests |
| Q4.status | list: no filter, sort status desc, page 1 x 20 | 808 → 805 | yes → yes | 14,968 → 14,968 | 10 → 10 | 46 → 46 | 47.5 → 47.4 | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.PK_Requests |
| Q4.title | list: no filter, sort title asc, page 1 x 20 | 63 → 63 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.5 → 0.8 | Requests.IX_Requests_Title, Requests.PK_Requests |
| Q5.created | deep page 1000 x 100, sort createdAt desc | 525 → 525 | yes → yes | 1,024 → 1,024 | 1 → 1 | 12 → 12 | 12.7 → 13.2 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q5.title | deep page 1000 x 100, sort title asc | 1,518 → 1,518 | yes → yes | 1,024 → 1,024 | 1 → 1 | 11 → 12 | 12.0 → 13.0 | Requests.IX_Requests_Title, Requests.PK_Requests |
| Q6.count | search=bonus (LIKE '%x%') – COUNT | 2,460 → 2,460 | no → no | 0 → 0 | 1 → 1 | 52 → 54 | 52.7 → 55.2 | Requests.PK_Requests |
| Q6.page | search=bonus, sort createdAt desc, page 1 x 20 | 1,698 → 1,698 | yes → yes | 1,024 → 1,024 | 1 → 1 | 1 → 1 | 1.5 → 1.8 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7a.count | assignedTo=adi.ezra – COUNT | 19 → 19 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.4 → 0.7 | Requests.IX_Requests_AssignedTo_CreatedAt |
| Q7a.page | assignedTo=adi.ezra, page 1 x 20 | 63 → 63 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.6 → 0.9 | Requests.IX_Requests_AssignedTo_CreatedAt, Requests.PK_Requests |
| Q7b.count | organization=Hermon (prefix) – COUNT | 56 → 56 | no → no | 0 → 0 | 1 → 1 | 1 → 1 | 1.3 → 2.4 | Requests.IX_Requests_OrganizationName_CreatedAt |
| Q7b.page | organization=Hermon, page 1 x 20 | 116 → 116 | yes → yes | 1,888 → 1,888 | 1 → 1 | 2 → 4 | 2.6 → 4.7 | Requests.IX_Requests_OrganizationName_CreatedAt, Requests.PK_Requests |
| Q7c.count | createdFrom/To = January 2026 – COUNT | 13 → 13 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.7 | Requests.IX_Requests_CreatedAt |
| Q7c.page | January 2026, page 1 x 20 | 62 → 62 | yes → yes | 1,024 → 1,024 | 1 → 1 | 0 → 0 | 0.2 → 0.4 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q8.status | summary: count by status | 251 → 250 | no → no | 0 → 0 | 1 → 1 | 12 → 13 | 13.5 → 13.5 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q8.priority | summary: count by priority | 138 → 138 | no → no | 0 → 0 | 1 → 1 | 10 → 13 | 10.9 → 14.0 | Requests.IX_Requests_Priority |
| Q8.orgs | summary: top 10 organizations by open requests | 944 → 943 | yes → yes | 11,952 → 11,952 | 1 → 1 | 40 → 48 | 43.4 → 49.2 | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.IX_Requests_OrganizationName_CreatedAt |
| Q9.history | history of request 12345 | 9 → 9 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.4 → 0.4 | RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt, RequestStatusHistory.PK_RequestStatusHistory |
| W1 | status change New -> InProgress (UPDATE + history INSERT, rolled back) | 23 → 23 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.8 → 1.7 | Requests.PK_Requests, Requests.IX_Requests_AssignedTo_CreatedAt, Requests.IX_Requests_Status_Priority_CreatedAt, Requests.IX_Requests_UpdatedAt, RequestStatusHistory.PK_RequestStatusHistory, RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt |

W1 log bytes: 1,396 → 1,396; reads 23 → 23
Index count (Requests): 8 → 8; nonclustered KB (Requests): 27,576 → 27,576
