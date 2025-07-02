import { ValidationError, ProblemDetailsError, ApiErrorResponse } from '../types';

/**
 * Parses API error responses and returns a standardized error format
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
 * Formats error details for display in the UI
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
 * Checks if an error is a validation error that can be fixed by the user
 */
export function isValidationError(apiError: ApiErrorResponse): boolean {
  return apiError.type === 'validation' || apiError.type === 'problem-details';
}