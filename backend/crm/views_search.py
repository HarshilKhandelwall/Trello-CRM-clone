"""
Views for card search and filtering functionality.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db.models import Q
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
                # Cards that have ANY of the specified labels (using ManyToMany relationship)
                cards = cards.filter(labels__id__in=label_ids).distinct()
        
        # Filter by members
        members_param = request.query_params.get('members', '').strip()
        if members_param:
            member_ids = [int(mid) for mid in members_param.split(',') if mid.isdigit()]
            if member_ids:
                # Cards that have ANY of the specified members
                cards = cards.filter(members__id__in=member_ids)
        
        # Filter by due date
        due_date_filter = request.query_params.get('due_date', '').strip()
        if due_date_filter:
            now = timezone.now()
            if due_date_filter == 'overdue':
                # Cards with due date in the past
                cards = cards.filter(due_at__lt=now)
            elif due_date_filter == 'today':
                # Cards due today
                start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_day = start_of_day + timedelta(days=1)
                cards = cards.filter(due_at__gte=start_of_day, due_at__lt=end_of_day)
            elif due_date_filter == 'week':
                # Cards due within next 7 days
                end_of_week = now + timedelta(days=7)
                cards = cards.filter(due_at__gte=now, due_at__lte=end_of_week)
            elif due_date_filter == 'none':
                # Cards with no due date
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
        
        # Order by relevance (cards with search term in title first, then by created date)
        if search_term:
            # Simple relevance: title matches first
            cards = cards.extra(
                select={'title_match': f"CASE WHEN title ILIKE '%{search_term}%' THEN 0 ELSE 1 END"}
            ).order_by('title_match', '-created_at')
        else:
            cards = cards.order_by('-created_at')
        
        # Pagination
        page_size = min(int(request.query_params.get('page_size', 50)), 100)  # Max 100
        page = int(request.query_params.get('page', 1))
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
