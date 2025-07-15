'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Bot, Send, Loader2, Trash2, Edit, Save, X, FileText, FileImage, Settings } from 'lucide-react';

interface SystemPrompt {
  id: number;
  name: string;
  prompt: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

type ContextType = 'transcription' | 'document';

interface AddContextProps {
  onSchedulerRefresh?: () => void;
}

export default function AddContext({ onSchedulerRefresh }: AddContextProps) {
  const [file, setFile] = useState<File | null>(null);
  const [contextType, setContextType] = useState<ContextType>('transcription');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [showPromptManagement, setShowPromptManagement] = useState(false);
  const [newPromptName, setNewPromptName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedTweets, setGeneratedTweets] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState('');

  // Ref to preserve scroll position during updates
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Default system prompt from route.ts
  const DEFAULT_SYSTEM_PROMPT = `You are an expert tweet writer.
Based on the provided transcription of a conversation, generate a list of 5-10 potential tweets.
The tweets should be engaging, concise, and relevant to the key topics in the conversation.
Each tweet must be 280 characters or less.
Return the tweets as a JSON array of strings. For example: ["This is a tweet.", "This is another tweet."].
Do not include any other text or explanation in your response, only the JSON array.`;

  useEffect(() => {
    fetchSystemPrompts();
  }, []);

  useEffect(() => {
    // Set default system prompt if none is selected
    if (systemPrompts.length > 0 && !selectedPromptId) {
      const defaultPrompt = systemPrompts.find(p => p.isDefault);
      if (defaultPrompt) {
        setSelectedPromptId(defaultPrompt.id);
        setSystemPrompt(defaultPrompt.prompt);
        setOriginalPrompt(defaultPrompt.prompt);
      } else {
        setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
        setOriginalPrompt(DEFAULT_SYSTEM_PROMPT);
      }
    }
  }, [systemPrompts, selectedPromptId]);

  const fetchSystemPrompts = async () => {
    try {
      const response = await fetch('/api/system-prompts');
      if (response.ok) {
        const prompts = await response.json();
        setSystemPrompts(prompts);
      }
    } catch (error) {
      console.error('Error fetching system prompts:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleContextTypeChange = (type: ContextType) => {
    setContextType(type);
    setFile(null); // Reset file when changing context type
  };

  const handlePromptChange = (promptId: number) => {
    const prompt = systemPrompts.find(p => p.id === promptId);
    if (prompt) {
      setSelectedPromptId(promptId);
      setSystemPrompt(prompt.prompt);
      setOriginalPrompt(prompt.prompt);
      setHasUnsavedChanges(false);
    }
  };

  const handleSavePrompt = async () => {
    if (!newPromptName.trim() || !systemPrompt.trim()) {
      setError('Please provide both name and prompt content.');
      return;
    }

    try {
      const response = await fetch('/api/system-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPromptName,
          prompt: systemPrompt,
          isDefault: systemPrompts.length === 0, // Set as default if it's the first one
        }),
      });

      if (response.ok) {
        const newPrompt = await response.json();
        setSystemPrompts([newPrompt, ...systemPrompts]);
        setSelectedPromptId(newPrompt.id);
        setNewPromptName('');
        setHasUnsavedChanges(false);
        setOriginalPrompt(systemPrompt);
        setError('');
        setSuccess('System prompt saved successfully!');
      } else {
        throw new Error('Failed to save system prompt');
      }
    } catch (error) {
      setError('Failed to save system prompt. Please try again.');
    }
  };

