"""
Views for card search and filtering functionality.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db.models import Q, Case, When, Value, IntegerField
from datetime import datetime, timedelta
from django.utils import timezone
from crm.models import Board, Card, BoardMember, Comment, ChecklistItem
from crm.serializers import CardSerializer
from crm.permissions import user_can_access_board


class CardSearchView(APIView):
    """
    Advanced card search and filter API endpoint.
    GET /api/boards/{board_id}/search/

    Query parameters:
    - q: search term (searches title, description, comments, checklist items)
    - labels: comma-separated label IDs
    - members: comma-separated user IDs
    - due_date: overdue|today|week|none
    - lists: comma-separated list IDs
    - archived: true|false
    - page: page number (default: 1)
    - page_size: results per page (default: 50)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, board_id):
        """Search and filter cards"""
        board = get_object_or_404(Board, id=board_id)

        # Check if user has access to this board
        if not user_can_access_board(request.user, board, min_role='VIEWER'):
            return Response({'error': 'You do not have access to this board'}, status=403)

        # Start with all cards on this board
        cards = Card.objects.filter(list__board=board).select_related('list', 'created_by')
        cards = cards.prefetch_related('members', 'attachments', 'checklists', 'comments')

        # Search query
        search_term = request.query_params.get('q', '').strip()
        if search_term:
            # Search across multiple fields
            cards = cards.filter(
                Q(title__icontains=search_term) |
                Q(description__icontains=search_term) |
                Q(comments__text__icontains=search_term) |
                Q(checklists__items__text__icontains=search_term)
            ).distinct()

        # Filter by labels
        labels_param = request.query_params.get('labels', '').strip()
        if labels_param:
            label_ids = [int(lid) for lid in labels_param.split(',') if lid.isdigit()]
            if label_ids:
                cards = cards.filter(labels__id__in=label_ids).distinct()

        # Filter by members
        members_param = request.query_params.get('members', '').strip()
        if members_param:
            member_ids = [int(mid) for mid in members_param.split(',') if mid.isdigit()]
            if member_ids:
                cards = cards.filter(members__id__in=member_ids)

        # Filter by due date
        due_date_filter = request.query_params.get('due_date', '').strip()
        if due_date_filter:
            now = timezone.now()
            if due_date_filter == 'overdue':
                cards = cards.filter(due_at__lt=now)
            elif due_date_filter == 'today':
                start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_day = start_of_day + timedelta(days=1)
                cards = cards.filter(due_at__gte=start_of_day, due_at__lt=end_of_day)
            elif due_date_filter == 'week':
                end_of_week = now + timedelta(days=7)
                cards = cards.filter(due_at__gte=now, due_at__lte=end_of_week)
            elif due_date_filter == 'none':
                cards = cards.filter(due_at__isnull=True)

        # Filter by lists
        lists_param = request.query_params.get('lists', '').strip()
        if lists_param:
            list_ids = [int(lid) for lid in lists_param.split(',') if lid.isdigit()]
            if list_ids:
                cards = cards.filter(list__id__in=list_ids)

        # Filter by archived status
        archived_param = request.query_params.get('archived', '').strip().lower()
        if archived_param == 'true':
            cards = cards.filter(archived=True)
        elif archived_param == 'false':
            cards = cards.filter(archived=False)
        else:
            # Default: exclude archived cards
            cards = cards.filter(archived=False)

        # ── C-1 FIX: Order by relevance using safe Django ORM Case/When.
        # The previous code used .extra(select=f"... ILIKE '%{search_term}%' ...")
        # which was a SQL injection vector AND broken on SQLite (no ILIKE support).
        if search_term:
            cards = cards.annotate(
                title_match=Case(
                    When(title__icontains=search_term, then=Value(0)),
                    default=Value(1),
                    output_field=IntegerField()
                )
            ).order_by('title_match', '-created_at')
        else:
            cards = cards.order_by('-created_at')

        # Pagination — guard against non-integer query params
        try:
            page_size = min(int(request.query_params.get('page_size', 50)), 100)
            page = max(int(request.query_params.get('page', 1)), 1)
        except (ValueError, TypeError):
            page_size = 50
            page = 1

        start = (page - 1) * page_size
        end = start + page_size

        # Get paginated results
        total_count = cards.count()
        cards_page = cards[start:end]

        # Serialize
        serializer = CardSerializer(cards_page, many=True)

        return Response({
            'results': serializer.data,
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'has_more': end < total_count,
            'filters_applied': {
                'search': bool(search_term),
                'labels': bool(labels_param),
                'members': bool(members_param),
                'due_date': bool(due_date_filter),
                'lists': bool(lists_param),
                'archived': archived_param or 'false'
            }
        })


