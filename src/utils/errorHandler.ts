import { ValidationError, ProblemDetailsError, ApiErrorResponse } from '../types';

/**
 * Parses API error responses and returns a standardized error format.
 *
 * This function handles different types of error formats including validation errors,
 * problem details format (RFC 7807), and generic error objects. It extracts relevant
 * information such as messages, details, and type to provide a consistent error structure.
 *
 * @param response - The HTTP response object containing status and status text.
 * @param errorData - The raw error data from the API response.
 * @returns An object representing the standardized error format with message, details, and type.
 */
export function parseApiError(response: Response, errorData: any): ApiErrorResponse {
  // Handle validation errors (array format)
  if (Array.isArray(errorData)) {
    const validationErrors = errorData as ValidationError[];
    return {
      message: 'Validation failed',
      details: validationErrors.map(error => 
        `${error.propertyName}: ${error.errorMessage}`
      ),
      type: 'validation'
    };
  }

  // Handle problem details format (RFC 7807)
  if (errorData && typeof errorData === 'object' && errorData.type && errorData.errors) {
    const problemDetails = errorData as ProblemDetailsError;
    const details: string[] = [];
    
    Object.entries(problemDetails.errors).forEach(([field, messages]) => {
      messages.forEach(message => {
        // Clean up the field name (remove $. prefix)
        const cleanField = field.replace(/^\$\./, '');
        details.push(`${cleanField}: ${message}`);
      });
    });

    return {
      message: problemDetails.title || 'Validation error occurred',
      details,
      type: 'problem-details'
    };
  }

  // Handle generic error objects
  if (errorData && typeof errorData === 'object') {
    if (errorData.message) {
      return {
        message: errorData.message,
        details: errorData.details || [],
        type: 'generic'
      };
    }
    
    if (errorData.error) {
      return {
        message: errorData.error,
        details: [],
        type: 'generic'
      };
    }
  }

  // Fallback for unknown error formats
  return {
    message: `HTTP ${response.status}: ${response.statusText}`,
    details: errorData ? [JSON.stringify(errorData)] : [],
    type: 'generic'
  };
}

/**
 * Formats error details from an API response for display in the UI.
 *
 * This function constructs a formatted error message string based on the content of the `ApiErrorResponse`.
 * If there are no details, it returns just the error message.
 * If there is one detail, it appends the detail to the error message.
 * For multiple details, it lists each detail on a new line prefixed by a bullet point.
 *
 * @param apiError - The API error response containing the error message and details.
 */
export function formatErrorMessage(apiError: ApiErrorResponse): string {
  if (apiError.details.length === 0) {
    return apiError.message;
  }

  if (apiError.details.length === 1) {
    return `${apiError.message}: ${apiError.details[0]}`;
  }

  return `${apiError.message}:\n• ${apiError.details.join('\n• ')}`;
}

/**
 * Determines if an API error is a validation or problem-details error.
 */
export function isValidationError(apiError: ApiErrorResponse): boolean {
  return apiError.type === 'validation' || apiError.type === 'problem-details';
}