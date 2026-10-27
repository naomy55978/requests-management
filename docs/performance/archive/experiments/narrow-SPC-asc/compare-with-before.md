| Id | Statement | Reads before → experiments/narrow-SPC-asc | Sort | Grant KB | DOP | Elapsed ms | Client ms | Indexes (experiments/narrow-SPC-asc) |
|---|---|---|---|---|---|---|---|---|
| Q1.count | list: status IN (InProgress,Waiting) + priority=High – COUNT | 697 → 75 | yes → yes | 1,024 → 1,024 | 1 → 1 | 1 → 1 | 1.7 → 1.5 | Requests.IX_x_SPC |
| Q1.page | list: same filter, sort createdAt desc, page 1 x 20 | 779 → 779 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 1.0 → 0.6 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q1s.count | list: status=New + priority=High – COUNT | 44 → 8 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.2 | Requests.IX_x_SPC |
| Q1s.page | list: status=New + priority=High, sort createdAt desc, page 1 x 20 | 44 → 70 | yes → no | 6,656 → 0 | 1 → 1 | 0 → 0 | 0.9 → 0.3 | Requests.IX_x_SPC, Requests.PK_Requests |
| Q2.page | list: same filter, sort updatedAt desc, page 1 x 20 | 697 → 2,643 | yes → yes | 8,352 → 8,328 | 1 → 1 | 4 → 17 | 5.1 → 18.6 | Requests.PK_Requests |
| Q3.count | list: no filter – COUNT | 225 → 225 | no → no | 0 → 0 | 1 → 1 | 7 → 4 | 8.0 → 4.7 | Requests.IX_Requests_CreatedAt |
| Q3.page | list: no filter, sort createdAt desc, page 1 x 20 | 70 → 70 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.4 → 0.3 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q4.updated | list: no filter, sort updatedAt desc, page 1 x 20 | 2,547 → 2,776 | yes → yes | 79,440 → 79,440 | 10 → 10 | 49 → 60 | 50.4 → 63.8 | Requests.PK_Requests |
| Q4.priority | list: no filter, sort priority desc, page 1 x 20 | 2,547 → 2,776 | yes → yes | 79,440 → 79,440 | 10 → 10 | 58 → 56 | 59.2 → 56.9 | Requests.PK_Requests |
| Q4.status | list: no filter, sort status desc, page 1 x 20 | 2,547 → 2,776 | yes → yes | 79,440 → 79,440 | 10 → 10 | 59 → 52 | 59.6 → 52.7 | Requests.PK_Requests |
| Q4.title | list: no filter, sort title asc, page 1 x 20 | 2,547 → 2,776 | yes → yes | 79,440 → 79,440 | 10 → 10 | 89 → 99 | 89.8 → 99.9 | Requests.PK_Requests |
| Q5.created | deep page 1000 x 100, sort createdAt desc | 306,484 → 306,484 | no → no | 0 → 0 | 1 → 1 | 164 → 148 | 164.4 → 148.7 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q5.title | deep page 1000 x 100, sort title asc | 2,547 → 2,776 | yes → yes | 79,440 → 79,440 | 10 → 10 | 165 → 169 | 165.9 → 169.4 | Requests.PK_Requests |
| Q6.count | search=bonus (LIKE '%x%') – COUNT | 2,427 → 2,643 | no → no | 0 → 0 | 1 → 1 | 397 → 428 | 398.1 → 429.2 | Requests.PK_Requests |
| Q6.page | search=bonus, sort createdAt desc, page 1 x 20 | 1,638 → 1,638 | no → no | 0 → 0 | 1 → 1 | 1 → 3 | 1.9 → 3.4 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7a.count | assignedTo=adi.ezra – COUNT | 15 → 15 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.6 | Requests.IX_Requests_AssignedTo_Status |
| Q7a.page | assignedTo=adi.ezra, page 1 x 20 | 2,408 → 2,408 | no → no | 0 → 0 | 1 → 1 | 0 → 1 | 1.0 → 1.6 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7b.count | organization=Hermon (prefix) – COUNT | 49 → 49 | no → no | 0 → 0 | 1 → 1 | 1 → 2 | 1.3 → 2.3 | Requests.IX_Requests_OrganizationName |
| Q7b.page | organization=Hermon, page 1 x 20 | 580 → 580 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.6 → 0.8 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q7c.count | createdFrom/To = January 2026 – COUNT | 13 → 13 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.3 → 0.7 | Requests.IX_Requests_CreatedAt |
| Q7c.page | January 2026, page 1 x 20 | 70 → 70 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.1 → 0.3 | Requests.IX_Requests_CreatedAt, Requests.PK_Requests |
| Q8.status | summary: count by status | 439 → 250 | no → no | 1,040 → 0 | 1 → 1 | 10 → 13 | 10.5 → 13.8 | Requests.IX_x_SPC |
| Q8.priority | summary: count by priority | 2,427 → 250 | no → no | 1,040 → 1,040 | 1 → 1 | 18 → 20 | 18.8 → 20.9 | Requests.IX_x_SPC |
| Q8.orgs | summary: top 10 organizations by open requests | 897 → 842 | yes → yes | 1,728 → 11,952 | 1 → 1 | 22 → 51 | 23.3 → 51.6 | Requests.IX_x_SPC, Requests.IX_Requests_OrganizationName |
| Q9.history | history of request 12345 | 9 → 9 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.2 → 0.2 | RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt, RequestStatusHistory.PK_RequestStatusHistory |
| W1 | status change New -> InProgress (UPDATE + history INSERT, rolled back) | 24 → 22 | no → no | 0 → 0 | 1 → 1 | 0 → 0 | 0.8 → 1.4 | Requests.PK_Requests, Requests.IX_Requests_AssignedTo_Status, Requests.IX_x_SPC, RequestStatusHistory.PK_RequestStatusHistory, RequestStatusHistory.IX_RequestStatusHistory_RequestId_ChangedAt |

W1 log bytes: 1,544 → 1,176; reads 24 → 22
Index count (Requests): 5 → 5; nonclustered KB (Requests): 30,736 → 13,328
