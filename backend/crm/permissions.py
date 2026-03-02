from rest_framework.permissions import BasePermission
from .models import BoardMember, WorkspaceMember

class IsBoardMember(BasePermission):
    def has_object_permission(self, request, view, obj):
        return BoardMember.objects.filter(board=obj.board, user=request.user).exists()


# Role hierarchy (higher index = more permissions)
ROLE_HIERARCHY = {
    'VIEWER': 0,
    'EDITOR': 1,
    'ADMIN': 2,
    'OWNER': 3
}


def user_can_access_workspace(user, workspace, min_role='VIEWER'):
    """
    Check if user has access to a workspace with at least the specified role.
    
    Args:
        user: User object
        workspace: Workspace object
        min_role: Minimum role required (VIEWER, EDITOR, ADMIN, OWNER)
    
    Returns:
        bool: True if user has sufficient access, False otherwise
    """
    if user.is_superuser:
        return True
    
    try:
        member = WorkspaceMember.objects.get(workspace=workspace, user=user)
        user_role_level = ROLE_HIERARCHY.get(member.role, -1)
        required_role_level = ROLE_HIERARCHY.get(min_role, 0)
        return user_role_level >= required_role_level
    except WorkspaceMember.DoesNotExist:
        return False


def user_can_access_board(user, board, min_role='VIEWER'):
    """
    Check if user has access to a board with at least the specified role.
    
    Checks workspace membership first, then board-level overrides.
    
    Args:
        user: User object
        board: Board object
        min_role: Minimum role required (VIEWER, EDITOR, ADMIN, OWNER)
    
    Returns:
        bool: True if user has sufficient access, False otherwise
    """
    if user.is_superuser:
        return True
    
    workspace = board.workspace
    required_role_level = ROLE_HIERARCHY.get(min_role, 0)
    
    # First check workspace membership
    try:
        workspace_member = WorkspaceMember.objects.get(workspace=workspace, user=user)
        
        # Check for board-level override
        try:
            board_member = BoardMember.objects.get(board=board, user=user)
            # Use board-level role (override)
            board_role_level = ROLE_HIERARCHY.get(board_member.role, -1)
            return board_role_level >= required_role_level
        except BoardMember.DoesNotExist:
            # No board override, use workspace role
            workspace_role_level = ROLE_HIERARCHY.get(workspace_member.role, -1)
            return workspace_role_level >= required_role_level
            
    except WorkspaceMember.DoesNotExist:
        # Not a workspace member, check if they have direct board access (legacy)
        try:
            board_member = BoardMember.objects.get(board=board, user=user)
            board_role_level = ROLE_HIERARCHY.get(board_member.role, -1)
            return board_role_level >= required_role_level
        except BoardMember.DoesNotExist:
            return False


def get_user_workspace_role(user, workspace):
    """
    Get user's role in a workspace.
    
    Args:
        user: User object
        workspace: Workspace object
    
    Returns:
        str or None: Role name (VIEWER, EDITOR, ADMIN, OWNER) or None if not a member
    """
    if user.is_superuser:
        return 'OWNER'
    
    try:
        member = WorkspaceMember.objects.get(workspace=workspace, user=user)
        return member.role
    except WorkspaceMember.DoesNotExist:
        return None


def get_user_board_role(user, board):
    """
    Get user's effective role for a board (considers workspace and board membership).
    
    Args:
        user: User object
        board: Board object
    
    Returns:
        str or None: Role name (VIEWER, EDITOR, ADMIN, OWNER) or None if no access
    """
    if user.is_superuser:
        return 'OWNER'
    
    workspace = board.workspace
    
    # Check workspace membership
    try:
        workspace_member = WorkspaceMember.objects.get(workspace=workspace, user=user)
        
        # Check for board-level override
        try:
            board_member = BoardMember.objects.get(board=board, user=user)
            return board_member.role  # Board override takes precedence
        except BoardMember.DoesNotExist:
            return workspace_member.role  # Inherit from workspace
            
    except WorkspaceMember.DoesNotExist:
        # Check direct board access (legacy)
        try:
            board_member = BoardMember.objects.get(board=board, user=user)
            return board_member.role
        except BoardMember.DoesNotExist:
            return None
