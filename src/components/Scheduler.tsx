'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Edit, Trash2, Send, Smile, ImageIcon, X, Save, Tag, Clock3, CheckCircle, XCircle, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { MdOutlineGifBox } from "react-icons/md";
import EmojiPicker, { EmojiClickData, EmojiStyle, Theme } from 'emoji-picker-react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';
import type { IGif } from '@giphy/js-types';
import { debugLog } from '@/lib/debug';

// Add Giphy API instance
const gf = new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY || 'Z55hb07b4WYoQIxlvid8g0vR2lyjh0MB');

interface ScheduledPost {
  id: string;
  text: string;
  media_ids: string[];
  communityId?: string;
  scheduledTime: string;
  status: 'scheduled' | 'posted' | 'failed' | 'cancelled';
  twitter_post_id?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface CommunityTag {
  id: string;
  tagName: string;
  communityId: string;
  communityName?: string;
  createdAt: string;
  updatedAt: string;
}

interface SchedulerProps {
  onUpdate?: () => void;
}

// Helper function to get the start of the week (Monday)
const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

// Helper function to get the start of the week from today
const getWeekStartFromToday = (date: Date) => {
  const today = new Date();
  const d = new Date(date);
  
  // If the provided date is today or in the future, start from today
  // Otherwise, start from the provided date
  const startDate = d >= today ? today : d;
  
  return new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
};

// Helper function to safely parse date from input
const parseDateInput = (dateString: string) => {
  if (!dateString) return null;
  // Parse as YYYY-MM-DD format and create date in local timezone
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // Month is 0-indexed
};

// Helper function to format date for date input
const formatDateForInput = (date: Date | null) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to check if a date is in the past
const isDateInPast = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate < today;
};

// Helper function to check if a datetime is in the past
const isDateTimeInPast = (date: Date, time: string) => {
  const now = new Date();
  const scheduledDateTime = new Date(date);
  const [hours, minutes] = time.split(':').map(Number);
  scheduledDateTime.setHours(hours, minutes, 0, 0);
  return scheduledDateTime < now;
};

// Helper function to format date for display
const formatDateForDisplay = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

