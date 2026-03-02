import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ActivityItem from './ActivityItem';
import './ActivityFeed.css';

const ActivityFeed = ({ boardId, cardId }) => {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (boardId) {
            loadActivities();
        }
    }, [boardId, cardId]);

    const loadActivities = async () => {
        try {
            setLoading(true);
            setError(null);

            // Build URL with optional cardId filter
            let url = `http://localhost:8000/api/boards/${boardId}/activities/?page=1&page_size=50`;
            if (cardId) {
                url += `&card_id=${cardId}`;
            }

            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load activities');
            }

            const data = await response.json();
            setActivities(data.results);
            setHasMore(data.has_more);
            setPage(1);
        } catch (err) {
            console.error('Error loading activities:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        try {
            const nextPage = page + 1;
            let url = `http://localhost:8000/api/boards/${boardId}/activities/?page=${nextPage}&page_size=50`;
            if (cardId) {
                url += `&card_id=${cardId}`;
            }

            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load more activities');
            }

            const data = await response.json();
            setActivities([...activities, ...data.results]);
            setPage(nextPage);
            setHasMore(data.has_more);
        } catch (err) {
            console.error('Error loading more activities:', err);
        }
    };

    if (loading) {
        return (
            <div className="activity-feed">
                <h3>Activity</h3>
                <div className="activity-loading">Loading activities...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="activity-feed">
                <h3>Activity</h3>
                <div className="activity-error">Error: {error}</div>
            </div>
        );
    }

    return (
        <div className="activity-feed">
            <h3>Activity</h3>
            {activities.length === 0 ? (
                <div className="activity-empty">No activity yet</div>
            ) : (
                <>
                    <div className="activity-list">
                        {activities.map((activity) => (
                            <ActivityItem key={activity.id} activity={activity} />
                        ))}
                    </div>
                    {hasMore && (
                        <button onClick={loadMore} className="activity-load-more">
                            Load More
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

ActivityFeed.propTypes = {
    boardId: PropTypes.number.isRequired,
    cardId: PropTypes.number, // Optional: filter activities for specific card
};

export default ActivityFeed;
