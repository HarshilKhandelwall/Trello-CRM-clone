import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { attachments } from '../../api/endpoints';
import './AttachmentUpload.css';

const AttachmentUpload = ({ cardId, onUploadComplete }) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file size (max 50MB - increased for any file type)
        if (file.size > 50 * 1024 * 1024) {
            setError('File size must be less than 50MB');
            return;
        }

        try {
            setUploading(true);
            setError(null);

            const result = await attachments.upload(cardId, file);

            if (onUploadComplete) {
                onUploadComplete(result);
            }

            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err) {
            console.error('Upload failed:', err);
            setError(err.message || 'Failed to upload file');
        } finally {
            setUploading(false);
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="attachment-upload">
            <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            <button
                className="btn btn-secondary btn-sm btn-block"
                onClick={handleButtonClick}
                disabled={uploading}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 2h12v12H2V2zm2 2v8h8V4H4z" />
                </svg>
                {uploading ? 'Uploading...' : 'Attachment'}
            </button>

            {error && (
                <div className="attachment-upload-error">
                    {error}
                </div>
            )}
        </div>
    );
};

AttachmentUpload.propTypes = {
    cardId: PropTypes.number.isRequired,
    onUploadComplete: PropTypes.func,
};

export default AttachmentUpload;
