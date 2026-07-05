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
        # ── H-8 FIX: restrict workspace creation to admins/superusers.
        # In a controlled CRM, only administrators should create new workspaces.
        if not (request.user.is_superuser or request.user.is_staff):
            return Response(
                {'error': 'Only administrators can create workspaces.'},
                status=403
            )

        # ── H-3 FIX: validate workspace name before touching the DB
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'error': 'Workspace name is required.'}, status=400)
        if len(name) > 100:
            return Response({'error': 'Workspace name must be 100 characters or fewer.'}, status=400)

        from django.db import transaction
        with transaction.atomic():
            # Create new workspace
            ws = Workspace.objects.create(
                name=name,
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
        from crm.models import Board, WorkspaceMember, BoardMember
        from crm.permissions import ROLE_HIERARCHY
        from django.db.models import Q
        
        is_super = request.user.is_superuser
        
        # Get baseline workspace roles
        ws_memberships = {
            m.workspace_id: m.role 
            for m in WorkspaceMember.objects.filter(user=request.user)
        }
        
        # Get board overrides
        board_overrides = {
            m.board_id: m.role
            for m in BoardMember.objects.filter(user=request.user)
        }
        
        # ── L-1 FIX: Fetch ALL boards from shared workspaces or direct board memberships
        boards = Board.objects.filter(
            Q(workspace_id__in=ws_memberships.keys()) | Q(id__in=board_overrides.keys())
        ).select_related('workspace').prefetch_related('lists')

        workspaces_dict = {}
        for board in boards:
            # Determine effective role for this specific board
            if is_super:
                eff_role = 'OWNER'
            elif board.id in board_overrides:
                eff_role = board_overrides[board.id]
            else:
                eff_role = ws_memberships.get(board.workspace_id)

            role_level = ROLE_HIERARCHY.get(eff_role, -1) if eff_role else -1
            
            # ── L-1 FIX: If the user is EDITOR+ on THIS board, include it
            if role_level >= 1:  # 1 is EDITOR, 2 is ADMIN, 3 is OWNER
                ws = board.workspace
                if ws.id not in workspaces_dict:
                    workspaces_dict[ws.id] = {
                        'id': ws.id,
                        'name': ws.name,
                        'boards': []
                    }
                lists_data = [
                    {'id': lst.id, 'name': lst.name}
                    for lst in board.lists.all().order_by('position')
                ]
                workspaces_dict[ws.id]['boards'].append({
                    'id': board.id,
                    'name': board.name,
                    'lists': lists_data,
                })

        return Response(list(workspaces_dict.values()))
