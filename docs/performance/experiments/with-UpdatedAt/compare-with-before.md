| Id | Statement | Reads before → experiments/with-UpdatedAt | Sort | Grant KB | DOP | Elapsed ms | Client ms | Indexes (experiments/with-UpdatedAt) |
|---|---|---|---|---|---|---|---|---|
| Q1.count | list: status IN (InProgress,Waiting) + priority=High – COUNT | 697 → 697 | yes → yes | 1,024 → 1,024 | 1 → 1 | 1 → 2 | 1.7 → 3.2 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1.page | list: same filter, sort createdAt desc, page 1 x 20 | 779 → 779 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 1.0 → 0.6 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q1s.count | list: status=New + priority=High – COUNT | 44 → 44 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.3 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1s.page | list: status=New + priority=High, sort createdAt desc, page 1 x 20 | 44 → 44 | yes → yes | 6,656 → 6,656 | 1 → 1 | 0 → 0 | 0.9 → 1.2 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q2.page | list: same filter, sort updatedAt desc, page 1 x 20 | 697 → 439 | yes → no | 8,352 → 0 | 1 → 1 | 4 → 0 | 5.1 → 0.4 | Requests.IX_x_UpdatedAt, Requests.PK_Requests |
| Q3.count | list: no filter – COUNT | 225 → 225 | no → no | 0 → 0 | 1 → 1 | 7 → 4 | 8.0 → 4.9 | Requests.IX_x_UpdatedAt |
| Q3.page | list: no filter, sort createdAt desc, page 1 x 20 | 70 → 70 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.4 → 0.5 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q4.updated | list: no filter, sort updatedAt desc, page 1 x 20 | 2,547 → 70 | yes → no | 79,440 → 0 | 10 → 1 | 49 → 0 | 50.4 → 0.5 | Requests.IX_x_UpdatedAt, Requests.PK_Requests |
| Q4.priority | list: no filter, sort priority desc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 58 → 60 | 59.2 → 62.4 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.status | list: no filter, sort status desc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 59 → 58 | 59.6 → 59.8 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.title | list: no filter, sort title asc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 89 → 87 | 89.8 → 87.7 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q5.created | deep page 1000 x 100, sort createdAt desc | 306,484 → 306,484 | no → no | 0 → 0 | 1 → 1 | 164 → 174 | 164.4 → 174.8 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q5.title | deep page 1000 x 100, sort title asc | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 165 → 167 | 165.9 → 167.9 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q6.count | search=bonus (LIKE '%x%') – COUNT | 2,427 → 2,427 | no → no | 0 → 0 | 1 → 1 | 397 → 403 | 398.1 → 404.1 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q6.page | search=bonus, sort createdAt desc, page 1 x 20 | 1,638 → 1,638 | no → no | 0 → 0 | 1 → 1 | 1 → 1 | 1.9 → 2.0 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7a.count | assignedTo=adi.ezra – COUNT | 15 → 15 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.3 | Requests.IX_Requests_AssignedTo_Status |
| Q7a.page | assignedTo=adi.ezra, page 1 x 20 | 2,408 → 2,408 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 1.0 → 0.9 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7b.count | organization=Hermon (prefix) – COUNT | 49 → 49 | no → no | 0 → 0 | 1 → 1 | 1 → 0 | 1.3 → 1.1 | Requests.IX_Requests_OrganizationName |
| Q7b.page | organization=Hermon, page 1 x 20 | 580 → 580 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.6 → 0.4 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7c.count | createdFrom/To = January 2026 – COUNT | 13 → 13 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.3 | Requests.IX_Requests_CreatedAt |
| Q7c.page | January 2026, page 1 x 20 | 70 → 70 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.1 → 0.2 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q8.status | summary: count by status | 439 → 442 | no → no | 1,040 → 1,040 | 1 → 1 | 10 → 19 | 10.5 → 19.3 | Requests.IX_Requests_AssignedTo_Status |
| Q8.priority | summary: count by priority | 2,427 → 2,427 | no → no | 1,040 → 1,040 | 1 → 1 | 18 → 12 | 18.8 → 12.7 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q8.orgs | summary: top 10 organizations by open requests | 897 → 898 | yes → yes | 1,728 → 1,728 | 1 → 1 | 22 → 11 | 23.3 → 11.6 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q9.history | history of request 12345 | 9 → 9 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.2 → 0.2 | RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt, RequestStatusHistory.PK_RequestStatusHistory |
| W1 | status change New -> InProgress (UPDATE + history INSERT, rolled back) | 24 → 28 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.8 → 0.7 | Requests.PK_Requests, Requests.IX_Requests_AssignedTo_Status, Requests.IX_Requests_Status_Priority_CreatedAt, Requests.IX_x_UpdatedAt, RequestStatusHistory.PK_RequestStatusHistory, RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt |

W1 log bytes: 1,544 → 1,788; reads 24 → 28
Index count (Requests): 5 → 6; nonclustered KB (Requests): 30,736 → 32,536
