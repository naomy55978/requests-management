using RequestsManagement.DAL.Seeding;

namespace RequestsManagement.Tests.Unit;

/// <summary>
/// The demo data has Hebrew titles and Hebrew and English organization names (D-33). These tests guard the limits
/// of the columns and the rules of the word lists; they need no database.
/// </summary>
public class SeedDataTests
{
    // Column sizes of the Requests table (see the entity configuration)
    private const int TitleMaxLength = 200;
    private const int OrganizationMaxLength = 150;

    private static bool IsHebrew(string text) => text.Length > 0 && text[0] is >= '֐' and <= '׿';

    [Fact]
    public void EveryCombinationOfTitleWordsFitsTheTitleColumn()
    {
        // Longest template (without its placeholder) + longest subject + longest context = longest possible title
        var longest = SeedWordLists.TitleTemplates.Max(t => t.Length - "{0}".Length)
                      + SeedWordLists.TitleSubjects.Max(s => s.Length)
                      + SeedWordLists.TitleContexts.Max(c => c.Length);

        Assert.True(longest <= TitleMaxLength, $"The longest possible title is {longest} characters");
    }

    [Fact]
    public void EveryCombinationOfOrganizationWordsFitsTheOrganizationColumn()
    {
        var longestPrefix = SeedWordLists.OrganizationPrefixes.Max(p => p.Length);
        var longestSector = Math.Max(
            SeedWordLists.OrganizationSectors.Max(s => s.Length),
            SeedWordLists.OrganizationSectorsHebrew.Max(s => s.Length));
        var longestSuffix = Math.Max(
            SeedWordLists.OrganizationSuffixes.Max(s => s.Length),
            SeedWordLists.OrganizationSuffixesHebrew.Max(s => s.Length));

        var longest = longestPrefix + 1 + longestSector + 1 + longestSuffix;  // two spaces

        Assert.True(longest <= OrganizationMaxLength, $"The longest possible organization name is {longest} characters");
    }

    [Fact]
    public void HebrewAndEnglishOrganizationWordsAreTheSameSizeAndTheirOrderMatches()
    {
        // Same sizes = the same random draws as the English-only data (D-33), so only the words changed
        Assert.Equal(SeedWordLists.OrganizationSectors.Length, SeedWordLists.OrganizationSectorsHebrew.Length);
        Assert.Equal(SeedWordLists.OrganizationSuffixes.Length, SeedWordLists.OrganizationSuffixesHebrew.Length);
        Assert.Equal(40, SeedWordLists.OrganizationPrefixes.Length);
        Assert.Equal(20, SeedWordLists.TitleTemplates.Length);
        Assert.Equal(30, SeedWordLists.TitleSubjects.Length);
        Assert.Equal(25, SeedWordLists.TitleContexts.Length);

        // Two different words must never become the same word, or the generator would draw again and the
        // random stream (and with it every other value) would differ from the English data
        Assert.Equal(SeedWordLists.OrganizationPrefixes.Length, SeedWordLists.OrganizationPrefixes.Distinct().Count());
        Assert.Equal(SeedWordLists.OrganizationSectorsHebrew.Length, SeedWordLists.OrganizationSectorsHebrew.Distinct().Count());
        Assert.Equal(SeedWordLists.OrganizationSuffixesHebrew.Length, SeedWordLists.OrganizationSuffixesHebrew.Distinct().Count());
    }

    [Fact]
    public void GeneratedRequestsHaveHebrewTitlesAndMixedOrganizationsThatNeverMixLanguages()
    {
        var data = SeedDataGenerator.Generate(5_000);

        Assert.All(data.Requests, r =>
        {
            Assert.True(IsHebrew(r.Title), $"Title is not Hebrew: {r.Title}");
            Assert.InRange(r.Title.Length, 1, TitleMaxLength);
            Assert.InRange(r.OrganizationName.Length, 1, OrganizationMaxLength);
        });

        var organizations = data.Requests.Select(r => r.OrganizationName).Distinct().ToList();
        var hebrew = organizations.Where(IsHebrew).ToList();
        var english = organizations.Where(o => !IsHebrew(o)).ToList();
        Assert.NotEmpty(hebrew);
        Assert.NotEmpty(english);

        // A Hebrew name has no Latin letter and an English name has no Hebrew letter
        Assert.All(hebrew, o => Assert.DoesNotContain(o, c => c is >= 'A' and <= 'Z' or >= 'a' and <= 'z'));
        Assert.All(english, o => Assert.DoesNotContain(o, c => c is >= '֐' and <= '׿'));
    }

    [Fact]
    public void TheSameCountAlwaysGivesExactlyTheSameRows()
    {
        var first = SeedDataGenerator.Generate(2_000);
        var second = SeedDataGenerator.Generate(2_000);

        Assert.Equal(
            first.Requests.Select(r => (r.Title, r.OrganizationName, r.Status, r.Priority, r.AssignedTo, r.CreatedAt)),
            second.Requests.Select(r => (r.Title, r.OrganizationName, r.Status, r.Priority, r.AssignedTo, r.CreatedAt)));
    }
}
