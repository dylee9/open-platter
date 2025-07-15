'use client';

import { useState, useEffect } from 'react';
import { Twitter, Link, Unlink, Loader2 } from 'lucide-react';

interface TwitterUser {
  id: number;
  twitterUsername: string | null;
  twitterDisplayName: string | null;
}

export default function TwitterConnector() {
  const [user, setUser] = useState<TwitterUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchUser = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('twitter_connected') === 'true') {
      setSuccessMessage('Twitter account connected successfully!');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    const error = urlParams.get('error');
    if (error) {
      const reason = urlParams.get('reason');
      let errorMsg = 'Failed to connect Twitter account';
      if (reason === 'missing_params') errorMsg = 'Twitter authentication failed: Missing parameters';
      else if (reason === 'server_error') errorMsg = 'Twitter authentication failed: Server error';
      setErrorMessage(errorMsg);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleConnectTwitter = async () => {
    setIsConnecting(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/twitter/auth/start', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      } else {
        throw new Error('Failed to get Twitter auth URL');
      }
    } catch (error) {
      console.error('Failed to connect Twitter:', error);
      setErrorMessage('Failed to connect Twitter account');
      setIsConnecting(false);
    }
  };

  const handleDisconnectTwitter = async () => {
    if (!confirm('Are you sure you want to disconnect your Twitter account?')) return;
    setIsDisconnecting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await fetch('/api/user', { method: 'DELETE' });
      setUser(null);
      setSuccessMessage('Twitter account disconnected successfully.');
    } catch (error) {
      console.error('Failed to disconnect Twitter:', error);
      setErrorMessage('Failed to disconnect Twitter account');
    } finally {
      setIsDisconnecting(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Twitter className="text-blue-400" size={24} />
          <h3 className="text-lg font-medium text-gray-900">Twitter Connection</h3>
        </div>

        {successMessage && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
            <p className="text-sm text-green-800">✅ {successMessage}</p>
          </div>
        )}
        
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
            <p className="text-sm text-red-800">🚨 {errorMessage}</p>
          </div>
        )}
        
        {user && user.twitterUsername ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Link className="text-green-600" size={20} />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">
                  Connected as @{user.twitterUsername}
                </p>
                <p className="text-sm text-green-600">
                  {user.twitterDisplayName}
                </p>
              </div>
              <button
                onClick={handleDisconnectTwitter}
                disabled={isDisconnecting}
                className="flex items-center space-x-2 px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50"
              >
                {isDisconnecting ? <Loader2 className="animate-spin" size={14} /> : <Unlink size={14} />}
                <span>{isDisconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Connect your Twitter account to schedule posts.
              </p>
            </div>
            <button
              onClick={handleConnectTwitter}
              disabled={isConnecting}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <Twitter size={16} />
              <span>{isConnecting ? 'Connecting...' : 'Connect X Account'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 