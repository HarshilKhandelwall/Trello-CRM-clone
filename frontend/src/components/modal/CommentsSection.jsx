import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { comments as commentsApi } from '../../api/endpoints';
import './CommentsSection.css';

const CommentsSection = ({ card }) => {
    const [comments, setComments] = useState([]);
    const [newCommentText, setNewCommentText] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editText, setEditText] = useState('');
    const [loading, setLoading] = useState(true);

    // Load comments when card changes
    useEffect(() => {
        // Reset state when card changes
        setComments([]);
        setLoading(true);
        setNewCommentText('');
        setIsAdding(false);
        setEditingCommentId(null);
        setEditText('');

        loadComments();
    }, [card.id]);

    const loadComments = async () => {
        try {
            const response = await commentsApi.list(card.id);
            setComments(response.data || response);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load comments:', err);
            setLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!newCommentText.trim()) return;

        try {
            const newComment = await commentsApi.create(card.id, newCommentText.trim());
            setComments([newComment, ...comments]); // Add to top (newest first)
            setNewCommentText('');
            setIsAdding(false);
        } catch (err) {
            console.error('Failed to add comment:', err);
        }
    };

    const handleEditComment = async (commentId) => {
        if (!editText.trim()) return;

        try {
            const updatedComment = await commentsApi.update(commentId, editText.trim());
            setComments(comments.map(c => c.id === commentId ? updatedComment : c));
            setEditingCommentId(null);
            setEditText('');
        } catch (err) {
            console.error('Failed to edit comment:', err);
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('Delete this comment?')) return;

        try {
            await commentsApi.delete(commentId);
            setComments(comments.filter(c => c.id !== commentId));
        } catch (err) {
            console.error('Failed to delete comment:', err);
        }
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getInitials = (name) => {
        return name ? name.charAt(0).toUpperCase() : '?';
    };

    // Get current user from localStorage or context
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    return (
        <div className="comments-section">
            <div className="comments-section-header">
                <div className="comments-section-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2z" />
                    </svg>
                </div>
                <h3>Activity</h3>
            </div>

            {/* Add comment */}
            <div className="add-comment">
                <div className="comment-avatar">
                    {getInitials(currentUser.username)}
                </div>
                {isAdding ? (
                    <div className="add-comment-form">
                        <textarea
                            className="add-comment-textarea"
                            placeholder="Write a comment..."
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    handleAddComment();
                                }
                                if (e.key === 'Escape') {
                                    setIsAdding(false);
                                    setNewCommentText('');
                                }
                            }}
                            rows={3}
                            autoFocus
                        />
                        <div className="add-comment-actions">
                            <button className="btn btn-primary btn-sm" onClick={handleAddComment}>
                                Save
                            </button>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                    setIsAdding(false);
                                    setNewCommentText('');
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        className="add-comment-placeholder"
                        onClick={() => setIsAdding(true)}
                    >
                        Write a comment...
                    </div>
                )}
            </div>

            {/* Comments list */}
            <div className="comments-list">
                {loading ? (
                    <p className="comments-empty">Loading comments...</p>
                ) : comments.length === 0 ? (
                    <p className="comments-empty">No comments yet</p>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="comment">
                            <div className="comment-avatar">
                                {getInitials(comment.user_name)}
                            </div>
                            <div className="comment-content">
                                <div className="comment-header">
                                    <span className="comment-author">{comment.user_name}</span>
                                    <span className="comment-timestamp">
                                        {formatTimestamp(comment.created_at)}
                                        {comment.updated_at !== comment.created_at && ' (edited)'}
                                    </span>
                                </div>

                                {editingCommentId === comment.id ? (
                                    <div className="edit-comment-form">
                                        <textarea
                                            className="edit-comment-textarea"
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                                    handleEditComment(comment.id);
                                                }
                                                if (e.key === 'Escape') {
                                                    setEditingCommentId(null);
                                                    setEditText('');
                                                }
                                            }}
                                            rows={3}
                                            autoFocus
                                        />
                                        <div className="edit-comment-actions">
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handleEditComment(comment.id)}
                                            >
                                                Save
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => {
                                                    setEditingCommentId(null);
                                                    setEditText('');
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="comment-text">{comment.text}</div>
                                        {comment.user === currentUser.id && (
                                            <div className="comment-actions">
                                                <button
                                                    className="btn-link"
                                                    onClick={() => {
                                                        setEditingCommentId(comment.id);
                                                        setEditText(comment.text);
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <span className="comment-action-separator">•</span>
                                                <button
                                                    className="btn-link danger"
                                                    onClick={() => handleDeleteComment(comment.id)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

CommentsSection.propTypes = {
    card: PropTypes.object.isRequired,
};

export default CommentsSection;
