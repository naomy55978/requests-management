| Id | Statement | Reads before → experiments/without-IX_Requests_CreatedAt | Sort | Grant KB | DOP | Elapsed ms | Client ms | Indexes (experiments/without-IX_Requests_CreatedAt) |
|---|---|---|---|---|---|---|---|---|
| Q1.count | list: status IN (InProgress,Waiting) + priority=High – COUNT | 697 → 697 | yes → yes | 1,024 → 1,024 | 1 → 1 | 1 → 2 | 1.7 → 3.4 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1.page | list: same filter, sort createdAt desc, page 1 x 20 | 779 → 697 | no → yes | 0 → 8,352 | 1 → 1 | 0 → 5 | 1.0 → 6.2 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1s.count | list: status=New + priority=High – COUNT | 44 → 44 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.6 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1s.page | list: status=New + priority=High, sort createdAt desc, page 1 x 20 | 44 → 44 | yes → yes | 6,656 → 6,656 | 1 → 1 | 0 → 1 | 0.9 → 2.0 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q2.page | list: same filter, sort updatedAt desc, page 1 x 20 | 697 → 697 | yes → yes | 8,352 → 8,352 | 1 → 1 | 4 → 4 | 5.1 → 4.3 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q3.count | list: no filter – COUNT | 225 → 442 | no → no | 0 → 0 | 1 → 1 | 7 → 4 | 8.0 → 4.5 | Requests.IX_Requests_AssignedTo_Status |
| Q3.page | list: no filter, sort createdAt desc, page 1 x 20 | 70 → 2,547 | no → yes | 0 → 79,440 | 1 → 10 | 0 → 49 | 0.4 → 49.8 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.updated | list: no filter, sort updatedAt desc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 49 → 45 | 50.4 → 47.6 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.priority | list: no filter, sort priority desc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 58 → 61 | 59.2 → 62.1 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.status | list: no filter, sort status desc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 59 → 61 | 59.6 → 62.0 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.title | list: no filter, sort title asc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 89 → 86 | 89.8 → 87.3 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q5.created | deep page 1000 x 100, sort createdAt desc | 306,484 → 2,547 | no → yes | 0 → 79,440 | 1 → 10 | 164 → 72 | 164.4 → 73.0 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q5.title | deep page 1000 x 100, sort title asc | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 165 → 165 | 165.9 → 165.5 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q6.count | search=bonus (LIKE '%x%') – COUNT | 2,427 → 2,427 | no → no | 0 → 0 | 1 → 1 | 397 → 389 | 398.1 → 390.6 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q6.page | search=bonus, sort createdAt desc, page 1 x 20 | 1,638 → 2,427 | no → yes | 0 → 10,184 | 1 → 1 | 1 → 454 | 1.9 → 455.1 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q7a.count | assignedTo=adi.ezra – COUNT | 15 → 15 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.6 | Requests.IX_Requests_AssignedTo_Status |
| Q7a.page | assignedTo=adi.ezra, page 1 x 20 | 2,408 → 2,427 | no → yes | 0 → 3,232 | 1 → 1 | 0 → 13 | 1.0 → 13.5 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q7b.count | organization=Hermon (prefix) – COUNT | 49 → 49 | no → no | 0 → 0 | 1 → 1 | 1 → 1 | 1.3 → 1.2 | Requests.IX_Requests_OrganizationName |
| Q7b.page | organization=Hermon, page 1 x 20 | 580 → 2,427 | no → yes | 0 → 5,296 | 1 → 1 | 0 → 37 | 0.6 → 39.9 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q7c.count | createdFrom/To = January 2026 – COUNT | 13 → 2,427 | no → no | 0 → 0 | 1 → 1 | 0 → 11 | 0.3 → 13.7 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q7c.page | January 2026, page 1 x 20 | 70 → 2,427 | no → yes | 0 → 4,960 | 1 → 1 | 0 → 9 | 0.1 → 9.5 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q8.status | summary: count by status | 439 → 442 | no → no | 1,040 → 1,040 | 1 → 1 | 10 → 20 | 10.5 → 20.8 | Requests.IX_Requests_AssignedTo_Status |
| Q8.priority | summary: count by priority | 2,427 → 2,427 | no → no | 1,040 → 1,040 | 1 → 1 | 18 → 20 | 18.8 → 20.9 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q8.orgs | summary: top 10 organizations by open requests | 897 → 898 | yes → yes | 1,728 → 1,728 | 1 → 1 | 22 → 20 | 23.3 → 21.0 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q9.history | history of request 12345 | 9 → 9 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.2 → 0.2 | RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt, RequestStatusHistory.PK_RequestStatusHistory |
| W1 | status change New -> InProgress (UPDATE + history INSERT, rolled back) | 24 → 24 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.8 → 0.6 | Requests.PK_Requests, Requests.IX_Requests_AssignedTo_Status, Requests.IX_Requests_Status_Priority_CreatedAt, RequestStatusHistory.PK_RequestStatusHistory, RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt |

W1 log bytes: 1,544 → 1,544; reads 24 → 24
Index count (Requests): 5 → 4; nonclustered KB (Requests): 30,736 → 28,936
