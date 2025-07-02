import React from 'react';
import { AlertTriangle, X, Info } from 'lucide-react';
import { ApiErrorResponse, isValidationError } from '../utils/errorHandler';

interface Props {
  error: ApiErrorResponse;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Component for displaying API errors with proper formatting and styling
 */
export default function ErrorDisplay({ error, onDismiss, className = '' }: Props) {
  const isValidation = isValidationError(error);
  
  const getErrorIcon = () => {
    if (isValidation) {
      return <Info className="w-5 h-5 text-orange-500" />;
    }
    return <AlertTriangle className="w-5 h-5 text-red-500" />;
  };

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
                  {error.details.map((detail, index) => (
                    <li key={index}>{detail}</li>
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