class CardAutocompleteView(APIView):
    """
    Quick autocomplete search for cards (for mentions, linking, etc.)
    GET /api/boards/{board_id}/cards/autocomplete/?q=search_term
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, board_id):
        """Get quick card suggestions"""
        board = get_object_or_404(Board, id=board_id)

        # Check access
        if not user_can_access_board(request.user, board, min_role='VIEWER'):
            return Response({'error': 'You do not have access to this board'}, status=403)

        search_term = request.query_params.get('q', '').strip()
        if not search_term or len(search_term) < 2:
            return Response([])

        # Quick search on title only
        cards = Card.objects.filter(
            list__board=board,
            title__icontains=search_term,
            archived=False
        ).select_related('list')[:10]

        # Return minimal data
        results = [{
            'id': card.id,
            'title': card.title,
            'list_name': card.list.name,
            'list_id': card.list.id
        } for card in cards]

        return Response(results)


class WorkspaceSearchView(APIView):
    """
    Universal search across ALL boards in a workspace that the user has access to.
    GET /api/workspaces/{workspace_id}/search/?q=...&page=1&page_size=30

    Query parameters:
    - q: search term (searches title, description)
    - page / page_size: pagination
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, workspace_id):
        from crm.models import Workspace, WorkspaceMember, BoardMember
        from crm.permissions import user_can_access_workspace, user_can_access_board

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=404)

        if not user_can_access_workspace(request.user, workspace, min_role='VIEWER'):
            return Response({'error': 'forbidden'}, status=403)

        search_term = request.query_params.get('q', '').strip()
        if not search_term or len(search_term) < 2:
            return Response({'results': [], 'count': 0})

        # Get all boards in this workspace
        from crm.models import Board, WorkspaceMember, BoardMember
        from crm.permissions import ROLE_HIERARCHY
        all_boards = Board.objects.filter(workspace=workspace)
        
        # ── M-4 FIX: Pre-fetch accessible board IDs instead of N+1 loop queries
        try:
            ws_member = WorkspaceMember.objects.get(workspace=workspace, user=request.user)
            ws_role_level = ROLE_HIERARCHY.get(ws_member.role, -1)
        except WorkspaceMember.DoesNotExist:
            ws_role_level = -1
            
        board_overrides = {
            bm.board_id: ROLE_HIERARCHY.get(bm.role, -1)
            for bm in BoardMember.objects.filter(board__workspace=workspace, user=request.user)
        }
        
        board_ids = []
        for board in all_boards:
            # Use board-specific role if it exists, otherwise fall back to workspace role
            role_level = board_overrides.get(board.id, ws_role_level)
            if role_level >= 0:  # VIEWER (0) or higher
                board_ids.append(board.id)

        if not board_ids:
            return Response({'results': [], 'count': 0})

        # Search cards across all accessible boards
        cards = Card.objects.filter(
            list__board__id__in=board_ids,
            archived=False
        ).filter(
            Q(title__icontains=search_term) |
            Q(description__icontains=search_term) |
            Q(email__icontains=search_term) |
            Q(phone__icontains=search_term)
        ).select_related('list', 'list__board', 'created_by').distinct()

        # Pagination — guard against non-integer query params
        try:
            page_size = min(int(request.query_params.get('page_size', 30)), 100)
            page = max(int(request.query_params.get('page', 1)), 1)
        except (ValueError, TypeError):
            page_size = 30
            page = 1

        start = (page - 1) * page_size
        end = start + page_size

        total_count = cards.count()
        cards_page = cards.order_by('-created_at')[start:end]

        results = []
        for card in cards_page:
            results.append({
                'id': card.id,
                'title': card.title,
                'description': card.description[:120] if card.description else '',
                'list_id': card.list.id,
                'list_name': card.list.name,
                'board_id': card.list.board.id,
                'board_name': card.list.board.name,
                'due_at': card.due_at.isoformat() if card.due_at else None,
                'created_at': card.created_at.isoformat(),
            })

        return Response({
            'results': results,
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'has_more': end < total_count,
        })