  const handleGenerateTweets = async () => {
    if (!systemPrompt.trim()) {
      setError('Please provide a system prompt.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    setGeneratedTweets([]);

    try {
      let contextContent = '';
      
      if (file) {
        contextContent = await file.text();
      } else {
        // If no file, we could allow direct text input in the future
        setError('Please select a file or provide context.');
        return;
      }

      const response = await fetch('/api/generate-tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contextContent,
          contextType: contextType,
          systemPrompt: systemPrompt,
        }),
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

  const handleRemoveTweet = useCallback((index: number) => {
    setGeneratedTweets((prev: string[]) => prev.filter((_: string, i: number) => i !== index));
  }, []);

  const handleEditTweet = useCallback((index: number) => {
    setEditingIndex(index);
    setEditingText(generatedTweets[index]);
  }, [generatedTweets]);

  const handleCancelEdit = useCallback(() => {
    // Save current scroll position
    const scrollContainer = scrollContainerRef.current || document.documentElement;
    const scrollTop = scrollContainer.scrollTop;
    const scrollLeft = scrollContainer.scrollLeft;
    
    // Cancel the edit
    setEditingIndex(null);
    setEditingText('');
    
    // Restore scroll position after the next render
    requestAnimationFrame(() => {
      scrollContainer.scrollTop = scrollTop;
      scrollContainer.scrollLeft = scrollLeft;
    });
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null) return;
    
    // Save current scroll position
    const scrollContainer = scrollContainerRef.current || document.documentElement;
    const scrollTop = scrollContainer.scrollTop;
    const scrollLeft = scrollContainer.scrollLeft;
    
    // Save focus information
    const activeElement = document.activeElement;
    const focusedElementId = activeElement?.id;
    const focusedElementTag = activeElement?.tagName.toLowerCase();
    
    // Update the tweet
    const newTweets = [...generatedTweets];
    newTweets[editingIndex] = editingText;
    setGeneratedTweets(newTweets);
    setEditingIndex(null);
    setEditingText('');
    
    // Restore scroll position after the next render
    requestAnimationFrame(() => {
      // Restore scroll position
      scrollContainer.scrollTop = scrollTop;
      scrollContainer.scrollLeft = scrollLeft;
      
      // Try to restore focus if it was on a specific element
      if (focusedElementId) {
        const elementToFocus = document.getElementById(focusedElementId);
        if (elementToFocus) {
          elementToFocus.focus();
        }
      } else if (focusedElementTag === 'button') {
        // If focus was on a button, try to find the edit button for the same index
        const editButton = document.querySelector(`button[data-edit-index="${editingIndex}"]`) as HTMLButtonElement;
        if (editButton) {
          editButton.focus();
        }
      }
    });
  }, [editingIndex, editingText, generatedTweets]);

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
      onSchedulerRefresh?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getFileAcceptTypes = () => {
    switch (contextType) {
      case 'transcription':
        return '.txt';
      case 'document':
        return '.txt,.md,.pdf,.doc,.docx';
      default:
        return '*';
    }
  };

  const getContextIcon = (type: ContextType) => {
    switch (type) {
      case 'transcription':
        return <FileText size={20} />;
      case 'document':
        return <FileImage size={20} />;
      default:
        return <FileText size={20} />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Add Context</h3>
        
        {error && <p className="text-red-500 mb-4">{error}</p>}
        {success && <p className="text-green-500 mb-4">{success}</p>}

        {/* Context Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Context Type
          </label>
          <div className="flex flex-wrap gap-2">
            {(['transcription', 'document'] as ContextType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleContextTypeChange(type)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                  contextType === type
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {getContextIcon(type)}
                <span className="capitalize">{type}</span>
              </button>
            ))}
          </div>
        </div>

        {/* File Upload Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload File (Optional)
          </label>
          <div className="flex items-center">
            <input
              id="file-upload"
              type="file"
              accept={getFileAcceptTypes()}
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          {file && (
            <p className="text-sm text-gray-600 mt-2">
              Selected: {file.name}
            </p>
          )}
        </div>

        {/* System Prompt Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              System Prompt
            </label>
          </div>
          
          {systemPrompts.length > 0 && (
            <div className="mb-2">
              <select
                value={selectedPromptId || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'clear') {
                    setSelectedPromptId(null);
                    setSystemPrompt('');
                    setOriginalPrompt('');
                    setHasUnsavedChanges(false);
                  } else {
                    handlePromptChange(parseInt(value));
                  }
                }}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a saved prompt...</option>
                <option value="clear">Clear prompt</option>
                {systemPrompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.name} {prompt.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <textarea
            value={systemPrompt}
            onChange={(e) => {
              setSystemPrompt(e.target.value);
              setHasUnsavedChanges(e.target.value !== originalPrompt);
            }}
            placeholder="Enter your system prompt here..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
          />

          {hasUnsavedChanges && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Save Current Prompt</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPromptName}
                  onChange={(e) => setNewPromptName(e.target.value)}
                  placeholder="Prompt name..."
                  className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleSavePrompt}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Generate Button */}
        <div className="flex justify-end">
          <button
            onClick={handleGenerateTweets}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Bot />}
            <span>{isLoading ? 'Generating...' : 'Generate Tweets'}</span>
          </button>
        </div>

        {/* Generated Tweets */}
        {generatedTweets.length > 0 && (
          <div className="mt-6" ref={scrollContainerRef}>
            <h4 className="text-md font-medium text-gray-900 mb-2">Generated Tweets</h4>
            <div className="space-y-3">
              {generatedTweets.map((tweet, index) => (
                <div key={`tweet-${index}`} className="p-3 bg-gray-50 rounded-lg border flex flex-col sm:flex-row gap-2 justify-between">
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
                        <button onClick={handleCancelEdit} className="flex items-center space-x-1 px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
                          <X size={14} /> <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-800 flex-1">{tweet}</p>
                  )}
                  <div className="flex gap-2 items-start">
                    <button 
                      onClick={() => handleEditTweet(index)} 
                      className="p-2 text-gray-400 hover:text-blue-600"
                      data-edit-index={index}
                    >
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