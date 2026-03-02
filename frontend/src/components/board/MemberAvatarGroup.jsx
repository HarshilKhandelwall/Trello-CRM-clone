import React from 'react';
import PropTypes from 'prop-types';
import MemberAvatar from './MemberAvatar';
import './MemberAvatar.css';

const MemberAvatarGroup = ({ members, maxDisplay = 4, onClick }) => {
    const displayMembers = members.slice(0, maxDisplay);
    const remainingCount = members.length - maxDisplay;

    return (
        <div className="member-avatar-group" onClick={onClick}>
            {displayMembers.map((member) => (
                <MemberAvatar
                    key={member.user.id}
                    user={member.user}
                    size="medium"
                />
            ))}
            {remainingCount > 0 && (
                <div className="member-avatar member-avatar-medium member-avatar-more">
                    +{remainingCount}
                </div>
            )}
        </div>
    );
};

MemberAvatarGroup.propTypes = {
    members: PropTypes.arrayOf(PropTypes.shape({
        user: PropTypes.object.isRequired,
        role: PropTypes.string.isRequired,
    })).isRequired,
    maxDisplay: PropTypes.number,
    onClick: PropTypes.func,
};

export default MemberAvatarGroup;
