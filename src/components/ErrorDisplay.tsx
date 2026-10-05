import React from 'react';
import { AlertTriangle, X, Info } from 'lucide-react';
import type { ApiErrorResponse } from '../types';
import { isValidationError } from '../utils/errorHandler';

interface Props {
  error: ApiErrorResponse;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Pairs each detail with a stable key, numbering repeated details so keys stay unique.
 */
function withKeys(details: string[]): { key: string; detail: string }[] {
  const occurrences = new Map<string, number>();
  return details.map((detail) => {
    const occurrence = (occurrences.get(detail) ?? 0) + 1;
    occurrences.set(detail, occurrence);
    return { key: `${detail}#${occurrence}`, detail };
  });
}

/**
 * Component for displaying API errors with proper formatting and styling.
 *
 * This component determines whether the error is a validation error or a general error,
 * and renders an appropriate icon and styles accordingly. It displays the error message,
 * details, and provides an option to dismiss the error if `onDismiss` is provided.
 */
export default function ErrorDisplay({ error, onDismiss, className = '' }: Readonly<Props>) {
  const isValidation = isValidationError(error);
  
  /**
   * Returns an Info icon if validation is true, otherwise returns an AlertTriangle icon.
   */
  const getErrorIcon = () => {
    if (isValidation) {
      return <Info className="w-5 h-5 text-orange-500" />;
    }
    return <AlertTriangle className="w-5 h-5 text-red-500" />;
  };

  /**
   * Returns CSS styles based on validation status.
   */
  const getErrorStyles = () => {
    if (isValidation) {
      return 'bg-orange-50 border-orange-200 text-orange-800';
    }
    return 'bg-red-50 border-red-200 text-red-800';
  };

  return (
    <div className={`p-4 border rounded-md ${getErrorStyles()} ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getErrorIcon()}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">
            {error.message}
          </h3>
          {error.details.length > 0 && (
            <div className="mt-2">
              {error.details.length === 1 ? (
                <p className="text-sm">{error.details[0]}</p>
              ) : (
                <ul className="text-sm list-disc list-inside space-y-1">
                  {withKeys(error.details).map(({ key, detail }) => (
                    <li key={key}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {isValidation && (
            <p className="mt-2 text-xs opacity-75">
              Please correct the above issues and try again.
            </p>
          )}
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <button
              onClick={onDismiss}
              className="inline-flex rounded-md p-1.5 hover:bg-black hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-current"
            >
              <span className="sr-only">Dismiss</span>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}