import React from 'react';
import PropTypes from 'prop-types';
import './MemberAvatar.css';

const MemberAvatar = ({ user, size = 'medium', showTooltip = true }) => {
    const getInitials = (user) => {
        if (user.first_name && user.last_name) {
            return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
        }
        return user.username.substring(0, 2).toUpperCase();
    };

    const getColorFromName = (name) => {
        // Generate a consistent color based on the name
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = hash % 360;
        return `hsl(${hue}, 65%, 50%)`;
    };

    const sizeClass = `member-avatar-${size}`;
    const backgroundColor = getColorFromName(user.username);
    const displayName = user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.username;

    return (
        <div
            className={`member-avatar ${sizeClass}`}
            style={{ backgroundColor }}
            title={showTooltip ? displayName : ''}
        >
            {getInitials(user)}
        </div>
    );
};

MemberAvatar.propTypes = {
    user: PropTypes.shape({
        id: PropTypes.number.isRequired,
        username: PropTypes.string.isRequired,
        email: PropTypes.string,
        first_name: PropTypes.string,
        last_name: PropTypes.string,
    }).isRequired,
    size: PropTypes.oneOf(['small', 'medium', 'large']),
    showTooltip: PropTypes.bool,
};

export default MemberAvatar;
