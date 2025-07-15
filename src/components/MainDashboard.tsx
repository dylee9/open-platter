'use client';

import { useState, useEffect } from 'react';
import TwitterConnector from './TwitterConnector';
import Scheduler from './Scheduler';
import { Loader2 } from 'lucide-react';
import AddContext from './AddContext';

interface TwitterUser {
  id: number;
  twitterUsername: string | null;
  twitterDisplayName: string | null;
}

export default function MainDashboard() {
  const [user, setUser] = useState<TwitterUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [schedulerRefresh, setSchedulerRefresh] = useState(0);

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
  }, []);

  const handleProfileUpdate = () => {
    fetchUser();
  };

  const handleSchedulerRefresh = () => {
    setSchedulerRefresh(prev => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl">
      <TwitterConnector />
      {user && user.twitterUsername ? (
        <div className="mt-8 space-y-6">
          <AddContext onSchedulerRefresh={handleSchedulerRefresh} />
          <Scheduler onUpdate={handleProfileUpdate} refreshTrigger={schedulerRefresh} />
        </div>
      ) : (
        <div className="mt-8 text-center p-8 bg-gray-50 rounded-lg border">
          <p className="text-gray-600">Please connect your Twitter account to access the scheduler.</p>
        </div>
      )}
    </div>
  );
} 