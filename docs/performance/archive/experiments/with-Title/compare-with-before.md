| Id | Statement | Reads before → experiments/with-Title | Sort | Grant KB | DOP | Elapsed ms | Client ms | Indexes (experiments/with-Title) |
|---|---|---|---|---|---|---|---|---|
| Q1.count | list: status IN (InProgress,Waiting) + priority=High – COUNT | 697 → 697 | yes → yes | 1,024 → 1,024 | 1 → 1 | 1 → 2 | 1.7 → 3.1 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1.page | list: same filter, sort createdAt desc, page 1 x 20 | 779 → 779 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 1.0 → 1.0 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q1s.count | list: status=New + priority=High – COUNT | 44 → 44 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.4 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q1s.page | list: status=New + priority=High, sort createdAt desc, page 1 x 20 | 44 → 44 | yes → yes | 6,656 → 6,656 | 1 → 1 | 0 → 1 | 0.9 → 1.4 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q2.page | list: same filter, sort updatedAt desc, page 1 x 20 | 697 → 697 | yes → yes | 8,352 → 8,352 | 1 → 1 | 4 → 6 | 5.1 → 7.1 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q3.count | list: no filter – COUNT | 225 → 225 | no → no | 0 → 0 | 1 → 1 | 7 → 9 | 8.0 → 10.1 | Requests.IX_Requests_CreatedAt |
| Q3.page | list: no filter, sort createdAt desc, page 1 x 20 | 70 → 70 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.4 → 0.3 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q4.updated | list: no filter, sort updatedAt desc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 49 → 49 | 50.4 → 50.6 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.priority | list: no filter, sort priority desc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 58 → 62 | 59.2 → 63.0 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.status | list: no filter, sort status desc, page 1 x 20 | 2,547 → 2,547 | yes → yes | 79,440 → 79,440 | 10 → 10 | 59 → 59 | 59.6 → 60.4 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q4.title | list: no filter, sort title asc, page 1 x 20 | 2,547 → 71 | yes → no | 79,440 → 0 | 10 → 1 | 89 → 0 | 89.8 → 0.9 | Requests.IX_x_Title, Requests.PK_Requests |
| Q5.created | deep page 1000 x 100, sort createdAt desc | 306,484 → 306,484 | no → no | 0 → 0 | 1 → 1 | 164 → 173 | 164.4 → 174.4 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q5.title | deep page 1000 x 100, sort title asc | 2,547 → 307,477 | yes → no | 79,440 → 0 | 10 → 1 | 165 → 167 | 165.9 → 167.6 | Requests.IX_x_Title, Requests.PK_Requests |
| Q6.count | search=bonus (LIKE '%x%') – COUNT | 2,427 → 1,966 | no → no | 0 → 1,856 | 1 → 1 | 397 → 474 | 398.1 → 474.9 | Requests.IX_x_Title, Requests.IX_Requests_OrganizationName |
| Q6.page | search=bonus, sort createdAt desc, page 1 x 20 | 1,638 → 1,638 | no → no | 0 → 0 | 1 → 1 | 1 → 3 | 1.9 → 3.5 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7a.count | assignedTo=adi.ezra – COUNT | 15 → 15 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.6 | Requests.IX_Requests_AssignedTo_Status |
| Q7a.page | assignedTo=adi.ezra, page 1 x 20 | 2,408 → 2,408 | no → no | 0 → 0 | 1 → 1 | 0 → 1 | 1.0 → 1.9 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7b.count | organization=Hermon (prefix) – COUNT | 49 → 49 | no → no | 0 → 0 | 1 → 1 | 1 → 1 | 1.3 → 2.2 | Requests.IX_Requests_OrganizationName |
| Q7b.page | organization=Hermon, page 1 x 20 | 580 → 580 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.6 → 0.9 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7c.count | createdFrom/To = January 2026 – COUNT | 13 → 13 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.6 | Requests.IX_Requests_CreatedAt |
| Q7c.page | January 2026, page 1 x 20 | 70 → 70 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.1 → 0.3 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q8.status | summary: count by status | 439 → 442 | no → no | 1,040 → 1,040 | 1 → 1 | 10 → 20 | 10.5 → 21.0 | Requests.IX_Requests_AssignedTo_Status |
| Q8.priority | summary: count by priority | 2,427 → 2,427 | no → no | 1,040 → 1,040 | 1 → 1 | 18 → 26 | 18.8 → 26.6 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q8.orgs | summary: top 10 organizations by open requests | 897 → 898 | yes → yes | 1,728 → 1,728 | 1 → 1 | 22 → 20 | 23.3 → 21.1 | Requests.IX_Requests_Status_Priority_CreatedAt |
| Q9.history | history of request 12345 | 9 → 9 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.2 → 0.2 | RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt, RequestStatusHistory.PK_RequestStatusHistory |
| W1 | status change New -> InProgress (UPDATE + history INSERT, rolled back) | 24 → 24 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.8 → 1.1 | Requests.PK_Requests, Requests.IX_Requests_AssignedTo_Status, Requests.IX_Requests_Status_Priority_CreatedAt, RequestStatusHistory.PK_RequestStatusHistory, RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt |

W1 log bytes: 1,544 → 1,544; reads 24 → 24
Index count (Requests): 5 → 6; nonclustered KB (Requests): 30,736 → 40,480
