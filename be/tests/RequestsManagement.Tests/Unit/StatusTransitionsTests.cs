using RequestsManagement.BL;
using RequestsManagement.DTO.Enums;

namespace RequestsManagement.Tests.Unit;

public class StatusTransitionsTests
{
    // The rules of D-05, written out by hand (not derived from the code under test): 6 allowed, 10 not allowed.
    // New -> InProgress, Waiting · InProgress -> Waiting, Completed · Waiting -> InProgress, Completed ·
    // Completed is final · a change to the same status is not a change.
    public static TheoryData<RequestStatus, RequestStatus, bool> AllSixteenCombinations() => new()
    {
        { RequestStatus.New, RequestStatus.New, false },
        { RequestStatus.New, RequestStatus.InProgress, true },
        { RequestStatus.New, RequestStatus.Waiting, true },
        { RequestStatus.New, RequestStatus.Completed, false },

        { RequestStatus.InProgress, RequestStatus.New, false },
        { RequestStatus.InProgress, RequestStatus.InProgress, false },
        { RequestStatus.InProgress, RequestStatus.Waiting, true },
        { RequestStatus.InProgress, RequestStatus.Completed, true },

        { RequestStatus.Waiting, RequestStatus.New, false },
        { RequestStatus.Waiting, RequestStatus.InProgress, true },
        { RequestStatus.Waiting, RequestStatus.Waiting, false },
        { RequestStatus.Waiting, RequestStatus.Completed, true },

        { RequestStatus.Completed, RequestStatus.New, false },
        { RequestStatus.Completed, RequestStatus.InProgress, false },
        { RequestStatus.Completed, RequestStatus.Waiting, false },
        { RequestStatus.Completed, RequestStatus.Completed, false }
    };

    [Theory]
    [MemberData(nameof(AllSixteenCombinations))]
    public void IsAllowed_MatchesTheTransitionMatrix(RequestStatus from, RequestStatus to, bool expected)
    {
        Assert.Equal(expected, StatusTransitions.IsAllowed(from, to));
    }

    [Fact]
    public void AllowedNext_AllowedPrevious_AndIsAllowed_AgreeForEveryCombination()
    {
        // The single update path checks the transition in the database with AllowedPrevious, and the answer to the
        // client lists AllowedNext. If these ever disagreed with IsAllowed, the API would contradict itself.
        var all = Enum.GetValues<RequestStatus>();
        foreach (var from in all)
        {
            foreach (var to in all)
            {
                var allowed = StatusTransitions.IsAllowed(from, to);
                Assert.Equal(allowed, StatusTransitions.AllowedNext(from).Contains(to));
                Assert.Equal(allowed, StatusTransitions.AllowedPrevious(to).Contains(from));
            }
        }

        Assert.Empty(StatusTransitions.AllowedPrevious(RequestStatus.New));   // nothing leads back to New
        Assert.Empty(StatusTransitions.AllowedNext(RequestStatus.Completed)); // Completed is final
    }
}
