| Id | Statement | Reads before → experiments/AC-asc-inclStatus | Sort | Grant KB | DOP | Elapsed ms | Client ms | Indexes (experiments/AC-asc-inclStatus) |
|---|---|---|---|---|---|---|---|---|
| Q1.count | list: status IN (InProgress,Waiting) + priority=High – COUNT | 697 → 697 | yes → yes | 1,024 → 1,024 | 1 → 1 | 1 → 3 | 1.7 → 3.9 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1.page | list: same filter, sort createdAt desc, page 1 x 20 | 779 → 779 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 1.0 → 1.1 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q1s.count | list: status=New + priority=High – COUNT | 44 → 44 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.8 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1s.page | list: status=New + priority=High, sort createdAt desc, page 1 x 20 | 44 → 44 | yes → yes | 6,656 → 6,656 | 1 → 1 | 0 → 1 | 0.9 → 1.6 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q2.page | list: same filter, sort updatedAt desc, page 1 x 20 | 697 → 697 | yes → yes | 8,352 → 8,352 | 1 → 1 | 4 → 6 | 5.1 → 7.6 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q3.count | list: no filter – COUNT | 225 → 225 | no → no | 0 → 0 | 1 → 1 | 7 → 8 | 8.0 → 9.5 | Requests.IX_Requests_CreatedAt |
| Q3.page | list: no filter, sort createdAt desc, page 1 x 20 | 70 → 70 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.4 → 0.4 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q4.updated | list: no filter, sort updatedAt desc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 49 → 49 | 50.4 → 50.4 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.priority | list: no filter, sort priority desc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 58 → 62 | 59.2 → 62.9 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.status | list: no filter, sort status desc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 59 → 60 | 59.6 → 60.9 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.title | list: no filter, sort title asc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 89 → 88 | 89.8 → 88.7 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q5.created | deep page 1000 x 100, sort createdAt desc | 306,484 → 306,484 | no → no | 0 → 0 | 1 → 1 | 164 → 164 | 164.4 → 164.5 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q5.title | deep page 1000 x 100, sort title asc | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 165 → 165 | 165.9 → 165.0 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q6.count | search=bonus (LIKE '%x%') – COUNT | 2,427 → 2,427 | no → no | 0 → 0 | 1 → 1 | 397 → 360 | 398.1 → 360.5 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q6.page | search=bonus, sort createdAt desc, page 1 x 20 | 1,638 → 1,638 | no → no | 0 → 0 | 1 → 1 | 1 → 2 | 1.9 → 3.2 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7a.count | assignedTo=adi.ezra – COUNT | 15 → 19 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.4 | Requests.IX_x_AC |
| Q7a.page | assignedTo=adi.ezra, page 1 x 20 | 2,408 → 71 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 1.0 → 0.2 | Requests.IX_x_AC, Requests.PK_Requests |
| Q7b.count | organization=Hermon (prefix) – COUNT | 49 → 49 | no → no | 0 → 0 | 1 → 1 | 1 → 1 | 1.3 → 1.2 | Requests.IX_Requests_OrganizationName |
| Q7b.page | organization=Hermon, page 1 x 20 | 580 → 580 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.6 → 0.4 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7c.count | createdFrom/To = January 2026 – COUNT | 13 → 13 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.4 | Requests.IX_Requests_CreatedAt |
| Q7c.page | January 2026, page 1 x 20 | 70 → 70 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.1 → 0.2 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q8.status | summary: count by status | 439 → 539 | no → no | 1,040 → 1,040 | 1 → 1 | 10 → 17 | 10.5 → 17.3 | Requests.IX_x_AC |
| Q8.priority | summary: count by priority | 2,427 → 2,427 | no → no | 1,040 → 1,040 | 1 → 1 | 18 → 11 | 18.8 → 12.0 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q8.orgs | summary: top 10 organizations by open requests | 897 → 897 | yes → yes | 1,728 → 1,728 | 1 → 1 | 22 → 15 | 23.3 → 15.5 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q9.history | history of request 12345 | 9 → 9 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.2 → 0.1 | RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt, RequestStatusHistory.PK_RequestStatusHistory |
| W1 | status change New -> InProgress (UPDATE + history INSERT, rolled back) | 24 → 21 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.8 → 0.7 | Requests.PK_Requests, Requests.IX_Requests_Status_Priority_CreatedAt, Requests.IX_x_AC, RequestStatusHistory.PK_RequestStatusHistory, RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt |

W1 log bytes: 1,544 → 1,508; reads 24 → 21
Index count (Requests): 5 → 5; nonclustered KB (Requests): 30,736 → 31,528
