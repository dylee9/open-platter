'use client';

import { useState } from 'react';
import { Upload, Bot, Send, Loader2, Trash2, Edit, Save, X } from 'lucide-react';

export default function TweetGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedTweets, setGeneratedTweets] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleGenerateTweets = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    setGeneratedTweets([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/generate-tweets', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate tweets.');
      }

      const data = await response.json();
      setGeneratedTweets(data.tweets);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTweet = (index: number) => {
    setGeneratedTweets((prev: string[]) => prev.filter((_: string, i: number) => i !== index));
  };

  const handleEditTweet = (index: number) => {
    setEditingIndex(index);
    setEditingText(generatedTweets[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const newTweets = [...generatedTweets];
    newTweets[editingIndex] = editingText;
    setGeneratedTweets(newTweets);
    setEditingIndex(null);
    setEditingText('');
  };

  const handleScheduleAll = async () => {
    if (generatedTweets.length === 0) {
      setError('No tweets to schedule.');
      return;
    }
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/scheduler/batch-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweets: generatedTweets }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to schedule tweets.');
      }

      const data = await response.json();
      setSuccess(`${data.count} tweets have been successfully scheduled for the next week!`);
      setGeneratedTweets([]);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Generate Tweets from Transcription</h3>
        
        {error && <p className="text-red-500 mb-4">{error}</p>}
        {success && <p className="text-green-500 mb-4">{success}</p>}

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex-1">
            <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
              Upload Transcription (.txt file)
            </label>
            <div className="flex items-center">
              <input id="file-upload" type="file" accept=".txt" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
            </div>
          </div>
          <button
            onClick={handleGenerateTweets}
            disabled={!file || isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Bot />}
            <span>{isLoading ? 'Generating...' : 'Generate Tweets'}</span>
          </button>
        </div>

        {generatedTweets.length > 0 && (
          <div className="mt-6">
            <h4 className="text-md font-medium text-gray-900 mb-2">Generated Tweets</h4>
            <div className="space-y-3">
              {generatedTweets.map((tweet, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg border flex flex-col sm:flex-row gap-2 justify-between">
                  {editingIndex === index ? (
                    <div className="flex-1">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                        rows={3}
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={handleSaveEdit} className="flex items-center space-x-1 px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm">
                          <Save size={14} /> <span>Save</span>
                        </button>
                        <button onClick={() => setEditingIndex(null)} className="flex items-center space-x-1 px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
                          <X size={14} /> <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-800 flex-1">{tweet}</p>
                  )}
                  <div className="flex gap-2 items-start">
                    <button onClick={() => handleEditTweet(index)} className="p-2 text-gray-400 hover:text-blue-600">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleRemoveTweet(index)} className="p-2 text-gray-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleScheduleAll}
                disabled={isLoading}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
                <span>Schedule All</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 