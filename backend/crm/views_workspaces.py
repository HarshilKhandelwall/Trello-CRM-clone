from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Workspace, Board, List, BoardMember, WorkspaceMember
from .serializers import WorkspaceSerializer, BoardSerializer
from .auth import CsrfExemptSessionAuthentication
from .permissions import user_can_access_workspace


class WorkspaceListView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get all workspaces where user is a member
        workspace_memberships = WorkspaceMember.objects.filter(user=request.user).select_related('workspace')
        result = []
        for membership in workspace_memberships:
            ws_data = WorkspaceSerializer(membership.workspace).data
            # Superusers always get OWNER role regardless of membership record
            ws_data['my_role'] = 'OWNER' if request.user.is_superuser else membership.role
            result.append(ws_data)
        return Response(result)

    def post(self, request):
        # Create new workspace
        ws = Workspace.objects.create(
            name=request.data.get('name'),
            created_by=request.user,
        )
        
        # Add creator as workspace OWNER
        WorkspaceMember.objects.create(
            workspace=ws,
            user=request.user,
            role='OWNER',
            added_by=request.user
        )
        
        # Auto-create "Old Leads" board for this workspace
        old_leads_board = Board.objects.create(
            name='Old Leads',
            workspace=ws,
            created_by=request.user,
            background_type='color',
            background_value='#5E6C84'  # Gray color to distinguish it
        )
        
        # Add creator as board member
        BoardMember.objects.create(
            board=old_leads_board,
            user=request.user,
            role='ADMIN'
        )
        
        # Create default "Archived Leads" list
        List.objects.create(
            name='Archived Leads',
            board=old_leads_board,
            position=0
        )
        
        return Response(WorkspaceSerializer(ws).data, status=201)


class WorkspaceDetailView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=404)
        
        # Check workspace access
        if not user_can_access_workspace(request.user, workspace):
            return Response({'error': 'forbidden'}, status=403)
        
        data = WorkspaceSerializer(workspace).data
        # Superusers always get OWNER role regardless of membership record
        if request.user.is_superuser:
            data['my_role'] = 'OWNER'
        else:
            membership = WorkspaceMember.objects.filter(workspace=workspace, user=request.user).first()
            data['my_role'] = membership.role if membership else None
        return Response(data)


class BoardCreateView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, workspace_id):
        try:
            ws = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=404)

        # Check if user has EDITOR or higher permission
        if not user_can_access_workspace(request.user, ws, min_role='EDITOR'):
            return Response({'error': 'Need EDITOR permission to create boards'}, status=403)

        board = Board.objects.create(
            name=request.data.get('name'),
            workspace=ws,
            created_by=request.user
        )
        
        # Add creator as board ADMIN
        BoardMember.objects.create(
            board=board,
            user=request.user,
            role='ADMIN',
            added_by=request.user
        )
        
        return Response(BoardSerializer(board).data, status=201)


class AccessibleBoardsView(APIView):
    """
    GET /api/workspaces/accessible-boards/
    Returns all workspaces + boards + lists the current user has EDITOR+ access to.
    Used by the Move Card picker.
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .serializers import ListSerializer
        memberships = WorkspaceMember.objects.filter(
            user=request.user
        ).select_related('workspace').prefetch_related(
            'workspace__boards__lists'
        )

        result = []
        for membership in memberships:
            # Only include workspaces where user is EDITOR+
            role = 'OWNER' if request.user.is_superuser else membership.role
            if role not in ('EDITOR', 'ADMIN', 'OWNER'):
                continue
            ws = membership.workspace
            boards_data = []
            for board in ws.boards.all():
                lists_data = [
                    {'id': lst.id, 'name': lst.name}
                    for lst in board.lists.order_by('position')
                ]
                boards_data.append({
                    'id': board.id,
                    'name': board.name,
                    'lists': lists_data,
                })
            result.append({
                'id': ws.id,
                'name': ws.name,
                'boards': boards_data,
            })
        return Response(result)