// Helper function to format time for display
const formatTimeForDisplay = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function Scheduler({ onUpdate }: SchedulerProps) {
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [communityTags, setCommunityTags] = useState<CommunityTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  const [showManageTags, setShowManageTags] = useState(false);
  
  // Form states
  const [postText, setPostText] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedCommunityTag, setSelectedCommunityTag] = useState('');
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [attachedGifs, setAttachedGifs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UI states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearchTerm, setGifSearchTerm] = useState('');
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [dateTimeError, setDateTimeError] = useState<string>('');
  
  // Tag management states
  const [newTagName, setNewTagName] = useState('');
  const [newCommunityId, setNewCommunityId] = useState('');
  const [newCommunityName, setNewCommunityName] = useState('');
  const [isSavingTag, setIsSavingTag] = useState(false);
  
  // Create preview URLs when images are attached
  useEffect(() => {
    const urls = attachedImages.map(file => URL.createObjectURL(file));
    setImagePreviewUrls(urls);

    // Cleanup function to revoke URLs when component unmounts or images change
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [attachedImages]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchScheduledPosts(), fetchCommunityTags()]);
    } catch (error) {
      debugLog.error('Error fetching scheduler data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledPosts = async () => {
    try {
      const response = await fetch('/api/scheduler/posts');
      if (response.ok) {
        const posts = await response.json();
        setScheduledPosts(posts);
      }
    } catch (error) {
      debugLog.error('Error fetching scheduled posts:', error);
    }
  };

  const fetchCommunityTags = async () => {
    try {
      const response = await fetch('/api/scheduler/tags');
      if (response.ok) {
        const tags = await response.json();
        setCommunityTags(tags);
      }
    } catch (error) {
      debugLog.error('Error fetching community tags:', error);
    }
  };

  // Generate week view
  const generateWeekDays = () => {
    const weekStart = getWeekStartFromToday(currentWeek);
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    
    return days;
  };

  const weekDays = generateWeekDays();

  // Get posts for a specific date
  const getPostsForDate = (date: Date) => {
    const dateString = date.toDateString();
    return scheduledPosts.filter(post => {
      const postDate = new Date(post.scheduledTime);
      return postDate.toDateString() === dateString;
    });
  };

  const handlePreviousWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() - 7);
    setCurrentWeek(newWeek);
  };

  const handleNextWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + 7);
    setCurrentWeek(newWeek);
  };

  const handleCreatePost = (date?: Date) => {
    const targetDate = date || selectedDate || new Date();
    const now = new Date();
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    setSelectedDate(targetDate);
    setSelectedTime(defaultTime);
    setShowCreateForm(true);
    setEditingPost(null);
    resetForm();
  };

  const handleEditPost = (post: ScheduledPost) => {
    setEditingPost(post);
    setPostText(post.text);
    const postDate = new Date(post.scheduledTime);
    setSelectedDate(new Date(postDate.getFullYear(), postDate.getMonth(), postDate.getDate()));
    setSelectedTime(postDate.toTimeString().slice(0, 5));
    
    // Find the community tag for this post
    const communityTag = communityTags.find(tag => tag.communityId === post.communityId);
    setSelectedCommunityTag(communityTag?.tagName || '');
    
    setShowCreateForm(true);
    resetAttachments();
  };

  const resetForm = () => {
    setPostText('');
    setSelectedTime('');
    setSelectedCommunityTag('');
    setDateTimeError('');
    resetAttachments();
  };

  const resetAttachments = () => {
    setAttachedImages([]);
    setAttachedGifs([]);
    setShowEmojiPicker(false);
    setShowGifPicker(false);
    setGifSearchTerm('');
  };

  const validateDateTime = (date: Date | null, time: string) => {
    if (!date || !time) {
      setDateTimeError('');
      return true;
    }
    
    if (isDateTimeInPast(date, time)) {
      setDateTimeError('Cannot schedule posts in the past. Please select a future date and time.');
      return false;
    }
    
    setDateTimeError('');
    return true;
  };

  const handleSubmitPost = async () => {
    if (!postText.trim() || !selectedDate || !selectedTime) return;
    
    // Check if scheduled time is in the past
    if (isDateTimeInPast(selectedDate, selectedTime)) {
      setDateTimeError('Cannot schedule posts in the past. Please select a future date and time.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const scheduledDateTime = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':');
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      // Find community ID from selected tag
      const selectedTag = communityTags.find(tag => tag.tagName === selectedCommunityTag);
      
      const formData = new FormData();
      formData.append('text', postText);
      formData.append('scheduled_time', scheduledDateTime.toISOString());
      if (selectedTag) {
        formData.append('community_id', selectedTag.communityId);
      }
      
      // Add attached images
      attachedImages.forEach(file => {
        formData.append('files', file);
      });

      // Download and add attached GIFs
      for (const gifUrl of attachedGifs) {
        try {
          const response = await fetch(gifUrl);
          const blob = await response.blob();
          const file = new File([blob], `gif_${Date.now()}.gif`, { type: 'image/gif' });
          formData.append('files', file);
        } catch (error) {
          debugLog.error('Error processing GIF:', error);
        }
      }

      const url = editingPost 
        ? `/api/scheduler/posts/${editingPost.id}`
        : '/api/scheduler/posts';
      
      const method = editingPost ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        body: formData,
      });

      if (response.ok) {
        await fetchScheduledPosts();
        setShowCreateForm(false);
        resetForm();
        onUpdate?.();
      } else {
        throw new Error('Failed to save post');
      }
    } catch (error) {
      debugLog.error('Error saving post:', error);
      alert('Failed to save post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled post?')) return;
    
    try {
      const response = await fetch(`/api/scheduler/posts/${postId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchScheduledPosts();
        onUpdate?.();
      } else {
        throw new Error('Failed to delete post');
      }
    } catch (error) {
      debugLog.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    }
  };

  const handleSaveTag = async () => {
    if (!newTagName.trim() || !newCommunityId.trim()) return;
    
    setIsSavingTag(true);
    
    try {
      const response = await fetch('/api/scheduler/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tag_name: newTagName,
          community_id: newCommunityId,
          community_name: newCommunityName || undefined,
        }),
      });

      if (response.ok) {
        await fetchCommunityTags();
        setNewTagName('');
        setNewCommunityId('');
        setNewCommunityName('');
        setShowManageTags(false);
      } else {
        throw new Error('Failed to save tag');
      }
    } catch (error) {
      debugLog.error('Error saving tag:', error);
      alert('Failed to save tag. Please try again.');
    } finally {
      setIsSavingTag(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Are you sure you want to delete this tag?')) return;
    
    try {
      const response = await fetch(`/api/scheduler/tags/${tagId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchCommunityTags();
      } else {
        throw new Error('Failed to delete tag');
      }
    } catch (error) {
      debugLog.error('Error deleting tag:', error);
      alert('Failed to delete tag. Please try again.');
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setPostText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleImageAttach = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const imageFiles = Array.from(files).filter(file => 
        file.type.startsWith('image/') && file.type !== 'image/gif'
      );
      
      const currentImageCount = attachedImages.filter(f => f.type !== 'image/gif').length;
      const availableSlots = 4 - currentImageCount;
      const allowedNewFiles = imageFiles.slice(0, availableSlots);
      
      if (imageFiles.length > availableSlots) {
        alert(`You can only attach up to 4 images. ${imageFiles.length - availableSlots} files were not added.`);
      }
      
      setAttachedImages(prev => [...prev, ...allowedNewFiles]);
    }
  };

  const handleGifSelect = async (gif: IGif, e: React.SyntheticEvent) => {
    e.preventDefault();
    
    if (attachedGifs.length >= 1) {
      alert('You can only attach 1 GIF at a time.');
      return;
    }
    
    const gifUrl = gif.images.original.url;
    setAttachedGifs(prev => [...prev, gifUrl]);
    setShowGifPicker(false);
  };

  const removeAttachedImage = (index: number) => {
    if (imagePreviewUrls[index]) {
      URL.revokeObjectURL(imagePreviewUrls[index]);
    }
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeAttachedGif = (index: number) => {
    setAttachedGifs(prev => prev.filter((_, i) => i !== index));
  };

  const fetchGifs = (offset: number) => {
    if (gifSearchTerm.trim()) {
      return gf.search(gifSearchTerm, { offset, limit: 10 });
    } else {
      return gf.trending({ offset, limit: 10 });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'posted': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Clock3 size={14} />;
      case 'posted': return <CheckCircle size={14} />;
      case 'failed': return <XCircle size={14} />;
      case 'cancelled': return <X size={14} />;
      default: return <Clock3 size={14} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
        <span className="ml-3 text-gray-600">Loading scheduler...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div></div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowManageTags(true)}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors w-full sm:w-auto"
          >
            <Tag size={16} />
            <span>Manage Tags</span>
          </button>
          <button
            onClick={() => handleCreatePost()}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>Create Post</span>
          </button>
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Calendar Header */}
        <div className="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-lg font-medium text-gray-900">
              Week of {formatDateForDisplay(weekDays[0])}
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePreviousWeek}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-colors"
              >
                ←
              </button>
              <button
                onClick={() => setCurrentWeek(new Date())}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleNextWeek}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-colors"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid - Mobile: Single column, Desktop: 7 columns */}
        <div className="block sm:hidden">
          {/* Mobile View - Stack days vertically */}
          <div className="divide-y divide-gray-200">
            {weekDays.map((day, index) => {
              const dayPosts = getPostsForDate(day);
              const isToday = day.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={index}
                  className={`p-4 ${isToday ? 'bg-blue-50' : 'bg-white'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`text-base font-medium ${
                      isToday ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {day.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    <button
                      onClick={() => handleCreatePost(day)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Add post"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  
                  {/* Posts for this day */}
                  {dayPosts.length > 0 ? (
                    <div className="space-y-2">
                      {dayPosts.map((post) => (
                        <div
                          key={post.id}
                          className="group relative p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-700 text-sm">
                              {formatTimeForDisplay(post.scheduledTime)}
                            </span>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditPost(post);
                                }}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePost(post.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          
                          <div className="text-gray-600 mb-2 text-sm leading-relaxed">
                            {post.text.length > 80 ? `${post.text.slice(0, 80)}...` : post.text}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${getStatusColor(post.status)}`}>
                              {getStatusIcon(post.status)}
                              <span className="capitalize">{post.status}</span>
                            </div>
                            {post.media_ids && post.media_ids.length > 0 && (
                              <div className="text-gray-400 text-xs">
                                📎 {post.media_ids.length}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No posts scheduled
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop View - 7 column grid */}
        <div className="hidden sm:block">
          <div className="grid grid-cols-7 gap-0">
            {weekDays.map((day, index) => {
              const dayPosts = getPostsForDate(day);
              const isToday = day.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={index}
                  className={`min-h-32 border-r border-b border-gray-200 p-2 ${
                    isToday ? 'bg-blue-50' : 'bg-white'
                  } last:border-r-0`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`text-sm font-medium ${
                      isToday ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {formatDateForDisplay(day)}
                    </div>
                    <button
                      onClick={() => handleCreatePost(day)}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Add post"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  
                  {/* Posts for this day */}
                  <div className="space-y-1">
                    {dayPosts.map((post) => (
                      <div
                        key={post.id}
                        className="group relative p-2 bg-gray-50 rounded border text-xs hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-700">
                            {formatTimeForDisplay(post.scheduledTime)}
                          </span>
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPost(post);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePost(post.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="text-gray-600 mb-1 line-clamp-2">
                          {post.text.length > 50 ? `${post.text.slice(0, 50)}...` : post.text}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs ${getStatusColor(post.status)}`}>
                            {getStatusIcon(post.status)}
                            <span className="capitalize">{post.status}</span>
                          </div>
                          {post.media_ids && post.media_ids.length > 0 && (
                            <div className="text-gray-400">
                              📎 {post.media_ids.length}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Create/Edit Post Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPost ? 'Edit Scheduled Post' : 'Create Scheduled Post'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Post Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Post Content
                </label>
                <div className="space-y-0">
                  <textarea
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="What's happening?"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                    maxLength={280}
                  />
                  
                  {/* Character count and tools */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 px-1">
                    <div className="flex items-center space-x-1 order-2 sm:order-1">
                      {/* Emoji Button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
                          title="Add emoji"
                        >
                          <Smile size={18} />
                        </button>
                        
                        {showEmojiPicker && (
                          <div className="absolute bottom-full left-0 mb-2 z-20">
                            <EmojiPicker
                              onEmojiClick={(emoji: EmojiClickData) => handleEmojiSelect(emoji.emoji)}
                              emojiStyle={EmojiStyle.NATIVE}
                              theme={Theme.LIGHT}
                              searchPlaceHolder="Search emojis..."
                              lazyLoadEmojis={true}
                              previewConfig={{
                                showPreview: false
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* GIF Button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setGifSearchTerm('');
                            setShowGifPicker(!showGifPicker);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
                          title="Add GIF"
                          disabled={attachedGifs.length >= 1}
                        >
                          <MdOutlineGifBox size={20} />
                        </button>
                        
                        {showGifPicker && (
                          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-lg p-4 w-full max-w-sm sm:max-w-md h-96 overflow-hidden">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Choose a GIF</h3>
                                <button
                                  onClick={() => setShowGifPicker(false)}
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                              
                              <div className="mb-4">
                                <input
                                  type="text"
                                  placeholder="Search GIFs..."
                                  value={gifSearchTerm}
                                  onChange={(e) => setGifSearchTerm(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                              
                              <div className="overflow-auto" style={{ height: 'calc(100% - 120px)' }}>
                                <Grid
                                  key={gifSearchTerm}
                                  width={280}
                                  columns={2}
                                  fetchGifs={fetchGifs}
                                  onGifClick={handleGifSelect}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Image Button */}
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageAttach}
                          className="hidden"
                          id="image-upload-scheduler"
                        />
                        <label
                          htmlFor="image-upload-scheduler"
                          className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors cursor-pointer inline-flex"
                          title="Attach image"
                        >
                          <ImageIcon size={18} />
                        </label>
                      </div>
                    </div>

                    <div className="text-sm text-gray-500 order-1 sm:order-2">
                      {postText.length}/280
                    </div>
                  </div>
                </div>
              </div>

              {/* Attached Images */}
              {attachedImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Attached Images:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {attachedImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={imagePreviewUrls[index]}
                          alt={`Attached image ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => removeAttachedImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80 hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attached GIFs */}
              {attachedGifs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Attached GIFs:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {attachedGifs.map((gifUrl, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={gifUrl}
                          alt={`Attached GIF ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => removeAttachedGif(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80 hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Date and Time */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formatDateForInput(selectedDate)}
                      onChange={(e) => {
                        const newDate = parseDateInput(e.target.value);
                        setSelectedDate(newDate);
                        validateDateTime(newDate, selectedTime);
                      }}
                      min={formatDateForInput(new Date())}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time
                    </label>
                    <input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => {
                        setSelectedTime(e.target.value);
                        validateDateTime(selectedDate, e.target.value);
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                
                {/* Date/Time Error Message */}
                {dateTimeError && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    {dateTimeError}
                  </div>
                )}
              </div>

              {/* Community Tag */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Community (Optional)
                </label>
                <select
                  value={selectedCommunityTag}
                  onChange={(e) => setSelectedCommunityTag(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a community...</option>
                  {communityTags.map((tag) => (
                    <option key={tag.id} value={tag.tagName}>
                      {tag.tagName} {tag.communityName && `(${tag.communityName})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitPost}
                  disabled={!postText.trim() || !selectedDate || !selectedTime || isSubmitting || !!dateTimeError}
                  className="flex items-center justify-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  <span>{isSubmitting ? 'Saving...' : editingPost ? 'Update Post' : 'Schedule Post'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Tags Modal */}
      {showManageTags && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Manage Community Tags</h3>
              <button
                onClick={() => setShowManageTags(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            {/* Add New Tag */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Add New Tag</h4>
              <div className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Tag name (e.g., 'Web3', 'AI News')"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={newCommunityId}
                    onChange={(e) => setNewCommunityId(e.target.value)}
                    placeholder="Community ID (from X/Twitter)"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={newCommunityName}
                    onChange={(e) => setNewCommunityName(e.target.value)}
                    placeholder="Community name (optional)"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleSaveTag}
                  disabled={!newTagName.trim() || !newCommunityId.trim() || isSavingTag}
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 w-full sm:w-auto"
                >
                  {isSavingTag ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  <span>{isSavingTag ? 'Saving...' : 'Add Tag'}</span>
                </button>
              </div>
            </div>

            {/* Existing Tags */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Existing Tags</h4>
              {communityTags.length === 0 ? (
                <p className="text-gray-500 text-sm">No tags created yet.</p>
              ) : (
                <div className="space-y-2">
                  {communityTags.map((tag) => (
                    <div key={tag.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-gray-50 rounded-lg gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{tag.tagName}</div>
                        <div className="text-sm text-gray-500">
                          ID: {tag.communityId}
                          {tag.communityName && ` • ${tag.communityName}`}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="text-red-600 hover:text-red-800 transition-colors self-end sm:self-center"
                        title="Delete tag"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Posts History */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Scheduled Posts History</h3>
        </div>
        <div className="p-4 sm:p-6">
          {scheduledPosts.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No scheduled posts</h3>
              <p className="text-gray-500">
                Create your first scheduled post to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {scheduledPosts
                .sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime())
                .map((post) => (
                  <div key={post.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div className="flex-1 w-full">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
                          <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-sm ${getStatusColor(post.status)}`}>
                            {getStatusIcon(post.status)}
                            <span className="capitalize">{post.status}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(post.scheduledTime).toLocaleString()}
                          </div>
                          {post.communityId && (
                            <div className="text-sm text-blue-600">
                              🏘️ Community Post
                            </div>
                          )}
                        </div>
                        <p className="text-gray-900 mb-2 leading-relaxed">{post.text}</p>
                        {post.media_ids && post.media_ids.length > 0 && (
                          <div className="text-sm text-gray-500 mb-2">
                            📎 {post.media_ids.length} media file(s)
                          </div>
                        )}
                        {post.errorMessage && (
                          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            Error: {post.errorMessage}
                          </div>
                        )}
                        {post.twitter_post_id && (
                          <div className="text-sm text-green-600">
                            Posted to Twitter: {post.twitter_post_id}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                        {post.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => handleEditPost(post)}
                              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 