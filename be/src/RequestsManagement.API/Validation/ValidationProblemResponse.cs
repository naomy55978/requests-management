using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace RequestsManagement.API.Validation;

/// <summary>
/// Builds the 400 answer for invalid input (D-18): the usual ValidationProblemDetails, but with keys that are plain
/// field names ("newStatus", "items[0].id", or "body" for the body as a whole) and messages that a client can show.
/// </summary>
/// <remarks>
/// Without this, a body that System.Text.Json cannot read is reported under its JSON path ("$.newStatus") with the
/// serializer's message, which names .NET types ("could not be converted to System.Nullable`1[...RequestStatus]").
/// Program.cs turns those messages off (AllowInputFormatterExceptionMessages = false), so the JsonException itself
/// is kept in the model state and is translated here. Errors from validation attributes and query binding already
/// have a field name and a readable message; they are passed through unchanged.
/// </remarks>
internal static class ValidationProblemResponse
{
    /// <summary>Key of an error that concerns the whole body (missing, not JSON, not an object).</summary>
    public const string BodyKey = "body";

    // System.Text.Json has no exception type for an unknown property (UnmappedMemberHandling.Disallow), only this
    // message. Its messages are not localized; the integration tests fail if the text ever changes.
    private const string UnmappedMemberMessage = "could not be mapped to any .NET member";

    /// <summary>Builds the 400 ValidationProblemDetails from the model state, with every error rewritten by <see cref="Describe"/>.</summary>
    public static IActionResult Create(ActionContext context)
    {
        var errors = new ModelStateDictionary();
        foreach (var (key, entry) in context.ModelState)
        {
            foreach (var error in entry.Errors)
            {
                var (field, message) = Describe(key, error);
                errors.AddModelError(field, message);
            }
        }

        var factory = context.HttpContext.RequestServices.GetRequiredService<ProblemDetailsFactory>();
        var problem = factory.CreateValidationProblemDetails(context.HttpContext, errors);
        return new BadRequestObjectResult(problem) { ContentTypes = { "application/problem+json" } };
    }

    /// <summary>Turns one model-state error into a plain field name and a message a client can show, translating serializer errors.</summary>
    private static (string Field, string Message) Describe(string key, ModelError error)
    {
        var field = FieldName(key);
        if (error.Exception is not JsonException json)
        {
            return (field, string.IsNullOrEmpty(error.ErrorMessage) ? $"The value of '{field}' is not valid." : error.ErrorMessage);
        }

        // The body is not JSON at all: the reader's own exception (also a JsonException) is the inner one.
        // Its path only tells where reading stopped, so the error belongs to the body, not to that field.
        if (json.InnerException is JsonException)
        {
            return (BodyKey, "The request body is not valid JSON.");
        }

        if (field == BodyKey)
        {
            return (BodyKey, "The request body must be a JSON object.");
        }

        return json.Message.Contains(UnmappedMemberMessage, StringComparison.Ordinal)
            ? (field, $"'{field}' is not a known field.")
            : (field, $"The value of '{field}' is not valid.");
    }

    // "$.items[0].id" -> "items[0].id"; "$" and "" (the body itself) -> "body"
    private static string FieldName(string key)
    {
        var field = key.StartsWith("$.", StringComparison.Ordinal) ? key[2..] : key == "$" ? "" : key;
        return field.Length == 0 ? BodyKey : field;
    }
}
