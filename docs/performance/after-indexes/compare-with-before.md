| Id | Statement | Reads before → after-indexes | Sort | Grant KB | DOP | Elapsed ms | Client ms | Indexes (after-indexes) |
|---|---|---|---|---|---|---|---|---|
| Q1.count | list: status IN (InProgress,Waiting) + priority=High – COUNT | 697 → 75 | yes → yes | 1,024 → 1,024 | 1 → 1 | 1 → 1 | 1.7 → 1.5 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1.page | list: same filter, sort createdAt desc, page 1 x 20 | 779 → 779 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 1.0 → 0.6 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q1s.count | list: status=New + priority=High – COUNT | 44 → 8 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.4 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1s.page | list: status=New + priority=High, sort createdAt desc, page 1 x 20 | 44 → 70 | yes → no | 6,656 → 0 | 1 → 1 | 0 → 0 | 0.9 → 0.3 | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.PK_Requests |
| Q2.page | list: same filter, sort updatedAt desc, page 1 x 20 | 697 → 439 | yes → no | 8,352 → 0 | 1 → 1 | 4 → 0 | 5.1 → 0.6 | Requests.IX_Requests_UpdatedAt, Requests.PK_Requests |
| Q3.count | list: no filter – COUNT | 225 → 138 | no → no | 0 → 0 | 1 → 1 | 7 → 8 | 8.0 → 12.2 | Requests.IX_Requests_Priority |
| Q3.page | list: no filter, sort createdAt desc, page 1 x 20 | 70 → 70 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.4 → 0.9 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q4.updated | list: no filter, sort updatedAt desc, page 1 x 20 | 2,547 → 70 | yes → no | 79,440 → 0 | 10 → 1 | 49 → 0 | 50.4 → 0.3 | Requests.IX_Requests_UpdatedAt, Requests.PK_Requests |
| Q4.priority | list: no filter, sort priority desc, page 1 x 20 | 2,547 → 70 | yes → no | 79,440 → 0 | 10 → 1 | 58 → 0 | 59.2 → 1.8 | Requests.IX_Requests_Priority, Requests.PK_Requests |
| Q4.status | list: no filter, sort status desc, page 1 x 20 | 2,547 → 2,579 | yes → yes | 79,440 → 79,440 | 10 → 10 | 59 → 47 | 59.6 → 49.4 | Requests.PK_Requests |
| Q4.title | list: no filter, sort title asc, page 1 x 20 | 2,547 → 71 | yes → no | 79,440 → 0 | 10 → 1 | 89 → 0 | 89.8 → 0.5 | Requests.IX_Requests_Title, Requests.PK_Requests |
| Q5.created | deep page 1000 x 100, sort createdAt desc | 306,484 → 306,484 | no → no | 0 → 0 | 1 → 1 | 164 → 152 | 164.4 → 152.5 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q5.title | deep page 1000 x 100, sort title asc | 2,547 → 307,477 | yes → no | 79,440 → 0 | 10 → 1 | 165 → 148 | 165.9 → 148.5 | Requests.IX_Requests_Title, Requests.PK_Requests |
| Q6.count | search=bonus (LIKE '%x%') – COUNT | 2,427 → 2,067 | no → no | 0 → 1,856 | 1 → 1 | 397 → 481 | 398.1 → 482.3 | Requests.IX_Requests_Title, Requests.IX_Requests_OrganizationName_CreatedAt |
| Q6.page | search=bonus, sort createdAt desc, page 1 x 20 | 1,638 → 1,638 | no → no | 0 → 0 | 1 → 1 | 1 → 2 | 1.9 → 3.6 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7a.count | assignedTo=adi.ezra – COUNT | 15 → 19 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.8 | Requests.IX_Requests_AssignedTo_CreatedAt |
| Q7a.page | assignedTo=adi.ezra, page 1 x 20 | 2,408 → 71 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 1.0 → 0.4 | Requests.IX_Requests_AssignedTo_CreatedAt, Requests.PK_Requests |
| Q7b.count | organization=Hermon (prefix) – COUNT | 49 → 56 | no → no | 0 → 0 | 1 → 1 | 1 → 1 | 1.3 → 2.5 | Requests.IX_Requests_OrganizationName_CreatedAt |
| Q7b.page | organization=Hermon, page 1 x 20 | 580 → 580 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.6 → 1.0 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7c.count | createdFrom/To = January 2026 – COUNT | 13 → 13 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.9 | Requests.IX_Requests_CreatedAt |
| Q7c.page | January 2026, page 1 x 20 | 70 → 70 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.1 → 0.4 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q8.status | summary: count by status | 439 → 250 | no → no | 1,040 → 0 | 1 → 1 | 10 → 15 | 10.5 → 15.3 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q8.priority | summary: count by priority | 2,427 → 138 | no → no | 1,040 → 0 | 1 → 1 | 18 → 15 | 18.8 → 16.3 | Requests.IX_Requests_Priority |
| Q8.orgs | summary: top 10 organizations by open requests | 897 → 943 | yes → yes | 1,728 → 11,952 | 1 → 1 | 22 → 51 | 23.3 → 51.7 | Requests.IX_Requests_Status_Priority_CreatedAt, Requests.IX_Requests_OrganizationName_CreatedAt |
| Q9.history | history of request 12345 | 9 → 9 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.2 → 0.3 | RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt, RequestStatusHistory.PK_RequestStatusHistory |
| W1 | status change New -> InProgress (UPDATE + history INSERT, rolled back) | 24 → 23 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.8 → 1.2 | Requests.PK_Requests, Requests.IX_Requests_AssignedTo_CreatedAt, Requests.IX_Requests_Status_Priority_CreatedAt, Requests.IX_Requests_UpdatedAt, RequestStatusHistory.PK_RequestStatusHistory, RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt |

W1 log bytes: 1,544 → 1,396; reads 24 → 23
Index count (Requests): 5 → 8; nonclustered KB (Requests): 30,736 → 27,576
