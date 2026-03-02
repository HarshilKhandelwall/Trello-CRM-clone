"""
API views for workspace member management.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from .models import Workspace, WorkspaceMember
from .serializers import WorkspaceMemberSerializer, UserSerializer
from .auth import CsrfExemptSessionAuthentication
from .permissions import user_can_access_workspace

User = get_user_model()


class WorkspaceMembersListView(APIView):
    """List and add workspace members"""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, workspace_id):
        """Get all members of a workspace"""
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=404)

        # Check if user has access to workspace
        if not user_can_access_workspace(request.user, workspace):
            return Response({'error': 'Forbidden'}, status=403)

        members = WorkspaceMember.objects.filter(workspace=workspace).select_related('user', 'added_by')
        return Response(WorkspaceMemberSerializer(members, many=True).data)

    def post(self, request, workspace_id):
        """Add a member to workspace"""
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=404)

        # Only ADMIN or OWNER can add members
        if not user_can_access_workspace(request.user, workspace, min_role='ADMIN'):
            return Response({'error': 'Need ADMIN permission to add members'}, status=403)

        user_id = request.data.get('user_id')
        role = request.data.get('role', 'VIEWER')

        # Validate role
        if role not in ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER']:
            return Response({'error': 'Invalid role'}, status=400)

        # Only OWNER can assign OWNER role
        if role == 'OWNER' and not user_can_access_workspace(request.user, workspace, min_role='OWNER'):
            return Response({'error': 'Only OWNER can assign OWNER role'}, status=403)

        try:
            user_to_add = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        # Check if already a member
        if WorkspaceMember.objects.filter(workspace=workspace, user=user_to_add).exists():
            return Response({'error': 'User is already a workspace member'}, status=400)

        # Create membership
        member = WorkspaceMember.objects.create(
            workspace=workspace,
            user=user_to_add,
            role=role,
            added_by=request.user
        )

        return Response(WorkspaceMemberSerializer(member).data, status=201)


class WorkspaceMemberDetailView(APIView):
    """Update or remove workspace member"""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, workspace_id, user_id):
        """Update member role"""
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=404)

        # Only ADMIN or OWNER can update roles
        if not user_can_access_workspace(request.user, workspace, min_role='ADMIN'):
            return Response({'error': 'Need ADMIN permission to update roles'}, status=403)

        try:
            member = WorkspaceMember.objects.get(workspace=workspace, user__id=user_id)
        except WorkspaceMember.DoesNotExist:
            return Response({'error': 'Member not found'}, status=404)

        new_role = request.data.get('role')
        if new_role not in ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER']:
            return Response({'error': 'Invalid role'}, status=400)

        # Only OWNER can assign/change OWNER role
        if new_role == 'OWNER' and not user_can_access_workspace(request.user, workspace, min_role='OWNER'):
            return Response({'error': 'Only OWNER can assign OWNER role'}, status=403)

        # Prevent removing the last OWNER
        if member.role == 'OWNER' and new_role != 'OWNER':
            owner_count = WorkspaceMember.objects.filter(workspace=workspace, role='OWNER').count()
            if owner_count <= 1:
                return Response({'error': 'Cannot remove last OWNER'}, status=400)

        member.role = new_role
        member.save()

        return Response(WorkspaceMemberSerializer(member).data)

    def delete(self, request, workspace_id, user_id):
        """Remove member from workspace"""
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=404)

        # Only ADMIN or OWNER can remove members
        if not user_can_access_workspace(request.user, workspace, min_role='ADMIN'):
            return Response({'error': 'Need ADMIN permission to remove members'}, status=403)

        try:
            member = WorkspaceMember.objects.get(workspace=workspace, user__id=user_id)
        except WorkspaceMember.DoesNotExist:
            return Response({'error': 'Member not found'}, status=404)

        # Prevent removing the last OWNER
        if member.role == 'OWNER':
            owner_count = WorkspaceMember.objects.filter(workspace=workspace, role='OWNER').count()
            if owner_count <= 1:
                return Response({'error': 'Cannot remove last OWNER'}, status=400)

        member.delete()
        return Response({'message': 'Member removed successfully'}, status=204)
