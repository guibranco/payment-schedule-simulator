import React from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useTokenManager } from '../hooks/useTokenManager';

/**
 * Component that displays the current token status and provides refresh functionality.
 * 
 * Shows different states: valid, expiring soon, expired, or refreshing.
 * Provides a manual refresh button and displays time until expiration.
 */
export default function TokenStatus() {
  const { tokenInfo, refreshToken, isRefreshing, error } = useTokenManager();

  if (!tokenInfo.accessToken) {
    return null;
  }

  const getStatusIcon = () => {
    if (isRefreshing) {
      return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
    }
    if (tokenInfo.isExpired) {
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    }
    if (tokenInfo.isExpiringSoon) {
      return <Clock className="w-4 h-4 text-yellow-500" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (isRefreshing) {
      return 'Refreshing token...';
    }
    if (tokenInfo.isExpired) {
      return 'Token expired';
    }
    if (tokenInfo.isExpiringSoon) {
      return 'Token expiring soon';
    }
    return 'Token valid';
  };

  const getTimeUntilExpiry = () => {
    if (!tokenInfo.expiresAt) return null;
    
    const now = Date.now();
    const timeLeft = tokenInfo.expiresAt - now;
    
    if (timeLeft <= 0) return 'Expired';
    
    const minutes = Math.floor(timeLeft / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const handleRefresh = () => {
    if (!isRefreshing) {
      refreshToken();
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-1">
        {getStatusIcon()}
        <span className={`${
          tokenInfo.isExpired ? 'text-red-600' : 
          tokenInfo.isExpiringSoon ? 'text-yellow-600' : 
          'text-green-600'
        }`}>
          {getStatusText()}
        </span>
      </div>
      
      {tokenInfo.expiresAt && (
        <span className="text-gray-500">
          ({getTimeUntilExpiry()})
        </span>
      )}
      
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
        title="Refresh token"
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>
      
      {error && (
        <div className="text-red-600 text-xs">
          {error}
        </div>
      )}
    </div>
  );
}